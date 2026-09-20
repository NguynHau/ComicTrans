import React from 'react';
import { X } from 'lucide-react';
import { RecentItem } from '../types';

interface SavedMangaViewerProps {
  item: RecentItem;
  onClose: () => void;
}

export const SavedMangaViewer: React.FC<SavedMangaViewerProps> = ({ item, onClose }) => {
  const pages = item.pages || [];

  return (
    <div className="fixed inset-0 z-[200] bg-black overflow-y-auto flex flex-col items-center animate-fadeIn">
      {/* Top Right Close Button: Square with rounded corners containing X */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[210] w-10 h-10 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-zinc-200 flex items-center justify-center hover:bg-zinc-800 hover:text-white transition-all shadow-2xl backdrop-blur-md"
        title="Thoát"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Scrolled images only - no extra UI */}
      <div className="w-full max-w-2xl flex flex-col items-center bg-black min-h-screen">
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
    </div>
  );
};
