import React, { useState } from 'react';
import { X, Folder, BookOpen, Trash2, ArrowUpDown } from 'lucide-react';
import { RecentItem } from '../types';
import { sortChapters } from '../lib/chapterSort';

interface FolderChaptersModalProps {
  folderName: string;
  chapters: RecentItem[];
  onClose: () => void;
  onSelectChapter: (item: RecentItem) => void;
  onDeleteChapter: (id: string, e: React.MouseEvent) => void;
}

export const FolderChaptersModal: React.FC<FolderChaptersModalProps> = ({
  folderName,
  chapters,
  onClose,
  onSelectChapter,
  onDeleteChapter,
}) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const sortedChapters = sortChapters(chapters, sortOrder);

  return (
    <div className="fixed inset-0 z-[180] bg-black/70 backdrop-blur-sm flex items-end justify-center animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* 3/4 Height Bottom Sheet Container */}
      <div className="relative z-[190] w-full max-w-2xl h-[75vh] bg-[#141417] border-t border-zinc-700/80 rounded-t-3xl shadow-2xl flex flex-col animate-slideUp overflow-hidden">
        {/* Top Drag Pill & Header */}
        <div className="px-5 pt-3 pb-3 border-b border-zinc-800 flex-shrink-0 bg-[#18181d]">
          <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-3" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[#e06b3a]">
                <Folder className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-extrabold text-zinc-100 truncate">
                  {folderName}
                </h3>
                <p className="text-[11px] text-zinc-400 font-medium">
                  {chapters.length} chương truyện đã lưu
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Sort toggle button */}
              <button
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0d0d0f] hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold transition-all"
                title="Thay đổi thứ tự sắp xếp chap"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#e06b3a]" />
                <span>{sortOrder === 'asc' ? 'Chap 1 → N' : 'Chap N → 1'}</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex-shrink-0 border border-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Chapters Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {sortedChapters.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400 font-medium">
                Chưa có chương truyện nào trong thư mục này.
              </p>
            </div>
          ) : (
            sortedChapters.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectChapter(item)}
                className="group relative flex gap-3 p-3 bg-[#0d0d0f] hover:bg-[#1c1c22] border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl transition-all cursor-pointer shadow-md"
              >
                {/* Thumbnail */}
                <div className="w-12 h-16 bg-zinc-900 rounded-xl overflow-hidden flex-shrink-0 border border-zinc-800">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {/* Chapter Metadata */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div className="space-y-0.5">
                    <h4 className="text-xs sm:text-sm font-bold text-zinc-200 truncate group-hover:text-[#e06b3a] transition-colors pr-7">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-zinc-400">
                      Đã dịch:{' '}
                      <span className="text-emerald-400 font-semibold">
                        {item.completedPages}/{item.totalPages} trang
                      </span>
                    </p>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-medium">{item.timestamp}</p>
                </div>

                {/* Delete Chapter Button */}
                <button
                  type="button"
                  onClick={(e) => onDeleteChapter(item.id, e)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Xóa chương này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
