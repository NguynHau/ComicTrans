import React, { useState, useEffect, useRef } from 'react';
import { LiquidGlassIsland } from './components/LiquidGlassIsland';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OrientationLock } from './components/OrientationLock';
import { UrlInputCard } from './components/UrlInputCard';
import { JobProgressCard } from './components/JobProgressCard';
import { BatchProgressCard } from './components/BatchProgressCard';
import { MangaReader } from './components/MangaReader';
import { SavedMangaViewer } from './components/SavedMangaViewer';
import { FolderChaptersModal } from './components/FolderChaptersModal';
import { ApiDocsModal } from './components/ApiDocsModal';
import { SettingsModal } from './components/SettingsModal';
import { UpdateModal } from './components/UpdateModal';
import {
  MangaJob,
  MangaPage,
  RecentItem,
  MangaFolder,
  DetailedError,
  OCRBoxItem,
  TranslationItem,
  BatchTranslationSession,
} from './types';
import { 
  RefreshCw, BookOpen, Key, Sparkles, ShieldCheck, 
  CheckCircle2, AlertCircle, ArrowUpCircle, ExternalLink,
  Folder, Plus, FolderPlus, Trash2, ArrowLeft
} from 'lucide-react';
import {
  extractComicImagesClient,
  runOcrAndTranslationClient,
  renderInpaintedTranslatedImageClient,
  ensureImageAsJpegBase64,
} from './lib/clientPipeline';
import { classifyPipelineError, testGeminiApiKey } from './lib/errorUtils';
import { checkForAppUpdate, applyAppUpdate, CURRENT_VERSION, CheckUpdateResult } from './lib/updateChecker';
import {
  getFoldersFromStorage,
  getRecentItemsFromStorage,
  saveFoldersToStorage,
  saveRecentItemToStorage,
  deleteRecentItemFromStorage,
  generatePageCacheKey,
  getCachedPageTranslation,
  saveCachedPageTranslation,
  saveBatchSession,
  getActiveBatchSession,
} from './lib/storage';
import { runBatchTranslationLoop } from './lib/batchProcessor';

export function App() {
  const [activeJob, setActiveJob] = useState<MangaJob | null>(null);
  const [activeBatchSession, setActiveBatchSession] = useState<BatchTranslationSession | null>(null);
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<DetailedError | null>(null);
  const [isApiDocsModalOpen, setIsApiDocsModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'home' | 'manga' | 'update' | 'settings'>('home');
  const [showReader, setShowReader] = useState(false);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [folders, setFolders] = useState<MangaFolder[]>([]);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [selectedSavedManga, setSelectedSavedManga] = useState<RecentItem | null>(null);
  const [activeFolderForSheet, setActiveFolderForSheet] = useState<{ id: string; name: string } | null>(null);

  // Update checking state
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<CheckUpdateResult | null>(null);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);

  // Batch control ref
  const abortBatchRef = useRef<boolean>(false);

  // Settings config state
  const [settingsApiKey, setSettingsApiKey] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsTestState, setSettingsTestState] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message?: string;
    model?: string;
  }>({ status: 'idle' });

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const storedRecents = await getRecentItemsFromStorage();
        const storedFolders = await getFoldersFromStorage();
        if (isMounted) {
          setRecents(storedRecents);
          setFolders(storedFolders);
        }
      } catch (err) {
        console.warn('Failed to load recents/folders:', err);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderNameInput.trim()) return;
    try {
      const newFolder: MangaFolder = {
        id: 'folder_' + Date.now(),
        name: newFolderNameInput.trim(),
        createdAt: new Date().toISOString(),
      };
      const updated = [newFolder, ...folders];
      setFolders(updated);
      await saveFoldersToStorage(updated);
      setNewFolderNameInput('');
      setIsCreateFolderModalOpen(false);
    } catch (err) {
      console.warn('Failed to create folder:', err);
    }
  };

  const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn xóa thư mục này? Các chương truyện trong thư mục sẽ chuyển về chưa phân loại.')) return;
    try {
      const updatedFolders = folders.filter(f => f.id !== folderId);
      setFolders(updatedFolders);
      await saveFoldersToStorage(updatedFolders);

      const updatedRecents = recents.map(r => r.folderId === folderId ? { ...r, folderId: undefined, folderName: undefined } : r);
      setRecents(updatedRecents);
      for (const r of updatedRecents) {
        if (r.folderId === undefined) {
          saveRecentItemToStorage(r);
        }
      }
    } catch (err) {
      console.warn('Failed to delete folder:', err);
    }
  };

  const handleMoveRecentToFolder = async (recentId: string, folderId: string) => {
    try {
      const targetFolder = folders.find(f => f.id === folderId);
      const updatedRecents = recents.map(r => {
        if (r.id === recentId) {
          return {
            ...r,
            folderId: folderId === 'uncategorized' ? undefined : folderId,
            folderName: folderId === 'uncategorized' ? undefined : (targetFolder ? targetFolder.name : undefined)
          };
        }
        return r;
      });
      setRecents(updatedRecents);
      const updatedItem = updatedRecents.find(r => r.id === recentId);
      if (updatedItem) {
        await saveRecentItemToStorage(updatedItem);
      }
    } catch (err) {
      console.warn('Failed to move chapter to folder:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      const storedKey = localStorage.getItem('GEMINI_API_KEY') || '';
      setSettingsApiKey(storedKey);
      setSettingsSaved(false);
      setSettingsTestState({ status: 'idle' });
    }
  }, [activeTab]);

  useEffect(() => {
    const runCheckUpdate = async (isManualTab = false) => {
      if (isManualTab) {
        setCheckingUpdate(true);
        setUpdateResult(null);
      }
      const res = await checkForAppUpdate();
      setUpdateResult(res);
      if (isManualTab) {
        setCheckingUpdate(false);
      }
    };

    if (activeTab === 'update') {
      runCheckUpdate(true);
    }
  }, [activeTab]);

  // Automatic background update check on initial mount, focus, and every 5 minutes
  useEffect(() => {
    const checkBg = async () => {
      try {
        const res = await checkForAppUpdate();
        setUpdateResult(res);
      } catch (e) {
        // ignore background errors
      }
    };

    checkBg();
    const timer = setInterval(checkBg, 5 * 60 * 1000);

    const handleFocus = () => {
      checkBg();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Keep a ref to track current active job for cancellation inside the loop
  const activeJobRef = useRef<MangaJob | null>(null);
  useEffect(() => {
    activeJobRef.current = activeJob;
  }, [activeJob]);

  // Load existing active batch session on mount
  useEffect(() => {
    getActiveBatchSession().then((session) => {
      if (session && (session.status === 'running' || session.status === 'paused')) {
        setActiveBatchSession(session);
      }
    });
  }, []);

  const startBatchTranslation = async (
    url: string,
    sourceLang: string,
    targetLang: string,
    resumeSession?: BatchTranslationSession | null
  ) => {
    setIsLoading(true);
    setErrorMessage(null);
    setDetailedError(null);
    abortBatchRef.current = false;

    const apiKey = localStorage.getItem('GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      const missingKeyErr = classifyPipelineError(new Error('API_KEY_MISSING'));
      setDetailedError(missingKeyErr);
      setErrorMessage(missingKeyErr.message);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);

    try {
      await runBatchTranslationLoop(
        url,
        sourceLang,
        targetLang,
        apiKey,
        {
          onSessionUpdate: (session) => {
            setActiveBatchSession({ ...session });
          },
          onActiveJobUpdate: (job, jobPages) => {
            setActiveJob({ ...job });
            setPages([...jobPages]);
          },
          onChapterCompleted: (summary, recentItem) => {
            setRecents((prev) => [recentItem, ...prev.filter((x) => x.id !== recentItem.id)]);
            getFoldersFromStorage().then((f) => setFolders(f));
          },
          onBatchFinished: (session) => {
            setActiveBatchSession({ ...session });
          },
          shouldAbort: () => abortBatchRef.current,
        },
        resumeSession
      );
    } catch (err: any) {
      console.error('Batch loop failed:', err);
      const classified = classifyPipelineError(err);
      setDetailedError(classified);
      setErrorMessage(classified.message);
    }
  };

  const handlePauseBatch = () => {
    abortBatchRef.current = true;
    if (activeBatchSession) {
      const updated: BatchTranslationSession = {
        ...activeBatchSession,
        status: 'paused',
        lastUpdated: new Date().toISOString(),
      };
      setActiveBatchSession(updated);
      saveBatchSession(updated);
    }
  };

  const handleResumeBatch = () => {
    if (activeBatchSession) {
      abortBatchRef.current = false;
      startBatchTranslation(
        activeBatchSession.currentUrl,
        activeBatchSession.sourceLang,
        activeBatchSession.targetLang,
        activeBatchSession
      );
    }
  };

  const handleStopBatch = () => {
    abortBatchRef.current = true;
    if (activeBatchSession) {
      const updated: BatchTranslationSession = {
        ...activeBatchSession,
        status: 'stopped',
        lastUpdated: new Date().toISOString(),
      };
      setActiveBatchSession(updated);
      saveBatchSession(updated);
    }
  };

  const handleStartTranslation = async (
    url: string,
    sourceLang: string,
    targetLang: string,
    images?: string[],
    isBatchMode?: boolean
  ) => {
    if (isBatchMode && url.trim()) {
      startBatchTranslation(url.trim(), sourceLang, targetLang);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setDetailedError(null);
    setActiveJob(null);
    setActiveBatchSession(null);
    setPages([]);

    // 1. Get the API Key
    const apiKey = localStorage.getItem('GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      const missingKeyErr = classifyPipelineError(new Error('API_KEY_MISSING'));
      setDetailedError(missingKeyErr);
      setErrorMessage(missingKeyErr.message);
      setIsLoading(false);
      return;
    }

    const job_id = "job_" + Date.now();
    
    // Set status to analyzing first
    const initialJob: MangaJob = {
      job_id,
      status: 'analyzing',
      source_url: url || 'upload://custom-images',
      source_language: sourceLang,
      target_language: targetLang,
      total_pages: images ? images.length : 1,
      completed_pages: 0,
      current_page: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setActiveJob(initialJob);

    try {
      // 2. Resolve image list
      let resolvedImages: string[] = [];
      if (images && images.length > 0) {
        resolvedImages = images;
      } else {
        const result = await extractComicImagesClient(url);
        resolvedImages = result.images;
      }

      if (resolvedImages.length === 0) {
        throw new Error("NO_IMAGES_FOUND: Không phát hiện trang ảnh nào từ nguồn này.");
      }

      // Check if job was cancelled
      if ((activeJobRef.current?.status as string) === 'cancelled' || activeJobRef.current?.job_id !== job_id) {
        return;
      }

      // 3. Create pages
      const initialPages: MangaPage[] = resolvedImages.map((src, idx) => ({
        id: `page_${job_id}_${idx + 1}`,
        job_id,
        page_number: idx + 1,
        source_image: src,
        status: 'queued',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ocr_results: [],
        translations: [],
      }));

      setPages(initialPages);
      setIsLoading(false); // Done with starting loader, now JobProgressCard will render

      // Update job to processing
      setActiveJob({
        ...initialJob,
        status: 'processing',
        total_pages: resolvedImages.length,
      });
      
      // Explicitly show reader on start
      setShowReader(true);

      // 4. Process pages concurrently with optimal worker pool (Concurrency: 4) & IndexedDB Cache
      const CONCURRENCY_LIMIT = 4;
      let completedCount = 0;
      let lastFailureError: DetailedError | null = null;
      let currentPagesArray = [...initialPages];
      let isAborted = false;

      // Helper function to persist progress incrementally to prevent data loss
      const persistCurrentProgress = (completed: number, pagesSnapshot: MangaPage[]) => {
        try {
          const recentItem: RecentItem = {
            id: job_id,
            title: url
              ? (url.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ') || 'Chương truyện')
              : 'Tệp tải lên cá nhân',
            sourceUrl: url,
            thumbnail: pagesSnapshot[0]?.processed_image || resolvedImages[0],
            totalPages: resolvedImages.length,
            completedPages: completed,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            job: {
              ...initialJob,
              status: completed === resolvedImages.length ? 'completed' : 'processing',
              completed_pages: completed,
              total_pages: resolvedImages.length,
            },
            pages: pagesSnapshot,
          };
          saveRecentItemToStorage(recentItem).catch(() => {});
        } catch {
          // ignore
        }
      };

      const queue = initialPages.map((page, index) => ({ page, index }));
      let nextQueueIndex = 0;

      const worker = async () => {
        while (nextQueueIndex < queue.length && !isAborted) {
          // Double check cancellation
          if ((activeJobRef.current?.status as string) === 'cancelled' || activeJobRef.current?.job_id !== job_id) {
            isAborted = true;
            return;
          }

          const currentTaskIndex = nextQueueIndex++;
          const { page, index } = queue[currentTaskIndex];

          // Update job's current page indicator
          setActiveJob(prev => prev && prev.job_id === job_id ? {
            ...prev,
            current_page: Math.max(prev.current_page || 1, index + 1),
          } : prev);

          // Update page status to processing
          currentPagesArray = currentPagesArray.map(p => p.id === page.id ? { ...p, status: 'processing' } : p);
          setPages([...currentPagesArray]);

          const tStart = performance.now();
          let cacheHit = false;
          let tFetch = 0;
          let tGemini = 0;
          let tRender = 0;

          try {
            // Step A: Check IndexedDB Cache first
            const cacheKey = await generatePageCacheKey(page.source_image, sourceLang, targetLang);
            const cached = await getCachedPageTranslation(cacheKey);

            let ocr_results: OCRBoxItem[];
            let translations: TranslationItem[];
            let jpegBase64: string;
            let processed_image: string;

            if (cached && cached.ocr_results?.length > 0 && cached.translations?.length > 0) {
              cacheHit = true;
              ocr_results = cached.ocr_results;
              translations = cached.translations;
              jpegBase64 = cached.source_image || page.source_image;
              processed_image = cached.processed_image || await renderInpaintedTranslatedImageClient(
                jpegBase64,
                ocr_results,
                translations
              );
            } else {
              // Cache miss: Execute OCR -> Translation -> Inpainting pipeline with live timing
              const t0 = performance.now();
              const rawJpeg = await ensureImageAsJpegBase64(page.source_image);
              tFetch = Math.round(performance.now() - t0);

              const t1 = performance.now();
              const apiRes = await runOcrAndTranslationClient(
                rawJpeg,
                sourceLang,
                targetLang,
                apiKey,
                index + 1
              );
              tGemini = Math.round(performance.now() - t1);

              ocr_results = apiRes.ocr_results;
              translations = apiRes.translations;
              jpegBase64 = apiRes.jpegBase64;

              const t2 = performance.now();
              processed_image = await renderInpaintedTranslatedImageClient(
                jpegBase64 || page.source_image,
                ocr_results,
                translations
              );
              tRender = Math.round(performance.now() - t2);

              // Cache page in IndexedDB for instant future loads
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

            const totalTime = Math.round(performance.now() - tStart);
            console.log(
              `⏱️ [RiXia Pipeline] Trang ${index + 1}/${initialPages.length}: ${totalTime}ms (Tải ảnh: ${tFetch}ms, OCR & Dịch AI: ${tGemini}ms, Render: ${tRender}ms) [Cache: ${cacheHit ? 'HIT' : 'MISS'}]`
            );

            // Double check cancellation before updating React state
            if ((activeJobRef.current?.status as string) === 'cancelled' || activeJobRef.current?.job_id !== job_id) {
              isAborted = true;
              return;
            }

            // Update page to completed
            currentPagesArray = currentPagesArray.map(p => p.id === page.id ? {
              ...p,
              status: 'completed',
              ocr_results,
              translations,
              processed_image,
              source_image: jpegBase64 || p.source_image,
              detailed_error: undefined,
              error_message: undefined,
            } : p);
            setPages([...currentPagesArray]);

            completedCount++;

            // Update job progress
            setActiveJob(prev => prev && prev.job_id === job_id ? {
              ...prev,
              completed_pages: completedCount,
            } : prev);

            // Incremental backup to storage
            if (completedCount % 2 === 0 || completedCount === initialPages.length) {
              persistCurrentProgress(completedCount, currentPagesArray);
            }

          } catch (err: any) {
            console.error(`Page ${index + 1} failed:`, err);
            const classified = classifyPipelineError(err);
            lastFailureError = classified;

            // Update page to failed without overwriting any completed page
            currentPagesArray = currentPagesArray.map(p => p.id === page.id ? {
              ...p,
              status: 'failed',
              error_message: classified.message,
              detailed_error: classified,
            } : p);
            setPages([...currentPagesArray]);

            // If API Key is invalid or missing, stop all workers immediately
            if (classified.category === 'API_KEY_INVALID' || classified.category === 'API_KEY_MISSING') {
              isAborted = true;
              break;
            }
          }
        }
      };

      // Spawn concurrent worker pool
      const workerCount = Math.min(CONCURRENCY_LIMIT, initialPages.length);
      const workers = Array.from({ length: workerCount }, () => worker());
      await Promise.all(workers);

      // 5. Finalize Job Status & Save to Recents
      if (completedCount > 0) {
        persistCurrentProgress(completedCount, currentPagesArray);
      }

      setActiveJob(prev => {
        if (!prev || prev.job_id !== job_id) return prev;
        if (prev.status === 'cancelled') return prev;
        
        const hasCompleted = completedCount > 0;
        return {
          ...prev,
          status: hasCompleted ? 'completed' : 'failed',
          completed_pages: completedCount,
          error_message: hasCompleted ? undefined : (lastFailureError?.message || 'Tất cả các trang đều dịch thất bại.'),
          detailed_error: hasCompleted ? undefined : (lastFailureError || undefined),
        };
      });

    } catch (err: any) {
      console.error(err);
      const classified = classifyPipelineError(err);
      setDetailedError(classified);
      setErrorMessage(classified.message);
      setIsLoading(false);
      setActiveJob(prev => prev && prev.job_id === job_id ? {
        ...prev,
        status: 'failed',
        error_message: classified.message,
        detailed_error: classified,
      } : prev);
    }
  };

  const handleCancelJob = async () => {
    setActiveJob((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
  };

  const handleResumeRecent = (item: RecentItem) => {
    setActiveJob(item.job);
    setPages(item.pages);
    setShowReader(true);
  };

  const handleRetryPage = async (pageId: string) => {
    if (!activeJob) return;
    const pageIndex = pages.findIndex((p) => p.id === pageId);
    if (pageIndex === -1) return;
    const page = pages[pageIndex];

    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, status: 'processing', error_message: undefined, detailed_error: undefined } : p))
    );

    try {
      const apiKey = localStorage.getItem('GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || '';
      if (!apiKey) {
        throw new Error("API_KEY_MISSING: Chưa tìm thấy Gemini API Key.");
      }

      const tStart = performance.now();
      const rawJpeg = await ensureImageAsJpegBase64(page.source_image);
      const { ocr_results, translations, jpegBase64 } = await runOcrAndTranslationClient(
        rawJpeg,
        activeJob.source_language,
        activeJob.target_language,
        apiKey,
        page.page_number
      );

      const processed_image = await renderInpaintedTranslatedImageClient(
        jpegBase64 || rawJpeg,
        ocr_results,
        translations
      );

      // Save to cache
      const cacheKey = await generatePageCacheKey(page.source_image, activeJob.source_language, activeJob.target_language);
      await saveCachedPageTranslation({
        cacheKey,
        sourceLang: activeJob.source_language,
        targetLang: activeJob.target_language,
        ocr_results,
        translations,
        processed_image,
        source_image: jpegBase64 || rawJpeg,
        timestamp: Date.now(),
      });

      console.log(`⏱️ [RiXia Retry] Trang ${page.page_number} dịch lại thành công trong ${Math.round(performance.now() - tStart)}ms`);

      setPages((prev) =>
        prev.map((p) =>
          p.id === pageId
            ? {
                ...p,
                status: 'completed',
                ocr_results,
                translations,
                processed_image,
                source_image: jpegBase64 || rawJpeg,
                detailed_error: undefined,
                error_message: undefined,
              }
            : p
        )
      );

      setActiveJob((prev) => {
        if (!prev) return null;
        const currentCompleted = pages.filter(p => p.status === 'completed' || p.id === pageId).length;
        return {
          ...prev,
          completed_pages: currentCompleted,
          status: 'completed',
          detailed_error: undefined,
        };
      });
    } catch (err: any) {
      console.error(err);
      const classified = classifyPipelineError(err);
      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? {
          ...p,
          status: 'failed',
          error_message: classified.message,
          detailed_error: classified,
        } : p))
      );
    }
  };

  const handleUpdateDialogue = (pageId: string, dialogueIndex: number, newText: string, updatedPage?: MangaPage) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        if (updatedPage) return updatedPage;
        const newTrans = [...(p.translations || [])];
        if (newTrans[dialogueIndex]) {
          newTrans[dialogueIndex] = { ...newTrans[dialogueIndex], translated_text: newText };
        }
        return { ...p, translations: newTrans };
      })
    );
  };

  const handleDeleteRecent = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    const updated = recents.filter(item => item.id !== id);
    setRecents(updated);
    await deleteRecentItemFromStorage(id);
  };

  const handleReset = () => {
    setActiveJob(null);
    setPages([]);
    setShowReader(false);
    setErrorMessage(null);
    setDetailedError(null);
  };

  const hasReaderView = pages.length > 0;

  const handleRunCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateResult(null);
    const res = await checkForAppUpdate();
    setUpdateResult(res);
    setCheckingUpdate(false);
  };

  useEffect(() => {
    if (activeTab === 'update') {
      handleRunCheckUpdate();
    }
  }, [activeTab]);

  const handleApplyUpdateAction = async () => {
    setIsUpdatingApp(true);
    await applyAppUpdate();
  };

  const hasEnvKey = !!import.meta.env.VITE_GEMINI_API_KEY;
  const activeKey = settingsApiKey.trim() || import.meta.env.VITE_GEMINI_API_KEY || '';

  const handleTestKeySettings = async () => {
    if (!activeKey) {
      setSettingsTestState({
        status: 'error',
        message: 'Chưa có API Key để kiểm tra. Vui lòng nhập API Key của bạn.',
      });
      return;
    }

    setSettingsTestState({ status: 'testing', message: 'Đang gửi yêu cầu kết nối thử...' });

    const result = await testGeminiApiKey(activeKey);
    if (result.ok) {
      setSettingsTestState({
        status: 'success',
        model: result.model,
        message: `API Key hoạt động hoàn hảo! Đã kết nối thành công tới model ${result.model}.`,
      });
    } else {
      setSettingsTestState({
        status: 'error',
        message: `${result.error?.title || 'Lỗi API Key'}: ${result.error?.message || 'Không thể xác thực'}`,
      });
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (settingsApiKey.trim()) {
      localStorage.setItem('GEMINI_API_KEY', settingsApiKey.trim());
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
    }
    setSettingsSaved(true);
    setTimeout(() => {
      setSettingsSaved(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-comic-panel text-zinc-100 flex flex-col font-serif-logo selection:bg-[#e06b3a] selection:text-white pb-44">
      {/* Orientation Lock (Blocks landscape rotation on mobile) */}
      <OrientationLock />

      {/* Offline Alert */}
      <OfflineIndicator />

      {/* Main Content Area: Strictly Mobile max-w-md with safe-area top padding */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-[max(env(safe-area-inset-top),24px)] pb-4 flex flex-col">
        {/* Render Tab 1: home */}
        {activeTab === 'home' && (
          <div className="w-full flex-1 flex flex-col space-y-4 animate-fadeIn">
            {/* Landing View: Matches Mockup Exactly */}
            {!activeJob && !activeBatchSession && (
              <UrlInputCard
                onSubmit={handleStartTranslation}
                isLoading={isLoading}
                errorMessage={errorMessage}
                detailedError={detailedError}
                onOpenSettings={() => setActiveTab('settings')}
                onResumeRecent={handleResumeRecent}
              />
            )}

            {/* Batch Translation Progress Card */}
            {activeBatchSession && (
              <div className="w-full space-y-4">
                <BatchProgressCard
                  session={activeBatchSession}
                  activeJob={activeJob}
                  onPause={handlePauseBatch}
                  onResume={handleResumeBatch}
                  onStop={handleStopBatch}
                  onOpenFolder={(folderId, folderName) => {
                    setActiveFolderForSheet({ id: folderId, name: folderName });
                  }}
                  onReadChapter={(recentItemId) => {
                    const found = recents.find((r) => r.id === recentItemId);
                    if (found) {
                      setSelectedSavedManga(found);
                    }
                  }}
                />

                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => {
                      if (activeBatchSession.status === 'running') {
                        if (!confirm('Tiến trình dịch đang chạy, bạn có chắc muốn quay về để dịch truyện khác?')) {
                          return;
                        }
                        handleStopBatch();
                      }
                      setActiveBatchSession(null);
                      setActiveJob(null);
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all text-sm font-bold shadow-lg"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Dịch truyện khác</span>
                  </button>
                </div>
              </div>
            )}

            {/* Single Job Progress View & Reader */}
            {activeJob && !activeBatchSession && (
              <div className="w-full space-y-4">
                <JobProgressCard
                  job={activeJob}
                  onCancel={handleCancelJob}
                  onRetry={() =>
                    handleStartTranslation(
                      activeJob.source_url,
                      activeJob.source_language,
                      activeJob.target_language
                    )
                  }
                  onOpenSettings={() => setActiveTab('settings')}
                  onSwitchToUpload={handleReset}
                />

                {/* If pages are loaded/processing, show reader */}
                {showReader && (
                  <MangaReader
                    job={activeJob}
                    pages={pages}
                    onRetryPage={handleRetryPage}
                    onUpdateDialogue={handleUpdateDialogue}
                    onReset={() => {
                      setShowReader(false);
                      handleReset();
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Render Tab 2: manga (Saved Manga Library) */}
        {activeTab === 'manga' && (
          <div className="w-full space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#e06b3a]" />
                  <span>Truyện đã lưu</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Các chương truyện và thư mục truyện bạn đã lưu trên trình duyệt.
                </p>
              </div>
              <button
                onClick={() => setIsCreateFolderModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#141417] hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 rounded-xl text-xs font-bold transition-all shadow-md"
              >
                <Plus className="w-4 h-4 text-[#e06b3a]" />
                <span>Tạo thư mục truyện</span>
              </button>
            </div>

            {recents.length === 0 && folders.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-4 bg-[#141417]/40 rounded-2xl border border-zinc-800/60 flex flex-col items-center justify-center">
                <div className="text-[#e06b3a] flex items-center justify-center">
                  <BookOpen className="w-10 h-10 stroke-[1.6]" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-zinc-300">Thư viện trống</p>
                  <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                    Bạn chưa có bản dịch nào được lưu. Hãy bắt đầu dịch chương truyện đầu tiên tại trang chủ nhé!
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('home')}
                  className="mt-2 text-xs font-bold text-white bg-[#e06b3a] hover:bg-[#ff7e40] px-4 py-2.5 rounded-xl transition-all shadow-md shadow-orange-950/40"
                >
                  Dịch ngay chương mới
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[65vh] overflow-y-auto pr-1">
                {/* Folder Cards */}
                {folders.map((folder) => {
                  const folderChapters = recents.filter((r) => r.folderId === folder.id);
                  const latestThumbnail = folderChapters[0]?.thumbnail;

                  return (
                    <div
                      key={folder.id}
                      onClick={() => setActiveFolderForSheet({ id: folder.id, name: folder.name })}
                      className="group bg-[#141417]/90 hover:bg-[#1a1a20] border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-4 flex items-center justify-between gap-3 transition-all cursor-pointer shadow-lg hover:shadow-orange-950/10"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-14 bg-zinc-900 rounded-xl overflow-hidden flex-shrink-0 border border-zinc-800 flex items-center justify-center text-[#e06b3a]">
                          {latestThumbnail ? (
                            <img
                              src={latestThumbnail}
                              alt={folder.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <Folder className="w-6 h-6" />
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <h3 className="text-sm font-extrabold text-zinc-100 truncate group-hover:text-[#e06b3a] transition-colors">
                            {folder.name}
                          </h3>
                          <p className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                              {folderChapters.length} chương
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteFolder(folder.id, e)}
                        className="text-zinc-500 hover:text-rose-400 p-2 rounded-xl hover:bg-rose-500/10 transition-colors flex-shrink-0"
                        title="Xóa thư mục"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                {/* Uncategorized Folder Card */}
                {recents.filter((r) => !r.folderId || !folders.some((f) => f.id === r.folderId)).length > 0 && (
                  <div
                    onClick={() => setActiveFolderForSheet({ id: 'uncategorized', name: 'Chương chưa phân loại' })}
                    className="group bg-[#141417]/90 hover:bg-[#1a1a20] border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-4 flex items-center justify-between gap-3 transition-all cursor-pointer shadow-lg"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-14 bg-zinc-900 rounded-xl overflow-hidden flex-shrink-0 border border-zinc-800 flex items-center justify-center text-[#e06b3a]">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h3 className="text-sm font-extrabold text-zinc-200 truncate group-hover:text-[#e06b3a] transition-colors">
                          Chưa phân loại
                        </h3>
                        <p className="text-[11px] text-zinc-400 font-semibold">
                          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                            {recents.filter((r) => !r.folderId || !folders.some((f) => f.id === r.folderId)).length} chương
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Render Tab 3: update */}
        {activeTab === 'update' && (
          <div className="w-full space-y-4 animate-fadeIn">
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#e06b3a]" />
                <span>Cập nhật Hệ thống</span>
              </h2>
              <p className="text-xs text-zinc-400">
                Kiểm tra và cài đặt phiên bản dịch thuật mới nhất.
              </p>
            </div>

            {/* Status Body */}
            {checkingUpdate && (
              <div className="p-8 text-center space-y-3 bg-[#141417] rounded-xl border border-zinc-800 shadow-sm">
                <RefreshCw className="w-8 h-8 text-[#e06b3a] animate-spin mx-auto" />
                <p className="text-xs font-semibold text-zinc-300">Đang tìm bản phát hành mới...</p>
              </div>
            )}

            {!checkingUpdate && updateResult && (
              <div className="space-y-3">
                {updateResult.hasUpdate ? (
                  <div className="p-4 rounded-xl bg-gradient-to-b from-orange-950/40 to-[#141417] border border-orange-500/40 space-y-3 shadow-md">
                    <div className="flex items-center gap-2 text-orange-400 font-bold text-sm">
                      <ArrowUpCircle className="w-5 h-5 flex-shrink-0 animate-bounce" />
                      <span>Đã có phiên bản mới v{updateResult.latestVersion}!</span>
                    </div>
                    {updateResult.description && (
                      <p className="text-xs text-zinc-300 bg-black/40 p-2.5 rounded-lg border border-zinc-800/60 leading-relaxed">
                        {updateResult.description}
                      </p>
                    )}
                    <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Toàn bộ API Key, Thư viện truyện dịch sẽ được bảo toàn 100%.</span>
                    </div>
                  </div>
                ) : updateResult.error ? (
                  <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300 shadow-sm">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-semibold text-rose-200">Lỗi kiểm tra:</p>
                      <p className="text-[11px] text-rose-300/80">{updateResult.error}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#141417] border border-emerald-500/20 flex items-center gap-3 text-xs text-emerald-300 shadow-sm">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-200 text-sm">Bạn đang ở phiên bản mới nhất!</p>
                      <p className="text-[11px] text-emerald-300/80 mt-0.5">
                        Ứng dụng đã được cập nhật đầy đủ các tính năng dịch thuật mới nhất.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Controls */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleRunCheckUpdate}
                disabled={checkingUpdate || isUpdatingApp}
                className="flex-1 py-2.5 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#e06b3a] ${checkingUpdate ? 'animate-spin' : ''}`} />
                <span>Kiểm tra lại</span>
              </button>

              {updateResult?.hasUpdate && (
                <button
                  type="button"
                  onClick={handleApplyUpdateAction}
                  disabled={isUpdatingApp}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-orange-600 to-[#e06b3a] hover:from-orange-500 hover:to-orange-600 rounded-xl transition-all shadow-md shadow-orange-900/40 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>{isUpdatingApp ? 'Đang tải...' : 'Cập nhật ngay'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Render Tab 4: settings */}
        {activeTab === 'settings' && (
          <div className="w-full space-y-4 animate-fadeIn">
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2">
                <Key className="w-5 h-5 text-[#e06b3a]" />
                <span>Cài đặt Gemini</span>
              </h2>
              <p className="text-xs text-zinc-400">
                Cấu hình mã khóa dịch thuật Google Gemini AI của riêng bạn.
              </p>
            </div>

            {/* Info */}
            <div className="text-xs text-zinc-400 leading-relaxed bg-[#141417] p-3.5 rounded-xl border border-zinc-800 space-y-2 shadow-sm">
              <p className="flex items-center gap-1.5 font-bold text-zinc-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Môi trường cục bộ an toàn (Client-Side)</span>
              </p>
              <p>
                Khóa API được lưu trữ an toàn ngay trên trình duyệt của bạn (localStorage) và chỉ gửi trực tiếp tới Google AI Studio khi dịch.
              </p>
              <div className="pt-1">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#e06b3a] hover:underline"
                >
                  <span>Lấy API Key miễn phí tại Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Gemini API Key
                  </label>
                  {hasEnvKey && !settingsApiKey.trim() && (
                    <span className="text-[10px] text-emerald-400 font-medium">Đang dùng mặc định</span>
                  )}
                </div>
                <input
                  type="password"
                  value={settingsApiKey}
                  onChange={(e) => {
                    setSettingsApiKey(e.target.value);
                    setSettingsTestState({ status: 'idle' });
                  }}
                  placeholder={hasEnvKey ? "•••••••••••••••••••••••• (Đã nạp sẵn)" : "Dán mã AI Studio API Key (AIzaSy...)"}
                  className="w-full px-3.5 py-2.5 bg-[#141417] border border-zinc-800 hover:border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-[#e06b3a] transition-all font-mono shadow-sm"
                />
              </div>

              {/* Save */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-orange-600 to-[#e06b3a] hover:from-orange-500 hover:to-orange-600 rounded-xl transition-all shadow-md shadow-orange-950/40 flex items-center justify-center gap-1"
                >
                  <span>{settingsSaved ? 'Đã lưu thành công!' : 'Lưu cấu hình'}</span>
                </button>
              </div>
            </form>

            {/* Test API Key */}
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleTestKeySettings}
                disabled={settingsTestState.status === 'testing'}
                className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#e06b3a] ${settingsTestState.status === 'testing' ? 'animate-spin' : ''}`} />
                <span>{settingsTestState.status === 'testing' ? 'Đang kiểm tra...' : 'Kiểm tra hoạt động API Key'}</span>
              </button>

              {settingsTestState.status === 'success' && (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-2 text-xs text-emerald-300 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-emerald-200">Kết nối thành công!</p>
                    <p className="text-[11px] text-emerald-300/80 leading-tight mt-0.5">{settingsTestState.message}</p>
                  </div>
                </div>
              )}

              {settingsTestState.status === 'error' && (
                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-200">Không thể kết nối:</p>
                    <p className="text-[11px] text-rose-300/80 leading-tight mt-0.5">{settingsTestState.message}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Liquid Glass Island Navigation */}
      <LiquidGlassIsland
        activeTab={activeTab}
        onChangeTab={(tabId) => setActiveTab(tabId as any)}
      />

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          onOpenUpdateModal={() => {
            setIsSettingsModalOpen(false);
            setIsUpdateModalOpen(true);
          }}
        />
      )}

      {/* Update Modal */}
      {isUpdateModalOpen && (
        <UpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
        />
      )}

      {/* Folder 3/4 Bottom Sheet Modal */}
      {activeFolderForSheet && (
        <FolderChaptersModal
          folderName={activeFolderForSheet.name}
          chapters={
            activeFolderForSheet.id === 'uncategorized'
              ? recents.filter((r) => !r.folderId || !folders.some((f) => f.id === r.folderId))
              : recents.filter((r) => r.folderId === activeFolderForSheet.id)
          }
          folders={folders}
          onClose={() => setActiveFolderForSheet(null)}
          onSelectChapter={(item) => setSelectedSavedManga(item)}
          onDeleteChapter={(id, e) => handleDeleteRecent(id, e)}
          onMoveToFolder={(id, folderId) => handleMoveRecentToFolder(id, folderId)}
        />
      )}

      {/* Saved Manga Scroll Viewer Modal */}
      {selectedSavedManga && (
        <SavedMangaViewer
          item={selectedSavedManga}
          allFolderItems={
            selectedSavedManga.folderId
              ? recents.filter((r) => r.folderId === selectedSavedManga.folderId)
              : recents.filter((r) => !r.folderId || !folders.some((f) => f.id === r.folderId))
          }
          onClose={() => setSelectedSavedManga(null)}
          onSelectChapter={(item) => setSelectedSavedManga(item)}
          onDeleteChapter={(id) => {
            handleDeleteRecent(id);
            setSelectedSavedManga(null);
          }}
        />
      )}

      {/* Create Folder Modal */}
      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#141417] border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#e06b3a]" />
                <h3 className="text-base font-bold text-zinc-100">Tạo Thư mục Truyện mới</h3>
              </div>
              <button
                onClick={() => setIsCreateFolderModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Tên bộ truyện / Thư mục</label>
                <input
                  type="text"
                  value={newFolderNameInput}
                  onChange={(e) => setNewFolderNameInput(e.target.value)}
                  placeholder="VD: One Piece, Solo Leveling..."
                  className="w-full bg-[#0d0d0f] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  required
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateFolderModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#e06b3a] hover:bg-[#ff7e40] shadow-lg shadow-orange-950/40 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo thư mục</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
