import React, { useState, useEffect } from 'react';
import { X, Folder, BookOpen, Trash2, ArrowUpDown, ExternalLink, Link2 } from 'lucide-react';
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
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoadingSummary(true);
      try {
        const response = await fetch('/api/v1/summarize-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: folderName,
            chapterTitles: chapters.map(c => c.title),
          }),
        });
        const data = await response.json();
        if (data.summary) {
          setSummary(data.summary);
        }
      } catch (err) {
        console.error('Failed to fetch summary:', err);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [folderName, chapters]);

  const sortedChapters = sortChapters(chapters, sortOrder);

  const handleOpenSourceUrl = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (url && url.startsWith('http')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

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
              <div className="p-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#e06b3a]">
                <Folder className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-extrabold text-zinc-100 truncate">
                  {folderName}
                </h3>
                <p className="text-[11px] text-zinc-400 font-medium">
                  {chapters.length} chap truyện đã lưu
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
          
          {/* Summary Section */}
          <div className="mt-4 px-1">
             {loadingSummary ? (
               <p className="text-xs text-zinc-500 animate-pulse">Đang tạo tóm tắt truyện...</p>
             ) : summary ? (
               <div className="bg-[#0d0d0f] p-3 rounded-xl border border-zinc-800">
                 <h4 className="text-[11px] font-bold text-zinc-400 uppercase mb-1">Tóm tắt nội dung</h4>
                 <p className="text-xs text-zinc-300 leading-relaxed">{summary}</p>
               </div>
             ) : null}
          </div>
        </div>

        {/* Chapters Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {sortedChapters.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400 font-medium">
                Chưa có chap truyện nào trong thư mục này.
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
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 pr-14">
                  <div className="space-y-1">
                    <h4 className="text-xs sm:text-sm font-bold text-zinc-200 truncate group-hover:text-[#e06b3a] transition-colors">
                      {item.title}
                    </h4>
                    {item.sourceUrl && item.sourceUrl.startsWith('http') && (
                      <span
                        className="text-[10px] text-zinc-500 font-normal break-all block mt-0.5"
                        title={item.sourceUrl}
                      >
                        {item.sourceUrl}
                      </span>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-zinc-400">
                        Đã dịch:{' '}
                        <span className="text-emerald-400 font-semibold">
                          {item.completedPages}/{item.totalPages} trang
                        </span>
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-medium">{item.timestamp}</p>
                </div>

                {/* Action Buttons: Delete & Open Link */}
                <div className="absolute top-3 right-3 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Bạn có chắc chắn muốn xóa chương "${item.title}"?`)) {
                        onDeleteChapter(item.id, e);
                      }
                    }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Xóa chap này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  
                  {item.sourceUrl && item.sourceUrl.startsWith('http') && (
                    <button
                      type="button"
                      onClick={(e) => handleOpenSourceUrl(item.sourceUrl!, e)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-[#e06b3a] hover:bg-orange-500/10 transition-colors"
                      title="Truy cập link gốc"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
