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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#141417] border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-5 relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-[#e06b3a]" />
            <h3 className="font-bold text-zinc-100">Cấu hình API Key</h3>
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
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasEnvKey ? "•••••••••••••••••••••••• (Đang dùng phím build)" : "Nhập AI Studio API Key của bạn..."}
              className="w-full px-3.5 py-2.5 bg-[#18181c] border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-[#e06b3a] transition-all font-mono"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Lưu an toàn trong trình duyệt (localStorage)</span>
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-colors"
            >
              Hủy
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
