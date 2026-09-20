import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  AlertTriangle,
  Lightbulb,
  Maximize2,
  Scroll,
  BookmarkCheck,
} from 'lucide-react';
import { MangaJob, MangaPage } from '../types';

interface MangaReaderProps {
  job: MangaJob;
  pages: MangaPage[];
  onRetryPage: (pageId: string) => void;
  onUpdateDialogue?: (pageId: string, dialogueIndex: number, newText: string, updatedPage?: MangaPage) => void;
}

export const MangaReader: React.FC<MangaReaderProps> = ({
  job,
  pages,
  onRetryPage,
}) => {
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'scroll'>('single');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const currentPage = pages[currentPageIdx] || pages[0];

  const handleNextPage = () => {
    if (currentPageIdx < pages.length - 1) {
      setCurrentPageIdx((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPageIdx > 0) {
      setCurrentPageIdx((prev) => prev - 1);
    }
  };

  // Save to Library / Device Archive (appears in tab 2 "Truyện")
  const handleSaveArchive = () => {
    try {
      const recentItem = {
        id: job.job_id,
        title: job.source_url
          ? (job.source_url.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ') || 'Chương truyện')
          : 'Tệp lưu trữ cá nhân',
        sourceUrl: job.source_url,
        thumbnail: pages[0]?.processed_image || pages[0]?.source_image,
        totalPages: pages.length,
        completedPages: pages.filter(p => p.status === 'completed').length || pages.length,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        job: {
          ...job,
          status: 'completed',
        },
        pages: pages,
      };
      const stored = localStorage.getItem('COMIC_TRANS_RECENTS');
      const list = stored ? JSON.parse(stored) : [];
      const updatedList = [recentItem, ...list.filter((x: any) => x.id !== job.job_id)].slice(0, 10);
      localStorage.setItem('COMIC_TRANS_RECENTS', JSON.stringify(updatedList));
      
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.warn('Failed to save archive:', e);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col space-y-3">
      {/* Separate Containers for View Modes vs Save Archive Button */}
      <div className="flex items-center gap-2 w-full">
        {/* Container 1: Từng ảnh / Cuộn */}
        <div className="flex-1 flex items-center bg-[#141417] border border-zinc-800 rounded-xl p-1 gap-1">
          <button
            onClick={() => setViewMode('single')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              viewMode === 'single'
                ? 'bg-[#e06b3a] text-white shadow-md shadow-orange-950/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Từng ảnh</span>
          </button>
          <button
            onClick={() => setViewMode('scroll')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              viewMode === 'scroll'
                ? 'bg-[#e06b3a] text-white shadow-md shadow-orange-950/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Scroll className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Cuộn</span>
          </button>
        </div>

        {/* Container 2: Lưu trữ button */}
        <div className="flex-shrink-0">
          {(() => {
            const isAllCompleted = pages.length > 0 && pages.every(p => p.status === 'completed' && !!(p.processed_image || p.source_image));
            return (
              <button
                onClick={handleSaveArchive}
                disabled={!isAllCompleted}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md ${
                  !isAllCompleted
                    ? 'opacity-40 cursor-not-allowed bg-zinc-900 text-zinc-500 border border-zinc-800'
                    : savedSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#141417] hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80'
                }`}
                title={!isAllCompleted ? "Vui lòng chờ AI dịch xong tất cả các trang mới có thể lưu trữ" : "Lưu bản dịch vào máy và hiển thị ở tab Truyện"}
              >
                <BookmarkCheck className={`w-4 h-4 flex-shrink-0 ${isAllCompleted ? 'text-orange-400' : 'text-zinc-600'}`} />
                <span>{savedSuccess ? 'Đã lưu!' : 'Lưu trữ'}</span>
              </button>
            );
          })()}
        </div>
      </div>

      {/* Reader Main Container */}
      <div className="relative bg-[#0d0d0f] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center">
        {viewMode === 'single' ? (
          /* SINGLE PAGE VIEW MODE */
          <div className="relative w-full min-h-[450px] sm:min-h-[580px] flex items-center justify-center bg-black">
            {currentPage ? (
              <div className="relative w-full flex justify-center">
                <img
                  src={currentPage.processed_image || currentPage.source_image}
                  alt={`Trang ${currentPage.page_number}`}
                  className="w-full h-auto object-contain select-none"
                  referrerPolicy="no-referrer"
                />

                {/* Failed page indicator */}
                {currentPage.status === 'failed' && (
                  <div className="absolute inset-0 bg-[#0e0e11]/90 backdrop-blur-md flex flex-col items-center justify-center p-5 text-center z-30">
                    <div className="w-full max-w-xs bg-[#18181c] border border-rose-500/40 rounded-2xl p-4 space-y-2.5 text-left shadow-2xl">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {currentPage.detailed_error?.categoryLabel || 'Lỗi trang'}
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-semibold text-rose-100">
                        {currentPage.detailed_error?.title || `Lỗi xử lý trang ${currentPage.page_number}`}
                      </h4>
                      <p className="text-zinc-300 text-xs leading-relaxed">
                        {currentPage.detailed_error?.message || currentPage.error_message || 'Không thể OCR hoặc dịch trang này.'}
                      </p>
                      {currentPage.detailed_error?.suggestion && (
                        <div className="p-2 rounded-lg bg-black/40 border border-amber-500/20 text-amber-200/90 text-[11px] flex items-start gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <span>{currentPage.detailed_error.suggestion}</span>
                        </div>
                      )}
                      <button
                        onClick={() => onRetryPage(currentPage.id)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 bg-[#e06b3a] hover:bg-orange-600 text-white rounded-xl transition-colors shadow-lg shadow-orange-950/40"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Thử lại trang {currentPage.page_number}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                Đang chờ tải trang truyện...
              </div>
            )}

            {/* Left Tap Zone */}
            <button
              onClick={handlePrevPage}
              disabled={currentPageIdx === 0}
              className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-center justify-start pl-2 text-white disabled:pointer-events-none"
              title="Trang trước"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>

            {/* Right Tap Zone */}
            <button
              onClick={handleNextPage}
              disabled={currentPageIdx >= pages.length - 1}
              className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-center justify-end pr-2 text-white disabled:pointer-events-none"
              title="Trang tiếp theo"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>
        ) : (
          /* WEBTOON SCROLL VIEW MODE (Only show completed/translated pages) */
          <div className="w-full flex flex-col bg-black">
            {pages
              .filter((p) => p.status === 'completed' || p.processed_image)
              .map((p, idx) => (
                <div key={p.id || idx} className="relative w-full flex justify-center border-b border-zinc-900 last:border-b-0">
                  <img
                    src={p.processed_image || p.source_image}
                    alt={`Trang ${p.page_number}`}
                    className="w-full h-auto object-contain select-none"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
            {pages.filter((p) => p.status === 'completed' || p.processed_image).length === 0 && (
              <div className="py-16 text-center text-zinc-500 text-xs">
                Đang dịch các trang truyện... Các trang đã dịch xong sẽ xuất hiện lần lượt tại đây.
              </div>
            )}
          </div>
        )}

        {/* Integrated Bottom Controls Bar */}
        <div className="w-full bg-[#141417] border-t border-zinc-800/80 p-3 flex items-center justify-between gap-3 text-zinc-300">
          <button
            onClick={handlePrevPage}
            disabled={currentPageIdx === 0 || viewMode === 'scroll'}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-xs font-semibold transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Trước</span>
          </button>

          {/* Page selector dropdown */}
          <div className="flex items-center">
            <select
              value={currentPageIdx}
              onChange={(e) => setCurrentPageIdx(Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-700/80 rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {pages.map((p, idx) => (
                <option key={p.id} value={idx}>
                  Trang {p.page_number} / {pages.length}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPageIdx >= pages.length - 1 || viewMode === 'scroll'}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-xs font-semibold transition-colors"
          >
            <span>Tiếp</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

