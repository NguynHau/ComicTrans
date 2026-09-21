import React from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  Square,
  BookOpen,
  Folder,
  Layers,
  ChevronRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { BatchTranslationSession, MangaJob } from '../types';

interface BatchProgressCardProps {
  session: BatchTranslationSession;
  activeJob?: MangaJob | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onOpenFolder?: (folderId: string, folderName: string) => void;
  onReadChapter?: (recentItemId: string) => void;
}

export const BatchProgressCard: React.FC<BatchProgressCardProps> = ({
  session,
  activeJob,
  onPause,
  onResume,
  onStop,
  onOpenFolder,
  onReadChapter,
}) => {
  const isRunning = session.status === 'running';
  const isPaused = session.status === 'paused';
  const isCompleted = session.status === 'completed';
  const isFailed = session.status === 'failed';
  const isStopped = session.status === 'stopped';

  const completedChaptersCount = session.completedChapters.length;
  const currentChapterTitle = `Chap ${session.currentChapterNumber}`;

  const currentPercentage =
    activeJob && activeJob.total_pages > 0
      ? Math.round((activeJob.completed_pages / activeJob.total_pages) * 100)
      : isRunning
      ? 15
      : isCompleted
      ? 100
      : 0;

  return (
    <div className="w-full max-w-md mx-auto bg-[#141417] border border-zinc-800 rounded-2xl p-4 shadow-xl text-zinc-100 space-y-3.5 animate-fadeIn">
      {/* Header with Series Name & Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#e06b3a] flex-shrink-0 mt-0.5">
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#e06b3a]" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : isPaused ? (
              <Pause className="w-4 h-4 text-amber-400" />
            ) : (
              <Layers className="w-4 h-4 text-zinc-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Dịch tự động toàn bộ</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                <Folder className="w-3 h-3 text-[#e06b3a]" />
                <span className="truncate max-w-[120px]">{session.seriesName}</span>
              </span>
            </div>
            <h3 className="text-sm font-bold text-zinc-100 mt-1 truncate">
              {session.seriesName}
            </h3>
            <p className="text-[11px] text-zinc-400">
              {isRunning && `Đang xử lý: ${currentChapterTitle}`}
              {isPaused && `Đang tạm dừng tại ${currentChapterTitle}`}
              {isCompleted && `Đã hoàn tất toàn bộ truyện (${completedChaptersCount} chương)`}
              {isStopped && `Đã dừng tiến trình tại ${currentChapterTitle}`}
              {isFailed && (session.errorMessage || 'Lỗi xử lý hàng loạt')}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isRunning && (
            <button
              onClick={onPause}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              title="Tạm dừng dịch"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResume}
              className="p-1.5 rounded-lg bg-[#e06b3a] hover:bg-orange-600 text-white transition-colors shadow-md shadow-orange-950/40"
              title="Tiếp tục dịch"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          {(isRunning || isPaused) && (
            <button
              onClick={onStop}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/40 hover:text-rose-300 text-zinc-400 transition-colors"
              title="Dừng hẳn"
            >
              <Square className="w-4 h-4" />
            </button>
          )}

          {isFailed && (
            <button
              onClick={onResume}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#e06b3a] text-white rounded-lg text-xs font-semibold"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Thử lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar of Current Chapter */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span>
            {activeJob && activeJob.total_pages > 0
              ? `${currentChapterTitle} • ${activeJob.completed_pages}/${activeJob.total_pages} trang`
              : isRunning
              ? 'Đang tải hình ảnh chương...'
              : `${completedChaptersCount} chương đã lưu`}
          </span>
          <span className="font-semibold text-zinc-200">{currentPercentage}%</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isCompleted
                ? 'bg-emerald-500'
                : isFailed
                ? 'bg-rose-500'
                : isPaused
                ? 'bg-amber-500'
                : 'bg-[#e06b3a]'
            }`}
            style={{ width: `${Math.max(5, Math.min(100, currentPercentage))}%` }}
          />
        </div>
      </div>

      {/* Summary of Completed Chapters so far */}
      {completedChaptersCount > 0 && (
        <div className="space-y-2 pt-1 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">
              Chương đã dịch ({completedChaptersCount}):
            </span>
            {onOpenFolder && (
              <button
                type="button"
                onClick={() => onOpenFolder(session.folderId, session.seriesName)}
                className="text-[11px] text-[#e06b3a] hover:underline font-semibold flex items-center gap-1"
              >
                <span>Mở thư mục</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
            {session.completedChapters.map((ch) => (
              <button
                key={ch.recentItemId || ch.url}
                type="button"
                onClick={() => onReadChapter?.(ch.recentItemId)}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left text-xs text-zinc-200 transition-all flex items-center gap-2 group"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#e06b3a] group-hover:scale-110 transition-transform" />
                <div className="min-w-0">
                  <span className="font-semibold block truncate max-w-[110px]">{ch.title}</span>
                  <span className="text-[10px] text-zinc-500 block">{ch.pageCount} trang</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Failure message banner */}
      {isFailed && session.errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">{session.errorMessage}</div>
        </div>
      )}
    </div>
  );
};
