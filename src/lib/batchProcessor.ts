import {
  extractComicImagesClient,
  ensureImageAsJpegBase64,
  runOcrAndTranslationClient,
  renderInpaintedTranslatedImageClient,
} from './clientPipeline';
import {
  saveRecentItemToStorage,
  getRecentItemsFromStorage,
  findOrCreateFolderForSeries,
  saveBatchSession,
  generatePageCacheKey,
  getCachedPageTranslation,
  saveCachedPageTranslation,
} from './storage';
import { analyzeChapterUrl } from './chapterUrlUtils';
import { classifyPipelineError } from './errorUtils';
import {
  MangaJob,
  MangaPage,
  RecentItem,
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
}

/**
 * Executes a full multi-chapter batch translation loop:
 * Fetches chapter -> OCR & Translation -> Inpainting -> Saves to Folder -> Advances to next chapter.
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

  // 1. Find or create the manga folder for this series
  const folder = await findOrCreateFolderForSeries(seriesName);

  // 2. Initialize or restore session
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
        folderId: folder.id,
        sourceLang,
        targetLang,
        initialUrl: initialUrl.trim(),
        currentUrl: initialUrl.trim(),
        currentChapterNumber: analysis.currentChapterNumber,
        completedChapters: [],
        status: 'running',
        consecutiveErrors: 0,
        lastUpdated: new Date().toISOString(),
        maxChapters: 100, // Safe upper limit
      };

  callbacks.onSessionUpdate({ ...session });
  await saveBatchSession(session);

  let currentUrl = session.currentUrl;
  let currentChapterNum = session.currentChapterNumber;
  let loopCount = 0;
  const MAX_CHAPTERS = session.maxChapters || 100;

  while (loopCount < MAX_CHAPTERS) {
    if (callbacks.shouldAbort()) {
      session = { ...session, status: 'paused', lastUpdated: new Date().toISOString() };
      callbacks.onSessionUpdate({ ...session });
      await saveBatchSession(session);
      return session;
    }

    loopCount++;
    const currentAnalysis = analyzeChapterUrl(currentUrl);
    const chapterTitle = currentAnalysis.currentChapterTitle || `Chương ${currentChapterNum}`;

    console.log(`🚀 [RiXia Batch] Bắt đầu xử lý: ${seriesName} - ${chapterTitle} (${currentUrl})`);

    // Step A: Check if this chapter was already completed before
    const existingRecents = await getRecentItemsFromStorage();
    const alreadySaved = existingRecents.find(
      (r) =>
        r.sourceUrl === currentUrl ||
        (r.folderId === folder.id && r.title.toLowerCase() === chapterTitle.toLowerCase())
    );

    if (alreadySaved && alreadySaved.completedPages > 0) {
      console.log(`⏩ [RiXia Batch] Chương ${chapterTitle} đã dịch trước đó trong bộ nhớ. Bỏ qua tải lại.`);
      const summary: BatchChapterSummary = {
        chapterNumber: currentChapterNum,
        title: alreadySaved.title,
        url: currentUrl,
        pageCount: alreadySaved.totalPages,
        completedAt: new Date().toISOString(),
        recentItemId: alreadySaved.id,
      };

      if (!session.completedChapters.some((c) => c.url === currentUrl)) {
        session.completedChapters = [...session.completedChapters, summary];
      }

      // Check next chapter
      if (currentAnalysis.isRecognized && currentAnalysis.nextUrl) {
        currentUrl = currentAnalysis.nextUrl;
        currentChapterNum = currentAnalysis.nextChapterNumber;
        session.currentUrl = currentUrl;
        session.currentChapterNumber = currentChapterNum;
        callbacks.onSessionUpdate({ ...session });
        await saveBatchSession(session);
        continue;
      } else {
        session.status = 'completed';
        session.lastUpdated = new Date().toISOString();
        callbacks.onSessionUpdate({ ...session });
        await saveBatchSession(session);
        callbacks.onBatchFinished(session);
        return session;
      }
    }

    // Step B: Scrape images for current chapter with bounded retry mechanism (2-3 retries)
    let resolvedImages: string[] = [];
    let scrapeRetryCount = 0;
    const MAX_SCRAPE_RETRIES = 2;
    let scrapeError: any = null;

    while (scrapeRetryCount <= MAX_SCRAPE_RETRIES) {
      if (callbacks.shouldAbort()) {
        session = { ...session, status: 'paused', lastUpdated: new Date().toISOString() };
        callbacks.onSessionUpdate({ ...session });
        await saveBatchSession(session);
        return session;
      }

      try {
        const scrapeResult = await extractComicImagesClient(currentUrl);
        if (scrapeResult && scrapeResult.images && scrapeResult.images.length > 0) {
          resolvedImages = scrapeResult.images;
          break;
        } else {
          throw new Error('NO_IMAGES_FOUND: Không tìm thấy ảnh truyện trong chương này.');
        }
      } catch (err: any) {
        scrapeError = err;
        scrapeRetryCount++;
        if (scrapeRetryCount <= MAX_SCRAPE_RETRIES) {
          console.warn(`⚠️ [RiXia Batch] Thử tải lại ảnh chương (${scrapeRetryCount}/${MAX_SCRAPE_RETRIES}) sau 2s...`);
          await new Promise((r) => setTimeout(r, 2000));
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
        // We reached the end of the comic series!
        console.log(`🏁 [RiXia Batch] Đã hết các chương truyện hoặc không tìm thấy chương mới. Hoàn tất dịch toàn bộ!`);
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
        const classified = classifyPipelineError(scrapeError || new Error('Không thể tải ảnh chương'));
        session = {
          ...session,
          status: 'failed',
          errorMessage: `Dừng tại ${chapterTitle}: ${classified.message}`,
          detailedError: classified,
          lastUpdated: new Date().toISOString(),
        };
        callbacks.onSessionUpdate({ ...session });
        await saveBatchSession(session);
        return session;
      }
    }

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

    // Step D: Process chapter pages with optimal worker pool (Concurrency: 3) & IndexedDB Cache
    const CONCURRENCY_LIMIT = 3;
    let completedCount = 0;
    let isChapterAborted = false;
    let fatalError: DetailedError | null = null;

    const queue = chapterPages.map((page, index) => ({ page, index }));
    let nextQueueIndex = 0;

    const worker = async () => {
      while (nextQueueIndex < queue.length && !isChapterAborted) {
        if (callbacks.shouldAbort()) {
          isChapterAborted = true;
          return;
        }

        const currentTask = queue[nextQueueIndex++];
        const { page, index } = currentTask;

        // Update page status to processing
        chapterPages = chapterPages.map((p) => (p.id === page.id ? { ...p, status: 'processing' } : p));
        chapterJob.current_page = index + 1;
        callbacks.onActiveJobUpdate({ ...chapterJob }, [...chapterPages]);

        try {
          // Check IndexedDB Cache first
          const cacheKey = await generatePageCacheKey(page.source_image, sourceLang, targetLang);
          const cached = await getCachedPageTranslation(cacheKey);

          let ocr_results: OCRBoxItem[];
          let translations: TranslationItem[];
          let jpegBase64: string;
          let processed_image: string;

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

          if (callbacks.shouldAbort()) {
            isChapterAborted = true;
            return;
          }

          // Mark page as completed
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
        } catch (pageErr: any) {
          console.error(`Batch page ${index + 1} error:`, pageErr);
          const classified = classifyPipelineError(pageErr);
          chapterPages = chapterPages.map((p) =>
            p.id === page.id
              ? {
                  ...p,
                  status: 'failed',
                  error_message: classified.message,
                  detailed_error: classified,
                }
              : p
          );
          callbacks.onActiveJobUpdate({ ...chapterJob }, [...chapterPages]);

          if (classified.category === 'API_KEY_INVALID' || classified.category === 'API_KEY_MISSING') {
            fatalError = classified;
            isChapterAborted = true;
            break;
          }
        }
      }
    };

    const workerCount = Math.min(CONCURRENCY_LIMIT, chapterPages.length);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    if (callbacks.shouldAbort()) {
      session = { ...session, status: 'paused', lastUpdated: new Date().toISOString() };
      callbacks.onSessionUpdate({ ...session });
      await saveBatchSession(session);
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
      callbacks.onSessionUpdate({ ...session });
      await saveBatchSession(session);
      return session;
    }

    // Step E: If chapter produced completed pages, save into MangaFolder
    if (completedCount > 0) {
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
          status: 'completed',
          completed_pages: completedCount,
        },
        pages: chapterPages,
      };

      await saveRecentItemToStorage(recentItem);

      const summary: BatchChapterSummary = {
        chapterNumber: currentChapterNum,
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
    } else {
      // 0 pages succeeded
      session.consecutiveErrors = (session.consecutiveErrors || 0) + 1;
      if (session.consecutiveErrors >= 2) {
        session.status = 'failed';
        session.errorMessage = `Không thể hoàn tất dịch chương ${chapterTitle}.`;
        callbacks.onSessionUpdate({ ...session });
        await saveBatchSession(session);
        return session;
      }
    }

    // Step F: Compute next chapter URL
    if (currentAnalysis.isRecognized && currentAnalysis.nextUrl) {
      currentUrl = currentAnalysis.nextUrl;
      currentChapterNum = currentAnalysis.nextChapterNumber;
      session.currentUrl = currentUrl;
      session.currentChapterNumber = currentChapterNum;
      callbacks.onSessionUpdate({ ...session });
      await saveBatchSession(session);

      // Polite pause between chapters (800ms)
      await new Promise((r) => setTimeout(r, 800));
    } else {
      // URL does not follow simple sequential rules
      console.log(`ℹ️ [RiXia Batch] URL tiếp theo không theo quy luật tăng số đơn giản. Tạm dừng để người dùng tiếp tục thủ công.`);
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
