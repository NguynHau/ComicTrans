import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, HelpCircle } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const storedKey = localStorage.getItem('GEMINI_API_KEY') || '';
      setApiKey(storedKey);
      setSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
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

  const hasEnvKey = !!import.meta.env.VITE_GEMINI_API_KEY;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-100">Cấu hình API Key</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info */}
        <div className="text-xs text-slate-400 leading-relaxed bg-slate-800/50 p-3 rounded-xl border border-slate-700/40 space-y-1.5">
          <p className="flex items-center gap-1.5 font-semibold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Môi trường Client-Side (GitHub Pages)</span>
          </p>
          <p>
            Ứng dụng chạy hoàn toàn trên trình duyệt của bạn. Để thực hiện OCR và dịch thuật, ứng dụng cần kết nối trực tiếp đến Google Gemini.
          </p>
          {hasEnvKey ? (
            <p className="text-emerald-400 font-medium">
              ✓ Đã nhận diện được API Key từ bản Build tĩnh (VITE_GEMINI_API_KEY). Người dùng không cần cấu hình thêm!
            </p>
          ) : (
            <p className="text-amber-400">
              ℹ Chưa tìm thấy API Key mặc định từ bản build. Bạn có thể nhập mã khóa cá nhân ở dưới để chạy thử.
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasEnvKey ? "•••••••••••••••••••••••• (Đang dùng phím build)" : "Nhập AI Studio API Key của bạn..."}
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Lưu an toàn trong trình duyệt (localStorage)</span>
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-lg shadow-indigo-600/15"
            >
              {saved ? 'Đã lưu!' : 'Lưu cài đặt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
