import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, HelpCircle, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, Sparkles, Eye, EyeOff } from 'lucide-react';
import { testGeminiApiKey } from '../lib/errorUtils';
import { CURRENT_VERSION } from '../lib/updateChecker';
import { resetCachedProviderInfo } from '../lib/clientPipeline';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUpdateModal?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onOpenUpdateModal }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message?: string;
    model?: string;
  }>({ status: 'idle' });

  useEffect(() => {
    if (isOpen) {
      const storedKey = localStorage.getItem('GEMINI_API_KEY') || '';
      setApiKey(storedKey);
      setSaved(false);
      setShowKey(false);
      setTestState({ status: 'idle' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasEnvKey = !!import.meta.env.VITE_GEMINI_API_KEY;
  const activeKey = apiKey.trim() || import.meta.env.VITE_GEMINI_API_KEY || '';

  const handleTestKey = async () => {
    if (!activeKey) {
      setTestState({
        status: 'error',
        message: 'Chưa có API Key để kiểm tra. Vui lòng nhập API Key của bạn.',
      });
      return;
    }

    setTestState({ status: 'testing', message: 'Đang gửi yêu cầu kiểm tra tới Google Gemini...' });

    const result = await testGeminiApiKey(activeKey);
    if (result.ok) {
      setTestState({
        status: 'success',
        model: result.model,
        message: `API Key hợp lệ! Đã kết nối thành công tới model ${result.model}. Hệ thống sẵn sàng dịch.`,
      });
    } else {
      setTestState({
        status: 'error',
        message: `${result.error?.title || 'Lỗi API Key'}: ${result.error?.message || 'Không thể xác thực'}. ${result.error?.suggestion || ''}`,
      });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    resetCachedProviderInfo();
    if (apiKey.trim()) {
      localStorage.setItem('GEMINI_API_KEY', apiKey.trim());
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#141417] border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-5 relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-[#e06b3a]" />
            <h3 className="font-bold text-zinc-100">Cấu hình Google Gemini API Key</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info */}
        <div className="text-xs text-zinc-400 leading-relaxed bg-[#18181c] p-3 rounded-xl border border-zinc-800/80 space-y-1.5">
          <p className="flex items-center gap-1.5 font-semibold text-zinc-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Môi trường Trực tiếp Trình duyệt (Client-Side)</span>
          </p>
          <p>
            Mã khóa API được lưu cục bộ an toàn trong máy của bạn (localStorage) và gửi trực tiếp tới máy chủ Google AI Studio khi dịch.
          </p>
          <div className="pt-1 flex items-center justify-between">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#e06b3a] hover:underline"
            >
              <span>Lấy API Key miễn phí tại Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Gemini API Key
              </label>
              {hasEnvKey && !apiKey.trim() && (
                <span className="text-[10px] text-emerald-400 font-medium">Đang dùng key mặc định</span>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestState({ status: 'idle' });
                }}
                placeholder={hasEnvKey ? "•••••••••••••••••••••••• (Đã có key build sẵn)" : "Dán mã AI Studio API Key (AIzaSy...)"}
                className="w-full px-3.5 py-2.5 pr-10 bg-[#18181c] border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-[#e06b3a] transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1"
                title={showKey ? "Ẩn API Key" : "Hiển thị API Key"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test API Key Button & Diagnostics */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={testState.status === 'testing'}
              className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#e06b3a] ${testState.status === 'testing' ? 'animate-spin' : ''}`} />
              <span>{testState.status === 'testing' ? 'Đang kiểm tra kết nối...' : 'Kiểm tra hoạt động của API Key'}</span>
            </button>

            {/* Test result display */}
            {testState.status === 'success' && (
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-2 text-xs text-emerald-300 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-emerald-200">Kết nối thành công!</p>
                  <p className="text-[11px] text-emerald-300/90 leading-tight">{testState.message}</p>
                </div>
              </div>
            )}

            {testState.status === 'error' && (
              <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-rose-200">Phát hiện lỗi API:</p>
                  <p className="text-[11px] text-rose-300/90 leading-tight">{testState.message}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-800">
            <span className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Tự động chuyển đổi model dự phòng khi model chính bận</span>
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-colors"
            >
              Đóng
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-xs font-semibold text-white bg-[#e06b3a] hover:bg-orange-600 rounded-xl transition-colors shadow-lg shadow-orange-900/30"
            >
              {saved ? 'Đã lưu!' : 'Lưu cài đặt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
