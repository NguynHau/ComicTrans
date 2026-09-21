import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ExternalLink,
  Sliders,
  Download,
  CheckCircle2,
  Loader2,
  Maximize2,
  Scroll,
  Trash2,
} from 'lucide-react';
import { RecentItem, MangaPage } from '../types';
import { sortChapters } from '../lib/chapterSort';
import {
  ReaderSettingsPanel,
  ReaderSettings,
  getFilterStyle,
} from './ReaderSettingsPanel';
import {
  downloadChapterOffline,
  isChapterCachedOffline,
  getOfflineChapterPages,
} from '../lib/offlineManager';

interface SavedMangaViewerProps {
  item: RecentItem;
  allFolderItems?: RecentItem[];
  onClose: () => void;
  onSelectChapter?: (item: RecentItem) => void;
  onDeleteChapter?: (id: string) => void;
}

export const SavedMangaViewer: React.FC<SavedMangaViewerProps> = ({
  item,
  allFolderItems = [],
  onClose,
  onSelectChapter,
  onDeleteChapter,
}) => {
  const [currentChapter, setCurrentChapter] = useState<RecentItem>(item);
  const [pages, setPages] = useState<MangaPage[]>(item.pages || []);
  const [viewMode, setViewMode] = useState<'single' | 'scroll'>('scroll');
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Advanced Reader Settings
  const [showSettings, setShowSettings] = useState(false);
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>({
    brightness: 100,
    filter: 'none',
  });

  // Offline Caching States
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    setCurrentChapter(item);
    setPages(item.pages || []);
    setCurrentPageIdx(0);
  }, [item]);

  // Check offline status for current chapter
  useEffect(() => {
    if (!currentChapter?.id) return;
    isChapterCachedOffline(currentChapter.id).then((cached) => {
      setIsOfflineCached(cached);
      // If cached and user is offline or pages are missing, load from offline cache
      if (cached && (!item.pages?.length || !navigator.onLine)) {
        getOfflineChapterPages(currentChapter.id).then((cachedPages) => {
          if (cachedPages && cachedPages.length > 0) {
            setPages(cachedPages);
          }
        });
      }
    });
  }, [currentChapter?.id]);

  // Sort folder items naturally from Chap 1 -> Chap N
  const itemsInFolder = sortChapters(
    allFolderItems.length > 0 ? allFolderItems : [currentChapter],
    'asc'
  );

  const currentIndex = itemsInFolder.findIndex((x) => x.id === currentChapter.id);
  const prevChapter = currentIndex > 0 ? itemsInFolder[currentIndex - 1] : null;
  const nextChapter =
    currentIndex >= 0 && currentIndex < itemsInFolder.length - 1
      ? itemsInFolder[currentIndex + 1]
      : null;

  const handleGoToPrev = () => {
    if (prevChapter) {
      setCurrentChapter(prevChapter);
      setPages(prevChapter.pages || []);
      setCurrentPageIdx(0);
      if (onSelectChapter) onSelectChapter(prevChapter);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoToNext = () => {
    if (nextChapter) {
      setCurrentChapter(nextChapter);
      setPages(nextChapter.pages || []);
      setCurrentPageIdx(0);
      if (onSelectChapter) onSelectChapter(nextChapter);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenSourceUrl = () => {
    if (currentChapter.sourceUrl && currentChapter.sourceUrl.startsWith('http')) {
      window.open(currentChapter.sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadOffline = async () => {
    if (!pages.length || isDownloadingOffline) return;
    setIsDownloadingOffline(true);
    setOfflineProgress({ current: 0, total: pages.length });

    const res = await downloadChapterOffline(
      currentChapter.id,
      currentChapter.title,
      pages,
      (current, total) => setOfflineProgress({ current, total })
    );

    setIsDownloadingOffline(false);
    setOfflineProgress(null);
    if (res.success) {
      setIsOfflineCached(true);
    }
  };

  const filterStyle = getFilterStyle(readerSettings);
  const currentSinglePage = pages[currentPageIdx] || pages[0];

  return (
    <div className="fixed inset-0 z-[200] bg-black overflow-y-auto flex flex-col items-center animate-fadeIn">
      {/* Top Bar with Safe Area Top Padding */}
      <div className="sticky top-0 left-0 right-0 z-[210] w-full pt-10 sm:pt-12 pb-3 px-3 sm:px-4 bg-gradient-to-b from-black via-black/95 to-transparent backdrop-blur-md flex flex-col gap-2 border-b border-zinc-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <BookOpen className="w-4 h-4 text-[#e06b3a] flex-shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 truncate">
                <h3 className="text-xs sm:text-sm font-extrabold text-zinc-100 truncate">
                  {currentChapter.title}
                </h3>
                {currentChapter.sourceUrl && currentChapter.sourceUrl.startsWith('http') && (
                  <button
                    type="button"
                    onClick={handleOpenSourceUrl}
                    className="p-1 text-zinc-400 hover:text-orange-400 transition-colors flex-shrink-0"
                    title={`Mở link gốc: ${currentChapter.sourceUrl}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {currentChapter.folderName && (
                <p className="text-[10px] text-zinc-400 truncate">
                  {currentChapter.folderName}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Nút Tải Offline */}
            <button
              onClick={handleDownloadOffline}
              disabled={pages.length === 0 || isDownloadingOffline}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${
                isOfflineCached
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : 'bg-zinc-900/90 border-zinc-700/80 text-zinc-200 hover:bg-zinc-800 hover:text-white'
              }`}
              title={
                isDownloadingOffline
                  ? `Đang tải: ${offlineProgress?.current || 0}/${offlineProgress?.total || 0}`
                  : isOfflineCached
                  ? 'Đã tải offline'
                  : 'Tải về đọc offline'
              }
            >
              {isDownloadingOffline ? (
                <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
              ) : isOfflineCached ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Download className="w-4 h-4 text-[#e06b3a]" />
              )}
            </button>

            {/* Nút Tùy chỉnh (Độ sáng, bảo vệ mắt, đen trắng) */}
            <button
              onClick={() => setShowSettings((prev) => !prev)}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${
                showSettings
                  ? 'bg-[#e06b3a] text-white border-orange-500 shadow-md'
                  : 'bg-zinc-900/90 border-zinc-700/80 text-zinc-200 hover:bg-zinc-800'
              }`}
              title="Cài đặt độ sáng, bảo vệ mắt, đen trắng"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Nút Đóng / Thoát */}
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-zinc-200 flex items-center justify-center hover:bg-zinc-800 hover:text-white transition-all shadow-xl"
              title="Thoát đọc truyện"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Expandable Reader Settings Panel */}
        {showSettings && (
          <div className="max-w-2xl w-full mx-auto">
            <ReaderSettingsPanel
              settings={readerSettings}
              onUpdateSettings={(newVals) =>
                setReaderSettings((prev) => ({ ...prev, ...newVals }))
              }
              onClose={() => setShowSettings(false)}
            />
          </div>
        )}
      </div>

      {/* Main Reader Container */}
      <div className="w-full max-w-2xl flex flex-col items-center bg-black min-h-screen pb-28 pt-2">
        {viewMode === 'scroll' ? (
          /* CONTINUOUS VERTICAL SCROLL */
          <div className="w-full flex flex-col items-center">
            {pages.map((p, idx) => (
              <div key={p.id || idx} className="w-full flex justify-center border-b border-zinc-900 last:border-b-0">
                <img
                  src={p.processed_image || p.source_image}
                  alt={`Trang ${p.page_number}`}
                  className="w-full h-auto object-contain select-none"
                  style={filterStyle}
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
            {pages.length === 0 && (
              <div className="py-20 text-center text-zinc-500 text-sm">
                Không có trang truyện nào được lưu trữ.
              </div>
            )}
          </div>
        ) : (
          /* SINGLE PAGE FLIP MODE */
          <div className="relative w-full min-h-[500px] flex items-center justify-center bg-black">
            {currentSinglePage ? (
              <div className="relative w-full flex justify-center">
                <img
                  src={currentSinglePage.processed_image || currentSinglePage.source_image}
                  alt={`Trang ${currentSinglePage.page_number}`}
                  className="w-full h-auto object-contain select-none"
                  style={filterStyle}
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="py-20 text-center text-zinc-500 text-sm">
                Không có trang nào.
              </div>
            )}

            {/* Tap/Click navigation zones */}
            <button
              onClick={() => setCurrentPageIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentPageIdx === 0}
              className="absolute left-0 top-0 bottom-0 w-20 sm:w-28 bg-gradient-to-r from-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-center justify-start pl-3 text-white disabled:pointer-events-none"
              title="Trang trước"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              onClick={() => setCurrentPageIdx((prev) => Math.min(pages.length - 1, prev + 1))}
              disabled={currentPageIdx >= pages.length - 1}
              className="absolute right-0 top-0 bottom-0 w-20 sm:w-28 bg-gradient-to-l from-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-center justify-end pr-3 text-white disabled:pointer-events-none"
              title="Trang tiếp theo"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>
        )}
      </div>

      {/* Floating Rounded Rectangular Chapter Switcher Buttons at the bottom */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[220] flex items-center gap-3 max-w-[92vw]">
        {/* Nút Chap Trước */}
        <button
          onClick={handleGoToPrev}
          disabled={!prevChapter}
          className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border transition-all flex items-center gap-2 text-xs font-extrabold shadow-2xl backdrop-blur-md ${
            prevChapter
              ? 'bg-[#141417]/95 border-zinc-700/90 text-zinc-100 hover:bg-zinc-800 hover:scale-105 active:scale-95 shadow-black/80'
              : 'bg-[#141417]/60 border-zinc-800/50 text-zinc-600 opacity-40 cursor-not-allowed'
          }`}
          title={prevChapter ? `Đọc ${prevChapter.title}` : 'Không có chap trước'}
        >
          <ChevronLeft className="w-4 h-4 text-[#e06b3a]" />
          <span>Chap trước</span>
        </button>

        {/* Nút Chap Sau */}
        <button
          onClick={handleGoToNext}
          disabled={!nextChapter}
          className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border transition-all flex items-center gap-2 text-xs font-extrabold shadow-2xl backdrop-blur-md ${
            nextChapter
              ? 'bg-[#141417]/95 border-zinc-700/90 text-zinc-100 hover:bg-zinc-800 hover:scale-105 active:scale-95 shadow-black/80'
              : 'bg-[#141417]/60 border-zinc-800/50 text-zinc-600 opacity-40 cursor-not-allowed'
          }`}
          title={nextChapter ? `Đọc ${nextChapter.title}` : 'Không có chap sau'}
        >
          <span>Chap sau</span>
          <ChevronRight className="w-4 h-4 text-[#e06b3a]" />
        </button>
      </div>
    </div>
  );
};
