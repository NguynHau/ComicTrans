import {
  extractComicImagesClient,
  ensureImageAsJpegBase64,
  runOcrAndTranslationClient,
  renderInpaintedTranslatedImageClient,
} from './clientPipeline';
import {
  saveRecentItemToStorage,
  getRecentItemsFromStorage,
  getFoldersFromStorage,
  findOrCreateFolderForSeries,
  saveBatchSession,
  generatePageCacheKey,
  getCachedPageTranslation,
  saveCachedPageTranslation,
} from './storage';
import {
  analyzeChapterUrl,
  extractSeriesBaseUrl,
  normalizeChapterTitle,
} from './chapterUrlUtils';
import { extractChapterNumber } from './chapterSort';
import { classifyPipelineError } from './errorUtils';
import {
  MangaJob,
  MangaPage,
  RecentItem,
  MangaFolder,
  BatchTranslationSession,
  BatchChapterSummary,
  DetailedError,
  OCRBoxItem,
  TranslationItem,
} from '../types';

export interface BatchCallbacks {
  onSessionUpdate: (session: BatchTranslationSession) => void;
  onActiveJobUpdate: (job: MangaJob, pages: MangaPage[]) => void;
  onChapterCompleted: (summary: BatchChapterSummary, recentItem: RecentItem) => void;
  onBatchFinished: (session: BatchTranslationSession) => void;
  shouldAbort: () => boolean;
  onRequireFolderSelection?: (seriesName: string) => Promise<MangaFolder>;
}

/**
 * Executes a full multi-chapter batch translation loop:
 * Auto-detects series, checks existing chapters in IndexedDB, resumes incomplete chapters first,
 * skips finished chapters, uses strict "Chap X" naming, and preserves exact source URLs.
 */
/**
 * Helper to write and store sequential diagnostic logs for batch processing
 */
async function addLog(
  session: BatchTranslationSession,
  msg: string,
  callbacks: BatchCallbacks
): Promise<void> {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedLog = `[${timestamp}] ${msg}`;
  console.log(`[RiXia Batch] ${formattedLog}`);
  
  session.logs = session.logs || [];
  session.logs.push(formattedLog);
  
  // Truncate logs if they get too long to prevent IndexedDB storage bottleneck
  if (session.logs.length > 500) {
    session.logs = session.logs.slice(-500);
  }
  
  session.lastUpdated = new Date().toISOString();
  callbacks.onSessionUpdate({ ...session });
  await saveBatchSession(session);
}

/**
 * Executes a full multi-chapter batch translation loop:
 * Auto-detects series, checks existing chapters in IndexedDB, resumes incomplete chapters first,
 * skips finished chapters, uses strict "Chap X" naming, and preserves exact source URLs.
 */
export async function runBatchTranslationLoop(
  initialUrl: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  callbacks: BatchCallbacks,
  existingSession?: BatchTranslationSession | null
): Promise<BatchTranslationSession> {
  const analysis = analyzeChapterUrl(initialUrl);
  const seriesName = analysis.seriesName || 'Bộ truyện mới';
  const seriesBaseUrl = extractSeriesBaseUrl(initialUrl);

  // 1. Determine folder: if resuming with a valid selected folder, use it. Otherwise, set to 'pending' placeholder.
  let folder: MangaFolder;
  if (existingSession && existingSession.folderId && existingSession.folderId !== 'pending') {
    const folders = await getFoldersFromStorage();
    const found = folders.find((f) => f.id === existingSession.folderId);
    if (found) {
      folder = found;
    } else {
      folder = {
        id: existingSession.folderId,
        name: seriesName,
        createdAt: new Date().toISOString(),
      };
    }
  } else {
    folder = {
      id: 'pending',
      name: 'Chưa chọn thư mục',
      createdAt: new Date().toISOString(),
    };
  }

  // 2. Query IndexedDB for existing saved chapters of this folder/series
  const existingRecents = await getRecentItemsFromStorage();
  const folderChapters = folder.id !== 'pending'
    ? existingRecents.filter((r) => r.folderId === folder.id)
    : [];

  const completedInStorage = folderChapters.filter(
    (r) => r.completedPages > 0 && r.completedPages === r.totalPages && r.job?.status !== 'failed'
  );

  const incompleteInStorage = folderChapters.filter(
    (r) => r.completedPages < r.totalPages || r.completedPages === 0 || r.job?.status === 'failed'
  );

  // 3. Initialize or restore session
  const sessionId = existingSession ? existingSession.id : 'batch_' + Date.now();
  let session: BatchTranslationSession = existingSession
    ? {
        ...existingSession,
        status: 'running',
        lastUpdated: new Date().toISOString(),
      }
    : {
        id: sessionId,
        seriesName,
        seriesBaseUrl,
        folderId: folder.id,
        sourceLang,
        targetLang,
        initialUrl: initialUrl.trim(),
        currentUrl: initialUrl.trim(),
        currentChapterNumber: analysis.currentChapterNumber,
        completedChapters: completedInStorage.map((c) => ({
          chapterNumber: extractChapterNumber(c.title),
          title: c.title.replace(/^Chương\s+/i, 'Chap '),
          url: c.sourceUrl || initialUrl,
          pageCount: c.completedPages,
          completedAt: c.timestamp,
          recentItemId: c.id,
        })),
        status: 'running',
        consecutiveErrors: 0,
        lastUpdated: new Date().toISOString(),
        maxChapters: 100, // Upper limit
        logs: [],
      };

  session.logs = session.logs || [];
  callbacks.onSessionUpdate({ ...session });
  await saveBatchSession(session);

  await addLog(session, `[START] Bắt đầu phiên dịch tự động bộ truyện: "${seriesName}"`, callbacks);

  let currentUrl = session.currentUrl;
  let currentChapterNum = session.currentChapterNumber;
  let loopCount = 0;
  const MAX_CHAPTERS = session.maxChapters || 100;

  // 4. Prioritize processing any incomplete or failed chapter in IndexedDB first
  if (incompleteInStorage.length > 0) {
    const firstIncomplete = incompleteInStorage[0];
    if (firstIncomplete.sourceUrl) {
      currentUrl = firstIncomplete.sourceUrl;
      currentChapterNum = extractChapterNumber(firstIncomplete.title);
      session.currentUrl = currentUrl;
      session.currentChapterNumber = currentChapterNum;
      await addLog(
        session,
        `[PENDING] Phát hiện chương chưa hoàn tất: "${firstIncomplete.title}". Ưu tiên khôi phục tiến độ từ URL: ${currentUrl}`,
        callbacks
      );
    }
  }

  while (loopCount < MAX_CHAPTERS) {
    if (callbacks.shouldAbort()) {
      session = { ...session, status: 'paused', lastUpdated: new Date().toISOString() };
      await addLog(session, `[PAUSED] Tiến trình được tạm ngưng bởi người dùng.`, callbacks);
      return session;
    }

    loopCount++;
    const currentAnalysis = analyzeChapterUrl(currentUrl);
    const chapterNum = currentAnalysis.currentChapterNumber ?? currentChapterNum;
    const chapterTitle = `Chap ${chapterNum}`;

    await addLog(session, `[PROCESSING] Đang tải chương: ${chapterTitle} (URL: ${currentUrl})`, callbacks);

    // Step A: Check if this chapter is ALREADY completed in IndexedDB
    const latestRecents = await getRecentItemsFromStorage();
    const alreadySaved = latestRecents.find(
      (r) =>
        (r.folderId === folder.id || r.folderName?.toLowerCase() === seriesName.toLowerCase()) &&
        (r.sourceUrl === currentUrl || normalizeChapterTitle(r.title) === normalizeChapterTitle(chapterTitle)) &&
        r.completedPages > 0 &&
        r.completedPages === r.totalPages &&
        r.job?.status !== 'failed'
    );

    if (alreadySaved) {
      await addLog(
        session,
        `[COMPLETED] Chương "${chapterTitle}" đã được dịch đầy đủ từ trước. Tự động bỏ qua và chuyển tiếp.`,
        callbacks
      );

      const summary: BatchChapterSummary = {
        chapterNumber: chapterNum,
        title: chapterTitle,
        url: currentUrl,
        pageCount: alreadySaved.totalPages,
        completedAt: new Date().toISOString(),
        recentItemId: alreadySaved.id,
      };

      if (!session.completedChapters.some((c) => c.url === currentUrl || c.title === chapterTitle)) {
        session.completedChapters = [...session.completedChapters, summary];
      }

      // Check next chapter URL
      if (currentAnalysis.isRecognized && currentAnalysis.nextUrl) {
        currentUrl = currentAnalysis.nextUrl;
        currentChapterNum = currentAnalysis.nextChapterNumber;
        session.currentUrl = currentUrl;
        session.currentChapterNumber = currentChapterNum;
        callbacks.onSessionUpdate({ ...session });
        await saveBatchSession(session);
        continue;
      } else {
        await addLog(session, `[COMPLETED] Hoàn thành toàn bộ truyện! Tất cả các chương đã có trong thư viện.`, callbacks);
        session.status = 'completed';
        session.lastUpdated = new Date().toISOString();
        callbacks.onSessionUpdate({ ...session });
        await saveBatchSession(session);
        callbacks.onBatchFinished(session);
        return session;
      }
    }

    // Step B: Scrape images for current chapter
    let resolvedImages: string[] = [];
    let scrapeRetryCount = 0;
    const MAX_SCRAPE_RETRIES = 3;
    let scrapeError: any = null;

    while (scrapeRetryCount < MAX_SCRAPE_RETRIES) {
      if (callbacks.shouldAbort()) {
        session = { ...session, status: 'paused', lastUpdated: new Date().toISOString() };
        await addLog(session, `[PAUSED] Tiến trình tạm dừng trong khi tải ảnh.`, callbacks);
        return session;
      }

      try {
        const scrapeResult = await extractComicImagesClient(currentUrl);
        if (scrapeResult && scrapeResult.images && scrapeResult.images.length > 0) {
          resolvedImages = scrapeResult.images;
          break;
        } else {
          throw new Error('NO_IMAGES_FOUND: Không phát hiện được ảnh truyện nào trong chương này.');
        }
      } catch (err: any) {
        scrapeError = err;
        scrapeRetryCount++;
        if (scrapeRetryCount < MAX_SCRAPE_RETRIES) {
          await addLog(
            session,
            `[RETRYING] Thử tải lại ảnh chương (${scrapeRetryCount}/${MAX_SCRAPE_RETRIES}) sau 3 giây...`,
            callbacks
          );
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }

    // If scraping failed after retries
    if (resolvedImages.length === 0) {
      const isEndOrNotFound =
        scrapeError?.message?.includes('NO_IMAGES_FOUND') ||
        scrapeError?.message?.includes('404') ||
        scrapeError?.message?.includes('FETCH_FAILED');

      if (isEndOrNotFound && session.completedChapters.length > 0) {
        await addLog(session, `[COMPLETED] Đã dịch đến chương cuối cùng của bộ truyện này.`, callbacks);
        session = {
          ...session,
          status: 'completed',
          lastUpdated: new Date().toISOString(),
        };
        callbacks.onSessionUpdate({ ...session });
        await saveBatchSession(session);
        callbacks.onBatchFinished(session);
        return session;
      } else {
        const classified = classifyPipelineError(scrapeError || new Error('Không thể tải danh sách ảnh chương'));
        session = {
          ...session,
          status: 'failed',
          errorMessage: `Không thể tải ảnh tại ${chapterTitle}: ${classified.message}`,
          detailedError: classified,
          lastUpdated: new Date().toISOString(),
        };
        await addLog(
          session,
          `[FAILED] Chương "${chapterTitle}" tải ảnh thất bại. Lỗi: ${classified.message}. Dừng tiến trình.`,
          callbacks
        );
        return session;
      }
    }

    await addLog(session, `[PENDING] Phát hiện ${resolvedImages.length} trang ảnh hợp lệ. Bắt đầu dịch song song...`, callbacks);

    // Step C: Initialize MangaJob & MangaPages for current chapter
    const jobId = 'job_' + Date.now();
    const chapterJob: MangaJob = {
      job_id: jobId,
      status: 'processing',
      source_url: currentUrl,
      source_language: sourceLang,
      target_language: targetLang,
      total_pages: resolvedImages.length,
      completed_pages: 0,
      current_page: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let chapterPages: MangaPage[] = resolvedImages.map((src, idx) => ({
      id: `page_${jobId}_${idx + 1}`,
      job_id: jobId,
      page_number: idx + 1,
      source_image: src,
      status: 'queued',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ocr_results: [],
      translations: [],
    }));

    callbacks.onActiveJobUpdate({ ...chapterJob }, [...chapterPages]);

    // Step D: Process chapter pages with optimal worker pool (Concurrency: 4) & IndexedDB Cache
    const CONCURRENCY_LIMIT = 4;
    let completedCount = 0;
    let isChapterAborted = false;
    let fatalError: DetailedError | null = null;
    let lastErrorMessage = '';
    const chapterStartTime = Date.now();

    const queue = chapterPages.map((page, index) => ({ page, index }));
    let nextQueueIndex = 0;

    const worker = async () => {
      while (nextQueueIndex < queue.length && !isChapterAborted) {
        if (callbacks.shouldAbort()) {
          isChapterAborted = true;
          return;
        }

        const currentTask = queue[nextQueueIndex++];
        if (!currentTask) continue;
        const { page, index } = currentTask;

        // Update page status to processing
        chapterPages = chapterPages.map((p) => (p.id === page.id ? { ...p, status: 'processing' } : p));
        chapterJob.current_page = index + 1;
        callbacks.onActiveJobUpdate({ ...chapterJob }, [...chapterPages]);

        const pageStartTime = Date.now();
        const MAX_PAGE_RETRIES = 3;
        let attempt = 0;
        let pageSuccess = false;
        let ocr_results: OCRBoxItem[] = [];
        let translations: TranslationItem[] = [];
        let jpegBase64 = '';
        let processed_image = '';
        let pageErrorObj: any = null;
        let pageClassifiedErr: DetailedError | null = null;

        while (attempt < MAX_PAGE_RETRIES && !isChapterAborted) {
          attempt++;
          try {
            if (callbacks.shouldAbort()) {
              isChapterAborted = true;
              break;
            }

            // Apply exponential backoff starting from the 2nd attempt
            if (attempt > 1) {
              const delayMs = Math.min(12000, 3000 * Math.pow(2, attempt - 2));
              await addLog(
                session,
                `[RETRYING] Trang ${index + 1}: Gặp lỗi tạm thời. Thử lại lần ${attempt}/${MAX_PAGE_RETRIES} sau ${delayMs / 1000}s...`,
                callbacks
              );
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }

            // Check Cache
            const cacheKey = await generatePageCacheKey(page.source_image, sourceLang, targetLang);
            const cached = await getCachedPageTranslation(cacheKey);

            if (cached && cached.ocr_results?.length > 0 && cached.translations?.length > 0) {
              ocr_results = cached.ocr_results;
              translations = cached.translations;
              jpegBase64 = cached.source_image || page.source_image;
              processed_image =
                cached.processed_image ||
                (await renderInpaintedTranslatedImageClient(jpegBase64, ocr_results, translations));
            } else {
              // Cache miss: Execute OCR -> Translation -> Inpainting
              const rawJpeg = await ensureImageAsJpegBase64(page.source_image);
              const apiRes = await runOcrAndTranslationClient(
                rawJpeg,
                sourceLang,
                targetLang,
                apiKey,
                index + 1
              );

              ocr_results = apiRes.ocr_results;
              translations = apiRes.translations;
              jpegBase64 = apiRes.jpegBase64;

              processed_image = await renderInpaintedTranslatedImageClient(
                jpegBase64 || page.source_image,
                ocr_results,
                translations
              );

              // Cache page
              await saveCachedPageTranslation({
                cacheKey,
                sourceLang,
                targetLang,
                ocr_results,
                translations,
                processed_image,
                source_image: jpegBase64,
                timestamp: Date.now(),
              });
            }

            pageSuccess = true;
            break; // Success! Exit retry loop
          } catch (pageErr: any) {
            pageErrorObj = pageErr;
            pageClassifiedErr = classifyPipelineError(pageErr);
            lastErrorMessage = pageClassifiedErr.message;

            // Stop immediately if API Key is completely invalid or missing, or if permission denied
            if (
              pageClassifiedErr.category === 'API_KEY_INVALID' ||
              pageClassifiedErr.category === 'API_KEY_MISSING' ||
              pageClassifiedErr.category === 'API_PERMISSION_DENIED'
            ) {
              fatalError = pageClassifiedErr;
              isChapterAborted = true;
              break;
            }
          }
        }

        if (callbacks.shouldAbort()) {
          isChapterAborted = true;
          return;
        }

        const durationSec = ((Date.now() - pageStartTime) / 1000).toFixed(1);

        if (pageSuccess) {
          chapterPages = chapterPages.map((p) =>
            p.id === page.id
              ? {
                  ...p,
                  status: 'completed',
                  ocr_results,
                  translations,
                  processed_image,
                  source_image: jpegBase64 || p.source_image,
                }
              : p
          );

          completedCount++;
          chapterJob.completed_pages = completedCount;
          callbacks.onActiveJobUpdate({ ...chapterJob }, [...chapterPages]);

          await addLog(
            session,
            `[COMPLETED] Trang ${index + 1}/${resolvedImages.length}: Thành công (${ocr_results.length} thoại) trong ${durationSec}s.`,
            callbacks
          );
        } else {
          chapterPages = chapterPages.map((p) =>
            p.id === page.id
              ? {
                  ...p,
                  status: 'failed',
                  error_message: lastErrorMessage,
                  detailed_error: pageClassifiedErr || undefined,
                }
              : p
          );
          callbacks.onActiveJobUpdate({ ...chapterJob }, [...chapterPages]);

          await addLog(
            session,
            `[FAILED] Trang ${index + 1}/${resolvedImages.length}: Thất bại hoàn toàn sau ${MAX_PAGE_RETRIES} lượt thử. Lỗi: ${lastErrorMessage}`,
            callbacks
          );
        }
      }
    };

    const workerCount = Math.min(CONCURRENCY_LIMIT, chapterPages.length);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    if (callbacks.shouldAbort()) {
      session = { ...session, status: 'paused', lastUpdated: new Date().toISOString() };
      await addLog(session, `[PAUSED] Đã dừng tiến trình dịch hàng loạt.`, callbacks);
      return session;
    }

    if (fatalError) {
      session = {
        ...session,
        status: 'failed',
        errorMessage: (fatalError as DetailedError).message,
        detailedError: fatalError as DetailedError,
        lastUpdated: new Date().toISOString(),
      };
      await addLog(session, `[FAILED] Lỗi hệ thống nghiêm trọng: ${(fatalError as DetailedError).message}`, callbacks);
      return session;
    }

    const allPagesSucceeded = completedCount === resolvedImages.length;
    const chapterTotalTime = ((Date.now() - chapterStartTime) / 1000).toFixed(1);

    // Step E: STRICT VERIFICATION: ONLY mark as COMPLETED if all pages completed successfully
    if (allPagesSucceeded) {
      let recentItem: RecentItem = {
        id: jobId,
        title: chapterTitle,
        folderId: folder.id,
        folderName: folder.name,
        sourceUrl: currentUrl,
        thumbnail: chapterPages[0]?.processed_image || resolvedImages[0],
        totalPages: resolvedImages.length,
        completedPages: completedCount,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        job: {
          ...chapterJob,
          status: 'completed',
          completed_pages: completedCount,
        },
        pages: chapterPages,
      };

      await saveRecentItemToStorage(recentItem);

      // Ask for folder selection if it is still pending
      if (folder.id === 'pending' && callbacks.onRequireFolderSelection) {
        await addLog(session, `[PENDING] Chương "${chapterTitle}" đã dịch xong. Đang chờ bạn chọn hoặc tạo thư mục để lưu bộ truyện...`, callbacks);
        try {
          const selectedFolder = await callbacks.onRequireFolderSelection(seriesName);
          folder = selectedFolder;
          session.folderId = folder.id;

          // Update recentItem with selected folder info
          recentItem.folderId = folder.id;
          recentItem.folderName = folder.name;
          await saveRecentItemToStorage(recentItem);

          await addLog(session, `[SUCCESS] Đã chọn thư mục "${folder.name}". Các chương sau sẽ tự động lưu vào đây.`, callbacks);
        } catch (folderErr) {
          console.error('Folder selection cancelled/failed:', folderErr);
          // Fallback to auto-creating folder if selection is cancelled/failed so we don't get stuck
          const fallbackFolder = await findOrCreateFolderForSeries(seriesName, seriesBaseUrl);
          folder = fallbackFolder;
          session.folderId = folder.id;

          recentItem.folderId = folder.id;
          recentItem.folderName = folder.name;
          await saveRecentItemToStorage(recentItem);

          await addLog(session, `[INFO] Tự động tạo thư mục mặc định "${folder.name}".`, callbacks);
        }
      }

      const summary: BatchChapterSummary = {
        chapterNumber: chapterNum,
        title: chapterTitle,
        url: currentUrl,
        pageCount: completedCount,
        completedAt: new Date().toISOString(),
        recentItemId: jobId,
      };

      session.completedChapters = [...session.completedChapters, summary];
      session.consecutiveErrors = 0;
      session.lastUpdated = new Date().toISOString();
      callbacks.onChapterCompleted(summary, recentItem);
      callbacks.onSessionUpdate({ ...session });
      await saveBatchSession(session);

      await addLog(
        session,
        `[COMPLETED] Hoàn thành chương "${chapterTitle}" (${completedCount}/${resolvedImages.length} trang) trong ${chapterTotalTime}s.`,
        callbacks
      );
    } else {
      // PARTIAL / FAILED chapter processing
      // We save the partial work to IndexedDB so they don't have to translate succeeded pages again
      const recentItem: RecentItem = {
        id: jobId,
        title: chapterTitle,
        folderId: folder.id,
        folderName: folder.name,
        sourceUrl: currentUrl,
        thumbnail: chapterPages[0]?.processed_image || resolvedImages[0],
        totalPages: resolvedImages.length,
        completedPages: completedCount,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        job: {
          ...chapterJob,
          status: 'failed',
          completed_pages: completedCount,
          error_message: `Dịch dở dang: chỉ hoàn thành ${completedCount}/${resolvedImages.length} trang.`,
        },
        pages: chapterPages,
      };

      await saveRecentItemToStorage(recentItem);

      session.status = 'failed';
      session.errorMessage = `Dịch dở dang tại ${chapterTitle}: Chỉ hoàn tất ${completedCount}/${resolvedImages.length} trang. Lỗi: ${lastErrorMessage}`;
      session.lastUpdated = new Date().toISOString();
      callbacks.onSessionUpdate({ ...session });
      await saveBatchSession(session);

      await addLog(
        session,
        `[PARTIAL] Chương "${chapterTitle}" chưa dịch hoàn thành (${completedCount}/${resolvedImages.length} trang thành công). Tạm thời dừng tiến trình để chờ người dùng khắc phục mạng/API và nhấn "Thử lại".`,
        callbacks
      );
      return session;
    }

    // Step F: Compute next chapter URL (Only reached if current chapter is 100% completed!)
    if (currentAnalysis.isRecognized && currentAnalysis.nextUrl) {
      currentUrl = currentAnalysis.nextUrl;
      currentChapterNum = currentAnalysis.nextChapterNumber;
      session.currentUrl = currentUrl;
      session.currentChapterNumber = currentChapterNum;
      callbacks.onSessionUpdate({ ...session });
      await saveBatchSession(session);

      // Polite pause between chapters to respect API rate limits (1200ms)
      await new Promise((r) => setTimeout(r, 1200));
    } else {
      await addLog(session, `[COMPLETED] Đã đến chương cuối cùng (Không tìm thấy liên kết chương tiếp theo). Hoàn tất!`, callbacks);
      session.status = 'completed';
      session.lastUpdated = new Date().toISOString();
      callbacks.onSessionUpdate({ ...session });
      await saveBatchSession(session);
      callbacks.onBatchFinished(session);
      return session;
    }
  }

  session.status = 'completed';
  session.lastUpdated = new Date().toISOString();
  callbacks.onSessionUpdate({ ...session });
  await saveBatchSession(session);
  callbacks.onBatchFinished(session);
  return session;
}
