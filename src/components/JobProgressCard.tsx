import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, XCircle, RotateCcw } from 'lucide-react';
import { MangaJob } from '../types';

interface JobProgressCardProps {
  job: MangaJob;
  onCancel: () => void;
  onRetry: () => void;
}

export const JobProgressCard: React.FC<JobProgressCardProps> = ({
  job,
  onCancel,
  onRetry,
}) => {
  const percentage =
    job.total_pages > 0
      ? Math.round((job.completed_pages / job.total_pages) * 100)
      : job.status === 'analyzing'
      ? 15
      : 5;

  const isFinished = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isCancelled = job.status === 'cancelled';

  return (
    <div className="w-full max-w-md mx-auto bg-[#141417] border border-zinc-800 rounded-2xl p-4 shadow-xl text-zinc-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {job.status === 'processing' || job.status === 'analyzing' || job.status === 'queued' ? (
            <Loader2 className="w-5 h-5 text-[#e06b3a] animate-spin" />
          ) : isFinished ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}

          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-zinc-100">
              {job.status === 'queued' && 'Đang chuẩn bị tiến trình...'}
              {job.status === 'analyzing' && 'Đang trích xuất hình ảnh...'}
              {job.status === 'processing' && `Đang OCR & Dịch trang ${job.current_page}/${job.total_pages}`}
              {job.status === 'completed' && 'Dịch chương hoàn tất!'}
              {job.status === 'failed' && 'Xử lý chương thất bại'}
              {job.status === 'cancelled' && 'Tiến trình đã bị hủy'}
            </h3>
            <p className="text-[11px] text-zinc-500 truncate max-w-[200px] sm:max-w-xs">
              {job.source_url}
            </p>
          </div>
        </div>

        {/* Action Button */}
        {!isFinished && !isFailed && !isCancelled && (
          <button
            onClick={onCancel}
            className="text-xs font-medium px-2.5 py-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Hủy
          </button>
        )}
        {isFailed && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-orange-600/20 text-orange-300 hover:bg-orange-600/30 rounded-lg border border-orange-500/30 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Thử lại</span>
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isFinished
              ? 'bg-emerald-500'
              : isFailed
              ? 'bg-rose-500'
              : 'bg-[#e06b3a]'
          }`}
          style={{ width: `${Math.max(5, Math.min(100, percentage))}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <span>
          {job.total_pages > 0
            ? `${job.completed_pages}/${job.total_pages} trang hoàn tất`
            : 'Đang chuẩn bị...'}
        </span>
        <span className="font-semibold text-zinc-300">{percentage}%</span>
      </div>

      {job.error_message && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {job.error_message}
        </div>
      )}
    </div>
  );
};
