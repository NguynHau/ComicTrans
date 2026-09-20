import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  RotateCcw,
  Archive,
  AlertTriangle,
  Lightbulb,
  Maximize2,
  Scroll,
} from 'lucide-react';
import JSZip from 'jszip';
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
  const [showOriginal, setShowOriginal] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'scroll'>('single');

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

  // Download all pages as a ZIP file
  const handleDownloadZip = async () => {
    if (pages.length === 0 || isZipping) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder(`manga_translated_${job.job_id}`) || zip;

      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const imgUrl = p.processed_image || p.source_image;
        try {
          const res = await fetch(imgUrl);
          const blob = await res.blob();
          const ext = blob.type.includes('png') ? 'png' : 'jpg';
          folder.file(`page_${String(p.page_number).padStart(3, '0')}.${ext}`, blob);
        } catch (e) {
          console.warn(`Failed to fetch image for page ${p.page_number}`, e);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `chapter_translated_${job.job_id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error('ZIP packaging error:', e);
    } finally {
      setIsZipping(false);
    }
  };

  // Render typeset overlays for fallback if canvas image is not generated yet
  const renderTypesettingOverlay = (page: MangaPage) => {
    if (showOriginal || !page.ocr_results || page.ocr_results.length === 0 || page.processed_image) {
      return null;
    }

    return (
      <div className="absolute inset-0 pointer-events-none">
        {page.ocr_results.map((item, idx) => {
          const trans = page.translations?.[idx]?.translated_text || item.text;
          const bbox = item.bbox;

          let leftPercent: string;
          let topPercent: string;
          let widthPercent: string;
          let minHeightPercent: string;

          if (
            bbox.ymin !== undefined &&
            bbox.xmin !== undefined &&
            bbox.ymax !== undefined &&
            bbox.xmax !== undefined
          ) {
            leftPercent = `${(bbox.xmin / 1000) * 100}%`;
            topPercent = `${(bbox.ymin / 1000) * 100}%`;
            widthPercent = `${((bbox.xmax - bbox.xmin) / 1000) * 100}%`;
            minHeightPercent = `${((bbox.ymax - bbox.ymin) / 1000) * 100}%`;
          } else {
            leftPercent = `${(bbox.x / 800) * 100}%`;
            topPercent = `${(bbox.y / 1100) * 100}%`;
            widthPercent = `${(bbox.width / 800) * 100}%`;
            minHeightPercent = `${(bbox.height / 1100) * 100}%`;
          }

          return (
            <div
              key={item.id || idx}
              style={{
                left: leftPercent,
                top: topPercent,
                width: widthPercent,
                minHeight: minHeightPercent,
                backgroundColor: `rgba(255, 255, 255, 0.95)`,
              }}
              className="absolute text-slate-900 border border-slate-300 shadow-sm rounded-xl p-1.5 flex items-center justify-center text-center"
            >
              <span className="font-bold font-sans text-xs leading-tight text-slate-950 break-words line-clamp-5 tracking-tight">
                {trans}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col space-y-3">
      {/* View Mode Toggle Container (Xem từng ảnh / Cuộn như trên web) */}
      <div className="flex items-center justify-center bg-[#141417] border border-zinc-800 rounded-xl p-1 gap-1">
        <button
          onClick={() => setViewMode('single')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            viewMode === 'single'
              ? 'bg-[#e06b3a] text-white shadow-md shadow-orange-950/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Xem từng ảnh</span>
        </button>
        <button
          onClick={() => setViewMode('scroll')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            viewMode === 'scroll'
              ? 'bg-[#e06b3a] text-white shadow-md shadow-orange-950/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Scroll className="w-3.5 h-3.5" />
          <span>Cuộn như trên web</span>
        </button>
      </div>

      {/* Reader Main Container */}
      <div className="relative bg-[#0d0d0f] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center">
        {viewMode === 'single' ? (
          /* SINGLE PAGE VIEW MODE */
          <div className="relative w-full min-h-[450px] sm:min-h-[580px] flex items-center justify-center bg-black">
            {currentPage ? (
              <div className="relative w-full flex justify-center">
                <img
                  src={showOriginal ? currentPage.source_image : (currentPage.processed_image || currentPage.source_image)}
                  alt={`Trang ${currentPage.page_number}`}
                  className="w-full h-auto object-contain select-none"
                  referrerPolicy="no-referrer"
                />

                {/* Overlaid Typesetting if fallback */}
                {renderTypesettingOverlay(currentPage)}

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
          /* WEBTOON SCROLL VIEW MODE */
          <div className="w-full flex flex-col bg-black">
            {pages.map((p, idx) => (
              <div key={p.id || idx} className="relative w-full flex justify-center border-b border-zinc-900 last:border-b-0">
                <img
                  src={showOriginal ? p.source_image : (p.processed_image || p.source_image)}
                  alt={`Trang ${p.page_number}`}
                  className="w-full h-auto object-contain select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        )}

        {/* Integrated Bottom Controls Bar */}
        <div className="w-full bg-[#141417] border-t border-zinc-800/80 p-3 flex flex-wrap items-center justify-between gap-2 text-zinc-300">
          <button
            onClick={handlePrevPage}
            disabled={currentPageIdx === 0 || viewMode === 'scroll'}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-xs font-semibold transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Trước</span>
          </button>

          {/* Page selector dropdown & View options */}
          <div className="flex items-center gap-2">
            <select
              value={currentPageIdx}
              onChange={(e) => setCurrentPageIdx(Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-700/80 rounded-xl px-2.5 py-1.5 text-xs font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {pages.map((p, idx) => (
                <option key={p.id} value={idx}>
                  Trang {p.page_number} / {pages.length}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-all ${
                showOriginal
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {showOriginal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{showOriginal ? 'Gốc' : 'Dịch'}</span>
            </button>

            <button
              onClick={handleDownloadZip}
              disabled={isZipping || pages.length === 0}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl border border-zinc-700 transition-colors disabled:opacity-50"
              title="Tải toàn bộ chapter dạng file ZIP"
            >
              <Archive className="w-3.5 h-3.5 text-[#e06b3a]" />
              <span className="hidden sm:inline">{isZipping ? 'Đang nén...' : 'ZIP'}</span>
            </button>
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

