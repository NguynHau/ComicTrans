import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Sparkles, CheckCircle2, ShieldCheck, AlertCircle, ArrowUpCircle } from 'lucide-react';
import { checkForAppUpdate, applyAppUpdate, CURRENT_VERSION, CheckUpdateResult } from '../lib/updateChecker';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoCheckOnMount?: boolean;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose, autoCheckOnMount = false }) => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckUpdateResult | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    setResult(null);
    const res = await checkForAppUpdate();
    setResult(res);
    setChecking(false);
  };

  useEffect(() => {
    if (isOpen) {
      runCheck();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    await applyAppUpdate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#141417] border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-5 relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#e06b3a]" />
            <h3 className="font-bold text-zinc-100">Kiểm tra & Cập nhật Hệ thống</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Version badge */}
        <div className="flex items-center justify-between bg-[#18181c] p-3 rounded-xl border border-zinc-800/80 text-xs">
          <span className="text-zinc-400 font-medium">Phiên bản ứng dụng hiện tại:</span>
          <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            v{CURRENT_VERSION.version}
          </span>
        </div>

        {/* Status Body */}
        {checking && (
          <div className="p-6 text-center space-y-3 bg-[#18181c] rounded-xl border border-zinc-800">
            <RefreshCw className="w-8 h-8 text-[#e06b3a] animate-spin mx-auto" />
            <p className="text-xs font-semibold text-zinc-300">Đang kiểm tra bản phát hành mới từ GitHub Pages...</p>
          </div>
        )}

        {!checking && result && (
          <div className="space-y-3">
            {result.hasUpdate ? (
              <div className="p-4 rounded-xl bg-gradient-to-b from-orange-950/40 to-[#18181c] border border-orange-500/40 space-y-3">
                <div className="flex items-center gap-2 text-orange-400 font-bold text-sm">
                  <ArrowUpCircle className="w-5 h-5 flex-shrink-0 animate-bounce" />
                  <span>Đã có phiên bản mới v{result.latestVersion}!</span>
                </div>
                {result.description && (
                  <p className="text-xs text-zinc-300 bg-black/40 p-2.5 rounded-lg border border-zinc-800/60 leading-relaxed">
                    {result.description}
                  </p>
                )}
                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Toàn bộ API Key, Lịch sử truyện dịch & Cài đặt sẽ được lưu nguyên 100%.</span>
                </div>
              </div>
            ) : result.error ? (
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-rose-200">Không thể kiểm tra phiên bản:</p>
                  <p className="text-[11px] text-rose-300/80">{result.error}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-300">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="font-bold text-emerald-200 text-sm">Bạn đang ở phiên bản mới nhất!</p>
                  <p className="text-[11px] text-emerald-300/80">
                    Ứng dụng đã được cập nhật đầy đủ các tính năng dịch thuật mới nhất.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={runCheck}
            disabled={checking || isUpdating}
            className="flex-1 py-2.5 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#e06b3a] ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</span>
          </button>

          {result?.hasUpdate ? (
            <button
              type="button"
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-orange-600 to-[#e06b3a] hover:from-orange-500 hover:to-orange-600 rounded-xl transition-all shadow-lg shadow-orange-900/40 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>{isUpdating ? 'Đang cập nhật...' : 'Cập nhật ngay'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-colors"
            >
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
