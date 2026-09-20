import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Sparkles,
  RotateCcw,
  Archive,
  Edit3,
  Check,
  ZoomIn,
  ZoomOut,
  Type,
  Maximize2
} from 'lucide-react';
import JSZip from 'jszip';
import { MangaJob, MangaPage } from '../types';
import { renderInpaintedTranslatedImageClient } from '../lib/clientPipeline';

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
  onUpdateDialogue,
}) => {
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [readerMode, setReaderMode] = useState<'single' | 'webtoon'>('single');
  const [selectedBubble, setSelectedBubble] = useState<{
    pageId: string;
    index: number;
    sourceText: string;
    translatedText: string;
  } | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [fontSizeOffset, setFontSizeOffset] = useState<number>(0); // -2, 0, +2, +4
  const [bubbleOpacity, setBubbleOpacity] = useState<number>(96); // 80 - 100%

  const currentPage = pages[currentPageIdx] || pages[0];

  const handleNextPage = () => {
    if (currentPageIdx < pages.length - 1) {
      setCurrentPageIdx((prev) => prev + 1);
      setSelectedBubble(null);
      setIsEditing(false);
    }
  };

  const handlePrevPage = () => {
    if (currentPageIdx > 0) {
      setCurrentPageIdx((prev) => prev - 1);
      setSelectedBubble(null);
      setIsEditing(false);
    }
  };

  const handleBubbleClick = (pageId: string, idx: number, sourceText: string, translatedText: string) => {
    setSelectedBubble({ pageId, index: idx, sourceText, translatedText });
    setEditingText(translatedText);
    setIsEditing(false);
  };

  const handleSaveDialogueEdit = async () => {
    if (!selectedBubble) return;
    try {
      const page = pages.find((p) => p.id === selectedBubble.pageId);
      if (page && page.translations[selectedBubble.index]) {
        // 1. Update the translation array locally
        const updatedTranslations = [...page.translations];
        updatedTranslations[selectedBubble.index] = {
          ...updatedTranslations[selectedBubble.index],
          translated_text: editingText
        };

        // 2. Re-render the image entirely on the client side
        const newProcessedImage = await renderInpaintedTranslatedImageClient(
          page.source_image,
          page.ocr_results,
          updatedTranslations
        );

        const updatedPage = {
          ...page,
          translations: updatedTranslations,
          processed_image: newProcessedImage,
        };

        // 3. Trigger parent update
        if (onUpdateDialogue) {
          onUpdateDialogue(selectedBubble.pageId, selectedBubble.index, editingText, updatedPage);
        }
      }
      setSelectedBubble((prev) => (prev ? { ...prev, translatedText: editingText } : null));
      setIsEditing(false);
    } catch (e) {
      console.warn('Failed to save dialogue edit:', e);
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

  // Render typeset overlays for a page
  const renderTypesettingOverlay = (page: MangaPage) => {
    if (showOriginal || !page.ocr_results || page.ocr_results.length === 0) {
      return null;
    }

    const hasProcessedImage = Boolean(page.processed_image);

    return (
      <div className="absolute inset-0 pointer-events-auto">
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

          const isSelected =
            selectedBubble?.pageId === page.id && selectedBubble?.index === idx;

          // If the image already has the inpainting + translated text composited directly on the canvas,
          // render transparent interactive hitboxes so users can click/hover to inspect and edit dialogue
          if (hasProcessedImage) {
            return (
              <div
                key={item.id || idx}
                onClick={(e) => {
                  e.stopPropagation();
                  handleBubbleClick(page.id, idx, item.text, trans);
                }}
                style={{
                  left: leftPercent,
                  top: topPercent,
                  width: widthPercent,
                  minHeight: minHeightPercent,
                }}
                title="Bấm vào bóng thoại để xem bản gốc hoặc chỉnh sửa"
                className={`absolute cursor-pointer transition-all rounded-xl ${
                  isSelected
                    ? 'ring-2 ring-indigo-500 bg-indigo-500/20 z-20'
                    : 'border border-transparent hover:border-indigo-400/80 hover:bg-indigo-500/10 z-10'
                }`}
              />
            );
          }

          return (
            <div
              key={item.id || idx}
              onClick={(e) => {
                e.stopPropagation();
                handleBubbleClick(page.id, idx, item.text, trans);
              }}
              style={{
                left: leftPercent,
                top: topPercent,
                width: widthPercent,
                minHeight: minHeightPercent,
                backgroundColor: `rgba(255, 255, 255, ${bubbleOpacity / 100})`,
              }}
              className={`absolute text-slate-900 border ${
                isSelected
                  ? 'border-indigo-600 ring-2 ring-indigo-500 shadow-xl z-20 scale-[1.02]'
                  : 'border-slate-300 shadow-sm z-10'
              } rounded-xl p-1.5 sm:p-2 flex items-center justify-center text-center cursor-pointer transition-all hover:ring-2 hover:ring-indigo-400`}
            >
              <span
                style={{ fontSize: `calc(11px + ${fontSizeOffset}px)` }}
                className="font-bold font-sans leading-tight text-slate-950 break-words line-clamp-5 tracking-tight"
              >
                {trans}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col space-y-4">
      {/* Top Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-lg backdrop-blur-md">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setReaderMode('single')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
              readerMode === 'single'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Từng trang
          </button>
          <button
            onClick={() => setReaderMode('webtoon')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
              readerMode === 'webtoon'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cuộn dọc Webtoon
          </button>
        </div>

        {/* Font Size & Original Switch */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg text-slate-300 text-xs">
            <Type className="w-3.5 h-3.5 text-indigo-400" />
            <button
              onClick={() => setFontSizeOffset((v) => Math.max(-2, v - 1))}
              className="px-1.5 hover:text-white font-bold"
              title="Giảm cỡ chữ thoại"
            >
              A-
            </button>
            <span className="text-[10px] text-slate-500">|</span>
            <button
              onClick={() => setFontSizeOffset((v) => Math.min(4, v + 1))}
              className="px-1.5 hover:text-white font-bold"
              title="Tăng cỡ chữ thoại"
            >
              A+
            </button>
          </div>

          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${
              showOriginal
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {showOriginal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showOriginal ? 'Bản gốc (Gốc)' : 'Đã dịch (Translated)'}</span>
          </button>

          {/* Download Zip */}
          <button
            onClick={handleDownloadZip}
            disabled={isZipping || pages.length === 0}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
            title="Tải toàn bộ chapter dạng file ZIP"
          >
            <Archive className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">{isZipping ? 'Đang nén...' : 'Tải ZIP'}</span>
          </button>
        </div>
      </div>

      {/* Reader Body */}
      {readerMode === 'single' ? (
        /* Single Page Viewer */
        <div className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center">
          {/* Main Image Container */}
          <div className="relative w-full min-h-[450px] sm:min-h-[600px] flex items-center justify-center bg-slate-900">
            {currentPage ? (
              <div className="relative w-full flex justify-center">
                <img
                  src={showOriginal ? currentPage.source_image : (currentPage.processed_image || currentPage.source_image)}
                  alt={`Trang ${currentPage.page_number}`}
                  className="w-full max-h-[85vh] object-contain select-none"
                  referrerPolicy="no-referrer"
                />

                {/* Overlaid Typesetting / Speech Bubbles */}
                {renderTypesettingOverlay(currentPage)}

                {/* Failed page indicator */}
                {currentPage.status === 'failed' && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-rose-400 text-sm font-semibold mb-2">
                      Lỗi xử lý trang {currentPage.page_number}
                    </p>
                    <p className="text-slate-400 text-xs mb-4 max-w-xs">
                      {currentPage.error_message || 'Không thể OCR hoặc dịch trang này.'}
                    </p>
                    <button
                      onClick={() => onRetryPage(currentPage.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Thử lại trang này</span>
                    </button>
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

          {/* Bottom Page Navigation Bar */}
          <div className="w-full bg-slate-900 border-t border-slate-800 p-3 flex items-center justify-between text-slate-300">
            <button
              onClick={handlePrevPage}
              disabled={currentPageIdx === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-xs font-semibold transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Trước</span>
            </button>

            {/* Page selector dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={currentPageIdx}
                onChange={(e) => {
                  setCurrentPageIdx(Number(e.target.value));
                  setSelectedBubble(null);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              disabled={currentPageIdx >= pages.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-xs font-semibold transition-colors"
            >
              <span>Tiếp</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Webtoon Vertical Scroll Mode */
        <div className="flex flex-col space-y-4 bg-slate-950 p-2 sm:p-4 rounded-2xl border border-slate-800">
          {pages.map((p) => (
            <div
              key={p.id}
              className="relative w-full bg-slate-900 rounded-xl overflow-hidden shadow-md flex justify-center"
            >
              <img
                src={showOriginal ? p.source_image : (p.processed_image || p.source_image)}
                alt={`Trang ${p.page_number}`}
                className="w-full object-contain"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
              {renderTypesettingOverlay(p)}
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] text-slate-300 font-mono">
                Trang {p.page_number}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Speech Bubble Inspection & Live Edit Dialog */}
      {selectedBubble && (
        <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-4 shadow-xl animate-fadeIn text-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Chi tiết & Hiệu chỉnh Lời Thoại
            </h4>
            <button
              onClick={() => setSelectedBubble(null)}
              className="text-xs text-slate-400 hover:text-white px-1.5 py-0.5"
            >
              Đóng ✕
            </button>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-1 font-semibold">Văn bản gốc (OCR nhận diện):</span>
              <p className="bg-slate-800/90 p-2 rounded-lg font-mono text-slate-200 border border-slate-700">
                {selectedBubble.sourceText}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 font-semibold">Bản dịch AI (Nhấp để chỉnh sửa):</span>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 text-[11px]"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Sửa bản dịch</span>
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows={3}
                    className="w-full p-2 bg-slate-800 border border-indigo-500 rounded-lg text-slate-100 text-xs focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSaveDialogueEdit}
                      className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Lưu lại</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="bg-indigo-950/40 border border-indigo-500/30 p-2 rounded-lg font-medium text-indigo-200">
                  {selectedBubble.translatedText}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
