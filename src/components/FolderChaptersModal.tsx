import React, { useState, useEffect } from 'react';
import { X, Folder, BookOpen, Trash2, ArrowUpDown, ExternalLink, Link2, MoveRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RecentItem, MangaFolder } from '../types';
import { sortChapters } from '../lib/chapterSort';

interface FolderChaptersModalProps {
  folderName: string;
  chapters: RecentItem[];
  folders: MangaFolder[];
  onClose: () => void;
  onSelectChapter: (item: RecentItem) => void;
  onDeleteChapter: (id: string, e: React.MouseEvent) => void;
  onMoveToFolder: (id: string, folderId: string) => void;
}

interface SwipeableChapterCardProps {
  item: RecentItem;
  folders: MangaFolder[];
  onSelectChapter: (item: RecentItem) => void;
  onDeleteChapter: (id: string, e: React.MouseEvent) => void;
  onMoveClick: (item: RecentItem) => void;
}

const SwipeableChapterCard: React.FC<SwipeableChapterCardProps> = ({
  item,
  folders,
  onSelectChapter,
  onDeleteChapter,
  onMoveClick,
}) => {
  const [position, setPosition] = useState<'closed' | 'left' | 'right'>('closed');

  const handleDragEnd = (event: any, info: any) => {
    // If swiped right (revealing left button)
    if (info.offset.x > 50) {
      setPosition('right');
    }
    // If swiped left (revealing right button)
    else if (info.offset.x < -50) {
      setPosition('left');
    } else {
      setPosition('closed');
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (position !== 'closed') {
      setPosition('closed');
    } else {
      onSelectChapter(item);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0d0d0f] border border-zinc-800/80 h-[80px]">
      {/* UNDERLAY ACTIONS */}
      <div className="absolute inset-0 flex items-center justify-between z-0">
        {/* Left Action (Move Folder) - Revealed when swiped to 'right' (x > 0) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveClick(item);
            setPosition('closed');
          }}
          className="absolute left-0 top-0 bottom-0 w-[100px] bg-orange-600 hover:bg-orange-500 text-white flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <Folder className="w-5 h-5 text-white" />
          <span className="text-[10px] font-black uppercase tracking-wider">Di chuyển</span>
        </button>

        {/* Right Action (Delete) - Revealed when swiped to 'left' (x < 0) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteChapter(item.id, e);
            setPosition('closed');
          }}
          className="absolute right-0 top-0 bottom-0 w-[100px] bg-rose-600 hover:bg-rose-500 text-white flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <Trash2 className="w-5 h-5 text-white" />
          <span className="text-[10px] font-black uppercase tracking-wider">Xoá</span>
        </button>
      </div>

      {/* FOREGROUND CARD */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.2}
        animate={{ x: position === 'right' ? 100 : position === 'left' ? -100 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onDragEnd={handleDragEnd}
        whileTap={{ cursor: 'grabbing' }}
        onClick={handleCardClick}
        className="absolute inset-0 z-10 flex items-center justify-between p-3.5 bg-[#0d0d0f] hover:bg-[#121216] cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-11 h-15 bg-zinc-900 rounded-xl overflow-hidden flex-shrink-0 border border-zinc-800 shadow-sm">
            {item.thumbnail ? (
              <img 
                src={item.thumbnail} 
                alt={item.title} 
                referrerPolicy="no-referrer" 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <BookOpen className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-zinc-100 truncate group-hover:text-[#e06b3a] transition-colors">
              {item.title}
            </h4>
            {item.job?.completed_pages !== undefined && (
              <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
                Đã dịch: <span className="text-emerald-400 font-bold">{item.job.completed_pages}/{item.job.total_pages} trang</span>
              </p>
            )}
          </div>
        </div>

        {item.sourceUrl && item.sourceUrl.startsWith('http') && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
            }}
            className="p-2 ml-2 rounded-xl text-zinc-500 hover:text-[#e06b3a] hover:bg-orange-500/5 transition-all z-20 flex-shrink-0"
            title="Link gốc"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    </div>
  );
};

export const FolderChaptersModal: React.FC<FolderChaptersModalProps> = ({
  folderName,
  chapters,
  folders,
  onClose,
  onSelectChapter,
  onDeleteChapter,
  onMoveToFolder,
}) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [movingChapter, setMovingChapter] = useState<RecentItem | null>(null);

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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sortedChapters.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400 font-medium">
                Chưa có chap truyện nào trong thư mục này.
              </p>
            </div>
          ) : (
            sortedChapters.map((item) => (
              <SwipeableChapterCard
                key={item.id}
                item={item}
                folders={folders}
                onSelectChapter={onSelectChapter}
                onDeleteChapter={onDeleteChapter}
                onMoveClick={(targetItem) => setMovingChapter(targetItem)}
              />
            ))
          )}
        </div>
      </div>

      {/* Beautiful Sleek Folder Move Selection Modal Overlay */}
      <AnimatePresence>
        {movingChapter && (
          <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#141417] border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#18181d]">
                <div className="flex items-center gap-2">
                  <Folder className="w-5 h-5 text-[#e06b3a]" />
                  <h3 className="text-sm sm:text-base font-extrabold text-zinc-100">Di chuyển chương</h3>
                </div>
                <button
                  onClick={() => setMovingChapter(null)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[50vh] overflow-y-auto">
                <p className="text-xs text-zinc-400 font-medium">
                  Chọn thư mục để chuyển <strong className="text-zinc-200">{movingChapter.title}</strong> vào:
                </p>

                <div className="space-y-2">
                  {/* Uncategorized Option */}
                  <button
                    onClick={() => {
                      onMoveToFolder(movingChapter.id, 'uncategorized');
                      setMovingChapter(null);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 text-left transition-all"
                  >
                    <span className="text-xs font-bold text-zinc-300">Chưa phân loại (Mặc định)</span>
                    <MoveRight className="w-4 h-4 text-zinc-500" />
                  </button>

                  {/* List of other folders */}
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        onMoveToFolder(movingChapter.id, f.id);
                        setMovingChapter(null);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 text-left transition-all"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-bold text-zinc-200 block truncate">{f.name}</span>
                      </div>
                      <MoveRight className="w-4 h-4 text-[#e06b3a]" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
