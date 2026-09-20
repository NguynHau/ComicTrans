import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, RotateCcw, AlertTriangle, Key, Upload, Lightbulb } from 'lucide-react';
import { MangaJob } from '../types';

interface JobProgressCardProps {
  job: MangaJob;
  onCancel: () => void;
  onRetry: () => void;
  onOpenSettings?: () => void;
  onSwitchToUpload?: () => void;
}

export const JobProgressCard: React.FC<JobProgressCardProps> = ({
  job,
  onCancel,
  onRetry,
  onOpenSettings,
  onSwitchToUpload,
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
  const detailedError = job.detailed_error;

  return (
    <div className="w-full max-w-md mx-auto bg-[#141417] border border-zinc-800 rounded-2xl p-4 shadow-xl text-zinc-100 space-y-3">
      <div className="flex items-center justify-between">
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
              {job.status === 'failed' && (detailedError ? detailedError.title : 'Xử lý chương thất bại')}
              {job.status === 'cancelled' && 'Tiến trình đã bị hủy'}
            </h3>
            <p className="text-[11px] text-zinc-500 truncate max-w-[200px] sm:max-w-xs">
              {job.source_url || 'Tệp ảnh tải lên'}
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
      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
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

      {/* Detailed Granular Error Feedback Box */}
      {isFailed && (
        <div className="mt-2 p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200 text-xs space-y-2.5 animate-fadeIn">
          {/* Error Tag & Title */}
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 w-full">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {detailedError?.categoryLabel || 'Lỗi xử lý'}
                </span>
              </div>
              <h4 className="font-semibold text-rose-100 text-xs sm:text-sm">
                {detailedError?.title || 'Không thể hoàn tất dịch thuật'}
              </h4>
              <p className="text-zinc-300 text-xs leading-relaxed">
                {detailedError?.message || job.error_message || 'Có lỗi xảy ra trong quá trình nhận diện hoặc gọi API.'}
              </p>
            </div>
          </div>

          {/* Suggestion Box */}
          {detailedError?.suggestion && (
            <div className="p-2.5 rounded-lg bg-[#141417]/80 border border-amber-500/20 text-amber-200/90 text-[11px] leading-relaxed flex items-start gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 font-medium">Cách khắc phục: </strong>
                <span>{detailedError.suggestion}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {(detailedError?.actionType === 'open_settings' || !detailedError) && onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e06b3a] hover:bg-orange-600 text-white rounded-lg font-medium text-xs transition-colors shadow-md shadow-orange-950/40"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{detailedError?.actionLabel || 'Cấu hình lại API Key'}</span>
              </button>
            )}

            {detailedError?.actionType === 'upload_tab' && onSwitchToUpload && (
              <button
                type="button"
                onClick={onSwitchToUpload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg font-medium text-xs border border-zinc-700 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#e06b3a]" />
                <span>{detailedError.actionLabel || 'Chuyển sang Tải Ảnh'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium text-xs border border-zinc-700/80 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
