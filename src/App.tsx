import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { UrlInputCard } from './components/UrlInputCard';
import { JobProgressCard } from './components/JobProgressCard';
import { MangaReader } from './components/MangaReader';
import { SampleChaptersModal } from './components/SampleChaptersModal';
import { ApiDocsModal } from './components/ApiDocsModal';
import { SettingsModal } from './components/SettingsModal';
import { MangaJob, MangaPage, SampleChapter } from './types';
import { BookOpen, Sparkles, ShieldCheck, Zap, Layers, RefreshCw } from 'lucide-react';
import {
  extractComicImagesClient,
  runOcrAndTranslationClient,
  renderInpaintedTranslatedImageClient,
} from './lib/clientPipeline';

export function App() {
  const [activeJob, setActiveJob] = useState<MangaJob | null>(null);
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState<boolean>(false);
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
    setActiveJob(null);
    setPages([]);

    // 1. Get the API Key
    const apiKey = localStorage.getItem('GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      setErrorMessage("Chưa tìm thấy Gemini API Key. Vui lòng bấm vào biểu tượng bánh răng (Cài đặt) ở góc trên bên phải để nhập mã khóa API của bạn trước khi bắt đầu dịch.");
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
        throw new Error("Không phát hiện trang ảnh nào từ nguồn này.");
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
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: 'processing' } : p));

        try {
          // Perform OCR and translation
          const { ocr_results, translations } = await runOcrAndTranslationClient(
            page.source_image,
            sourceLang,
            targetLang,
            apiKey
          );

          // Render inpainted + translated image
          const processed_image = await renderInpaintedTranslatedImageClient(
            page.source_image,
            ocr_results,
            translations
          );

          // Update page to completed
          setPages(prev => prev.map(p => p.id === page.id ? {
            ...p,
            status: 'completed',
            ocr_results,
            translations,
            processed_image,
          } : p));

          completedCount++;
          
          // Update job progress
          setActiveJob(prev => prev && prev.job_id === job_id ? {
            ...prev,
            completed_pages: completedCount,
          } : prev);

        } catch (err: any) {
          console.error(`Page ${i + 1} failed:`, err);
          // Update page to failed
          setPages(prev => prev.map(p => p.id === page.id ? {
            ...p,
            status: 'failed',
            error_message: err.message || 'Lỗi không xác định khi dịch trang.',
          } : p));
        }
      }

      // 5. Finalize Job Status
      setActiveJob(prev => {
        if (!prev || prev.job_id !== job_id) return prev;
        if (prev.status === 'cancelled') return prev;
        
        const hasCompleted = completedCount > 0;
        return {
          ...prev,
          status: hasCompleted ? 'completed' : 'failed',
          error_message: hasCompleted ? undefined : 'Tất cả các trang đều dịch thất bại. Hãy kiểm tra kết nối mạng hoặc API Key.'
        };
      });

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Lỗi trích xuất hoặc xử lý truyện.');
      setIsLoading(false);
      setActiveJob(prev => prev && prev.job_id === job_id ? {
        ...prev,
        status: 'failed',
      } : prev);
    }
  };

  const handleCancelJob = async () => {
    setActiveJob((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
  };

  const handleRetryPage = async (pageId: string) => {
    if (!activeJob) return;
    const pageIndex = pages.findIndex((p) => p.id === pageId);
    if (pageIndex === -1) return;
    const page = pages[pageIndex];

    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, status: 'processing', error_message: undefined } : p))
    );

    try {
      const apiKey = localStorage.getItem('GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || '';
      if (!apiKey) {
        throw new Error("Chưa tìm thấy Gemini API Key.");
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
          status: 'completed'
        };
      });
    } catch (err: any) {
      console.error(err);
      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, status: 'failed', error_message: err.message } : p))
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

  const handleSelectSample = (sample: SampleChapter) => {
    handleStartTranslation(sample.url, sample.source_language, sample.target_language);
  };

  const handleReset = () => {
    setActiveJob(null);
    setPages([]);
    setErrorMessage(null);
  };

  const hasReaderView = pages.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white pb-12">
      {/* Top Header */}
      <Navbar
        onOpenApiDocs={() => setIsApiDocsModalOpen(true)}
        onOpenSamples={() => setIsSampleModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onReset={handleReset}
        hasActiveJob={!!activeJob}
      />

      {/* Offline Alert */}
      <OfflineIndicator />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col items-center space-y-6">
        {/* Header Hero (if no active job or reader) */}
        {!activeJob && (
          <div className="text-center max-w-lg mx-auto pt-4 pb-2 space-y-2 animate-fadeIn">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dịch Manga / Manhwa / Manhua từ URL</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Đọc Truyện Tranh Mọi Ngôn Ngữ
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Tự động bóc tách từng trang ảnh, nhận diện khung thoại bằng Vision AI, xóa chữ gốc và chèn bản dịch tự nhiên.
            </p>
          </div>
        )}

        {/* URL Input Form */}
        {!activeJob && (
          <UrlInputCard
            onSubmit={handleStartTranslation}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onOpenSamples={() => setIsSampleModalOpen(true)}
          />
        )}

        {/* Feature Highlights (when on landing) */}
        {!activeJob && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl pt-2 text-slate-400 text-xs">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Nhận diện OCR & dịch thuật tự động</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>Tự căn chỉnh font chữ vừa khung thoại</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Bảo mật, lưu trữ và chạy 100% trong browser</span>
            </div>
          </div>
        )}

        {/* Active Job Progress View */}
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
                  className="flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Dịch URL chapter khác</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Sample Chapters Modal */}
      <SampleChaptersModal
        isOpen={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
        onSelectSample={handleSelectSample}
      />

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
