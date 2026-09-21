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
  Terminal,
  ChevronDown,
  ChevronUp,
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
  const [showLogs, setShowLogs] = React.useState(true);
  const logsEndRef = React.useRef<HTMLDivElement>(null);

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

  // Auto-scroll logs to bottom whenever they change or are toggled
  React.useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session.logs, showLogs]);

  return (
    <div className="w-full max-w-md mx-auto bg-[#141417] border border-zinc-800 rounded-2xl p-4 shadow-xl text-zinc-100 space-y-3.5 animate-fadeIn">
      {/* Header with Series Name & Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 flex items-center justify-center text-[#e06b3a] flex-shrink-0 mt-0.5">
            {isRunning ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#e06b3a]" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : isPaused ? (
              <Pause className="w-5 h-5 text-amber-400" />
            ) : (
              <Layers className="w-5 h-5 text-zinc-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Dịch tự động toàn bộ</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-100 mt-2 tracking-tight truncate">
              {session.seriesName}
            </h2>
            <p className="text-[11px] text-zinc-400 mt-1">
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
              className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all border border-zinc-700/50"
              title="Tạm dừng dịch"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResume}
              className="p-2 rounded-full bg-[#e06b3a] hover:bg-orange-600 text-white transition-all shadow-md shadow-orange-950/40"
              title="Tiếp tục dịch"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          {isFailed && (
            <button
              onClick={onResume}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#e06b3a] hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-950/40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
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

      {/* Summary of Completed Chapters so far (Presented vertically) */}
      {completedChaptersCount > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-bold">
              Chương đã dịch ({completedChaptersCount}):
            </span>
            {onOpenFolder && (
              <button
                type="button"
                onClick={() => onOpenFolder(session.folderId, session.seriesName)}
                className="text-[11px] text-[#e06b3a] hover:underline font-bold flex items-center gap-1"
              >
                <span>Mở thư mục</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
            {session.completedChapters.map((ch) => (
              <button
                key={ch.recentItemId || ch.url}
                type="button"
                onClick={() => onReadChapter?.(ch.recentItemId)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-[#1a1a22] border border-zinc-800/80 hover:border-zinc-700 text-left text-xs text-zinc-200 transition-all flex items-center justify-between group cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen className="w-4 h-4 text-[#e06b3a] group-hover:scale-110 transition-transform flex-shrink-0" />
                  <span className="font-bold truncate text-zinc-100">{ch.title}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700/40">{ch.pageCount} trang</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
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

      {/* Logs Terminal */}
      {session.logs && session.logs.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center justify-between text-xs text-zinc-400 font-bold hover:text-zinc-200 cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-zinc-500" />
              <span>Nhật ký dịch thuật ({session.logs.length})</span>
            </div>
            {showLogs ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showLogs && (
            <div className="w-full h-40 bg-black/50 border border-zinc-800 rounded-xl p-2.5 font-mono text-[10px] text-zinc-300 overflow-y-auto space-y-1 scroll-smooth">
              {session.logs.map((log, i) => {
                let colorClass = 'text-zinc-400';
                if (log.includes('[START]')) colorClass = 'text-sky-400 font-semibold';
                else if (log.includes('[COMPLETED]')) colorClass = 'text-emerald-400';
                else if (log.includes('[FAILED]')) colorClass = 'text-rose-400 font-bold';
                else if (log.includes('[RETRYING]')) colorClass = 'text-amber-400 font-semibold animate-pulse';
                else if (log.includes('[PENDING]')) colorClass = 'text-zinc-500';
                else if (log.includes('[PROCESSING]')) colorClass = 'text-orange-400';

                return (
                  <div key={i} className={`leading-relaxed break-all ${colorClass}`}>
                    {log}
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
