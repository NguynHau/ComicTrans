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
    <div className="w-full max-w-xl mx-auto bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-xl shadow-slate-950/40 text-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {job.status === 'processing' || job.status === 'analyzing' || job.status === 'queued' ? (
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
          ) : isFinished ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}

          <div>
            <h3 className="text-sm font-semibold text-white">
              {job.status === 'queued' && 'Đang chuẩn bị tiến trình...'}
              {job.status === 'analyzing' && 'Đang phân tích & trích xuất hình ảnh...'}
              {job.status === 'processing' && `Đang OCR & Dịch trang ${job.current_page}/${job.total_pages}`}
              {job.status === 'completed' && 'Dịch chapter hoàn tất!'}
              {job.status === 'failed' && 'Xử lý chapter thất bại'}
              {job.status === 'cancelled' && 'Tiến trình đã bị hủy'}
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-sm">
              {job.source_url}
            </p>
          </div>
        </div>

        {/* Action Button */}
        {!isFinished && !isFailed && !isCancelled && (
          <button
            onClick={onCancel}
            className="text-xs font-medium px-2.5 py-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Hủy
          </button>
        )}
        {isFailed && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 rounded-lg border border-indigo-500/30 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Thử lại</span>
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isFinished
              ? 'bg-emerald-500'
              : isFailed
              ? 'bg-rose-500'
              : 'bg-gradient-to-r from-indigo-500 to-violet-500'
          }`}
          style={{ width: `${Math.max(5, Math.min(100, percentage))}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          {job.total_pages > 0
            ? `${job.completed_pages}/${job.total_pages} trang hoàn thành`
            : 'Đang tải thông tin...'}
        </span>
        <span className="font-semibold text-slate-300">{percentage}%</span>
      </div>

      {job.error_message && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {job.error_message}
        </div>
      )}
    </div>
  );
};
