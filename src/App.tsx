import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OrientationLock } from './components/OrientationLock';
import { UrlInputCard } from './components/UrlInputCard';
import { JobProgressCard } from './components/JobProgressCard';
import { MangaReader } from './components/MangaReader';
import { ApiDocsModal } from './components/ApiDocsModal';
import { SettingsModal } from './components/SettingsModal';
import { MangaJob, MangaPage, RecentItem, DetailedError } from './types';
import { RefreshCw } from 'lucide-react';
import {
  extractComicImagesClient,
  runOcrAndTranslationClient,
  renderInpaintedTranslatedImageClient,
} from './lib/clientPipeline';
import { classifyPipelineError } from './lib/errorUtils';

export function App() {
  const [activeJob, setActiveJob] = useState<MangaJob | null>(null);
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<DetailedError | null>(null);
  const [isApiDocsModalOpen, setIsApiDocsModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Keep a ref to track current active job for cancellation inside the loop
  const activeJobRef = useRef<MangaJob | null>(null);
  useEffect(() => {
    activeJobRef.current = activeJob;
  }, [activeJob]);

  const handleStartTranslation = async (
    url: string,
    sourceLang: string,
    targetLang: string,
    images?: string[]
  ) => {
    setIsLoading(true);
    setErrorMessage(null);
    setDetailedError(null);
    setActiveJob(null);
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

      // 4. Process each page sequentially
      let completedCount = 0;
      let lastFailureError: DetailedError | null = null;
      let currentPagesArray = [...initialPages];

      for (let i = 0; i < initialPages.length; i++) {
        // Double check cancellation
        if ((activeJobRef.current?.status as string) === 'cancelled' || activeJobRef.current?.job_id !== job_id) {
          return;
        }

        const page = initialPages[i];
        
        // Update job's current page count
        setActiveJob(prev => prev && prev.job_id === job_id ? {
          ...prev,
          current_page: i + 1,
        } : prev);

        // Update page status to processing
        currentPagesArray = currentPagesArray.map(p => p.id === page.id ? { ...p, status: 'processing' } : p);
        setPages(currentPagesArray);

        try {
          // Perform OCR and translation
          const { ocr_results, translations, jpegBase64 } = await runOcrAndTranslationClient(
            page.source_image,
            sourceLang,
            targetLang,
            apiKey
          );

          // Render inpainted + translated image using the Base64 Data URL
          const processed_image = await renderInpaintedTranslatedImageClient(
            jpegBase64 || page.source_image,
            ocr_results,
            translations
          );

          // Update page to completed
          currentPagesArray = currentPagesArray.map(p => p.id === page.id ? {
            ...p,
            status: 'completed',
            ocr_results,
            translations,
            processed_image,
            source_image: jpegBase64 || p.source_image, // Cache loaded image data URL
          } : p);
          setPages(currentPagesArray);

          completedCount++;
          
          // Update job progress
          setActiveJob(prev => prev && prev.job_id === job_id ? {
            ...prev,
            completed_pages: completedCount,
          } : prev);

        } catch (err: any) {
          console.error(`Page ${i + 1} failed:`, err);
          const classified = classifyPipelineError(err);
          lastFailureError = classified;

          // Update page to failed with classified details
          currentPagesArray = currentPagesArray.map(p => p.id === page.id ? {
            ...p,
            status: 'failed',
            error_message: classified.message,
            detailed_error: classified,
          } : p);
          setPages(currentPagesArray);

          // If API Key is invalid or missing, stop the loop immediately instead of hammering repeatedly
          if (classified.category === 'API_KEY_INVALID' || classified.category === 'API_KEY_MISSING') {
            break;
          }
        }
      }

      // 5. Finalize Job Status & Save to Recents
      if (completedCount > 0) {
        try {
          const recentItem: RecentItem = {
            id: job_id,
            title: url
              ? (url.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ') || 'Chương truyện')
              : 'Tệp tải lên cá nhân',
            sourceUrl: url,
            thumbnail: currentPagesArray[0]?.processed_image || resolvedImages[0],
            totalPages: resolvedImages.length,
            completedPages: completedCount,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            job: {
              ...initialJob,
              status: 'completed',
              completed_pages: completedCount,
              total_pages: resolvedImages.length,
            },
            pages: currentPagesArray,
          };
          const stored = localStorage.getItem('COMIC_TRANS_RECENTS');
          const list: RecentItem[] = stored ? JSON.parse(stored) : [];
          const updatedList = [recentItem, ...list.filter(x => x.id !== job_id)].slice(0, 10);
          localStorage.setItem('COMIC_TRANS_RECENTS', JSON.stringify(updatedList));
        } catch (e) {
          console.warn('Could not save recent item:', e);
        }
      }

      setActiveJob(prev => {
        if (!prev || prev.job_id !== job_id) return prev;
        if (prev.status === 'cancelled') return prev;
        
        const hasCompleted = completedCount > 0;
        return {
          ...prev,
          status: hasCompleted ? 'completed' : 'failed',
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

      const { ocr_results, translations } = await runOcrAndTranslationClient(
        page.source_image,
        activeJob.source_language,
        activeJob.target_language,
        apiKey
      );

      const processed_image = await renderInpaintedTranslatedImageClient(
        page.source_image,
        ocr_results,
        translations
      );

      setPages((prev) =>
        prev.map((p) =>
          p.id === pageId
            ? {
                ...p,
                status: 'completed',
                ocr_results,
                translations,
                processed_image,
                detailed_error: undefined,
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

  const handleReset = () => {
    setActiveJob(null);
    setPages([]);
    setErrorMessage(null);
    setDetailedError(null);
  };

  const hasReaderView = pages.length > 0;

  return (
    <div className="min-h-screen bg-comic-panel text-zinc-100 flex flex-col font-sans selection:bg-[#e06b3a] selection:text-white pb-10">
      {/* Orientation Lock (Blocks landscape rotation on mobile) */}
      <OrientationLock />

      {/* Top Header */}
      <Navbar
        onOpenApiDocs={() => setIsApiDocsModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onReset={handleReset}
        hasActiveJob={!!activeJob}
      />

      {/* Offline Alert */}
      <OfflineIndicator />

      {/* Main Content Area: Strictly Mobile max-w-md */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4 flex flex-col items-center">
        {/* Landing View: Matches Mockup Exactly */}
        {!activeJob && (
          <UrlInputCard
            onSubmit={handleStartTranslation}
            isLoading={isLoading}
            errorMessage={errorMessage}
            detailedError={detailedError}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onResumeRecent={handleResumeRecent}
          />
        )}

        {/* Active Job Progress View & Reader */}
        {activeJob && (
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
              onOpenSettings={() => setIsSettingsModalOpen(true)}
              onSwitchToUpload={handleReset}
            />

            {/* If pages are loaded/processing, show reader */}
            {hasReaderView && (
              <MangaReader
                job={activeJob}
                pages={pages}
                onRetryPage={handleRetryPage}
                onUpdateDialogue={handleUpdateDialogue}
              />
            )}

            {/* Back / New Translation Button */}
            {(activeJob.status === 'completed' || activeJob.status === 'failed' || activeJob.status === 'cancelled') && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 bg-[#141417] hover:bg-[#1f1f25] text-zinc-200 rounded-xl border border-zinc-800 transition-colors shadow-lg shadow-black/40"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#e06b3a]" />
                  <span>Dịch chương truyện khác</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* REST API & OpenAPI Modal */}
      <ApiDocsModal
        isOpen={isApiDocsModalOpen}
        onClose={() => setIsApiDocsModalOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
}

export default App;
