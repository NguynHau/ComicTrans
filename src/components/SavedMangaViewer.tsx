import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { RecentItem } from '../types';

interface SavedMangaViewerProps {
  item: RecentItem;
  allFolderItems?: RecentItem[];
  onClose: () => void;
  onSelectChapter?: (item: RecentItem) => void;
}

export const SavedMangaViewer: React.FC<SavedMangaViewerProps> = ({
  item,
  allFolderItems = [],
  onClose,
  onSelectChapter,
}) => {
  const [currentChapter, setCurrentChapter] = useState<RecentItem>(item);

  useEffect(() => {
    setCurrentChapter(item);
  }, [item]);

  const pages = currentChapter.pages || [];

  // Determine chapter order
  // If allFolderItems is provided, sort or find index
  const itemsInFolder = allFolderItems.length > 0 ? allFolderItems : [currentChapter];
  const currentIndex = itemsInFolder.findIndex((x) => x.id === currentChapter.id);

  // Assuming itemsInFolder is ordered with newest first (or list order)
  // Prev chapter (e.g., Chap 1 when currently reading Chap 2):
  // If list is newest first [Chap 3, Chap 2, Chap 1]: currentIndex + 1 is Chap 1 (Prev), currentIndex - 1 is Chap 3 (Next).
  // Let's check if index + 1 is older chapter (Chap trước) or index - 1.
  // We provide intuitive navigation:
  const prevChapter = currentIndex < itemsInFolder.length - 1 ? itemsInFolder[currentIndex + 1] : null; // Older / Previous
  const nextChapter = currentIndex > 0 ? itemsInFolder[currentIndex - 1] : null; // Newer / Next

  const handleGoToPrev = () => {
    if (prevChapter) {
      setCurrentChapter(prevChapter);
      if (onSelectChapter) onSelectChapter(prevChapter);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoToNext = () => {
    if (nextChapter) {
      setCurrentChapter(nextChapter);
      if (onSelectChapter) onSelectChapter(nextChapter);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black overflow-y-auto flex flex-col items-center animate-fadeIn">
      {/* Top Bar with Safe Area Top Padding to avoid phone notifications/notch */}
      <div className="sticky top-0 left-0 right-0 z-[210] w-full pt-12 sm:pt-14 pb-3 px-4 bg-gradient-to-b from-black via-black/90 to-transparent backdrop-blur-md flex items-center justify-between border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <BookOpen className="w-4 h-4 text-[#e06b3a] flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-extrabold text-zinc-100 truncate">
              {currentChapter.title}
            </h3>
            {currentChapter.folderName && (
              <p className="text-[10px] text-zinc-400 truncate">
                {currentChapter.folderName}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-zinc-200 flex items-center justify-center hover:bg-zinc-800 hover:text-white transition-all shadow-xl flex-shrink-0"
          title="Thoát đọc truyện"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Reader Image List */}
      <div className="w-full max-w-2xl flex flex-col items-center bg-black min-h-screen pb-28 pt-2">
        {pages.map((p, idx) => (
          <div key={p.id || idx} className="w-full flex justify-center border-b border-zinc-900 last:border-b-0">
            <img
              src={p.processed_image || p.source_image}
              alt={`Trang ${p.page_number}`}
              className="w-full h-auto object-contain select-none"
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
