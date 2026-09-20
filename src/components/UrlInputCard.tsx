import React, { useState, useRef } from 'react';
import {
  Link2,
  ArrowRight,
  Clipboard,
  Sparkles,
  AlertCircle,
  Globe,
  Languages,
  Upload,
  Image as ImageIcon,
  Check,
  X
} from 'lucide-react';
import { LanguageOption, SampleChapter } from '../types';

const SOURCE_LANGUAGES: LanguageOption[] = [
  { code: 'auto', name: 'Tự nhận diện (Auto Detect)', flag: '🌐' },
  { code: 'ja', name: 'Tiếng Nhật (Manga)', flag: '🇯🇵' },
  { code: 'ko', name: 'Tiếng Hàn (Manhwa)', flag: '🇰🇷' },
  { code: 'zh', name: 'Tiếng Trung (Manhua)', flag: '🇨🇳' },
  { code: 'en', name: 'Tiếng Anh (Comics)', flag: '🇺🇸' },
];

const TARGET_LANGUAGES: LanguageOption[] = [
  { code: 'vi', name: 'Tiếng Việt (Vietnamese)', flag: '🇻🇳' },
  { code: 'en', name: 'Tiếng Anh (English)', flag: '🇺🇸' },
  { code: 'fr', name: 'Tiếng Pháp (French)', flag: '🇫🇷' },
  { code: 'es', name: 'Tiếng Tây Ban Nha (Spanish)', flag: '🇪🇸' },
  { code: 'th', name: 'Tiếng Thái (Thai)', flag: '🇹🇭' },
  { code: 'id', name: 'Tiếng Indonesia (Indonesian)', flag: '🇮🇩' },
];

const QUICK_SAMPLES: { label: string; flag: string; sub: string; url: string; src: string; tgt: string }[] = [
  {
    label: 'Manga Shonen (JP)',
    flag: '🇯🇵',
    sub: 'Tiếng Nhật → Việt',
    url: 'sample://manga/chapter-1',
    src: 'ja',
    tgt: 'vi',
  },
  {
    label: 'Manhwa Solo Hunter (KR)',
    flag: '🇰🇷',
    sub: 'Tiếng Hàn → Việt',
    url: 'sample://manhwa/action',
    src: 'ko',
    tgt: 'vi',
  },
  {
    label: 'Manhua Tu Tiên (ZH)',
    flag: '🇨🇳',
    sub: 'Tiếng Trung → Việt',
    url: 'sample://manhua/cultivation',
    src: 'zh',
    tgt: 'vi',
  },
];

interface UrlInputCardProps {
  onSubmit: (url: string, sourceLang: string, targetLang: string, images?: string[]) => Promise<void>;
  isLoading: boolean;
  errorMessage?: string | null;
  onOpenSamples: () => void;
}

export const UrlInputCard: React.FC<UrlInputCardProps> = ({
  onSubmit,
  isLoading,
  errorMessage,
  onOpenSamples,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  const [url, setUrl] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('vi');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const result = loadEvt.target?.result as string;
        if (result) {
          setUploadedImages((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeUploadedImage = (idx: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQuickSampleClick = (sample: typeof QUICK_SAMPLES[0]) => {
    setActiveTab('url');
    setUrl(sample.url);
    setSourceLang(sample.src);
    setTargetLang(sample.tgt);
    onSubmit(sample.url, sample.src, sample.tgt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'url') {
      if (!url.trim()) return;
      onSubmit(url.trim(), sourceLang, targetLang);
    } else {
      if (uploadedImages.length === 0) return;
      onSubmit('', sourceLang, targetLang, uploadedImages);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl shadow-slate-950/40 space-y-4">
      {/* 1-Click Quick Samples Test Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Thử nhanh 1-chạm (Test ngay không cần link)
          </span>
          <button
            type="button"
            onClick={onOpenSamples}
            className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            Xem tất cả →
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_SAMPLES.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => handleQuickSampleClick(sample)}
              className="p-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 hover:border-indigo-500/50 rounded-xl text-left transition-all active:scale-[0.98] group flex flex-col justify-between"
            >
              <div className="flex items-center gap-1 mb-1">
                <span className="text-base">{sample.flag}</span>
                <span className="text-[11px] font-bold text-slate-200 group-hover:text-indigo-300 transition-colors line-clamp-1">
                  {sample.label.split(' ')[0]}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">
                {sample.sub}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex items-center justify-center my-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-800"></div>
        </div>
        <div className="relative px-3 bg-slate-900 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
          Hoặc dịch từ URL / Ảnh của bạn
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'url'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>Dán URL Truyện</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'upload'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Tải Ảnh / Chụp màn hình</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* URL Input Box */}
        {activeTab === 'url' ? (
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              URL Trang / Chapter Truyện
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                <Link2 className="w-4 h-4" />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://truyen.../chapter-123 hoặc dán link ảnh manga"
                required={activeTab === 'url'}
                className="w-full pl-10 pr-20 py-3 bg-slate-800/90 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={handlePaste}
                className="absolute right-2 px-2.5 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors flex items-center gap-1 active:scale-95"
                title="Dán từ Clipboard"
              >
                <Clipboard className="w-3 h-3" />
                <span>Dán</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Hỗ trợ hầu hết các trang đọc truyện Manga/Manhwa phổ biến hoặc URL ảnh trực tiếp (.jpg, .png, .webp).
            </p>
          </div>
        ) : (
          /* File Upload Box */
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Tải trang ảnh hoặc chụp màn hình truyện
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500/70 bg-slate-800/40 hover:bg-slate-800/70 rounded-xl p-4 sm:p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2"
            >
              <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="text-xs text-slate-300 font-medium">
                Kéo thả ảnh vào đây hoặc <span className="text-indigo-400 underline">chọn từ thiết bị</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Hỗ trợ PNG, JPG, WEBP (Có thể chọn nhiều trang cùng lúc)
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFilesSelected}
                className="hidden"
              />
            </div>

            {/* Uploaded Previews */}
            {uploadedImages.length > 0 && (
              <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                {uploadedImages.map((imgSrc, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-[3/4] bg-slate-950">
                    <img src={imgSrc} alt={`Trang ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeUploadedImage(idx)}
                      className="absolute top-1 right-1 p-0.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-full transition-colors"
                      title="Xóa trang này"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 px-1 py-0.2 text-[9px] font-mono bg-black/70 rounded text-slate-300">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Language Selection Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Source Lang */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
              <Languages className="w-3.5 h-3.5 text-indigo-400" />
              <span>Translate From (Ngôn ngữ gốc)</span>
            </label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              {SOURCE_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-200">
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target Lang */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Translate To (Dịch sang)</span>
            </label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
            >
              {TARGET_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-200">
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Submit Primary Action Button */}
        <button
          type="submit"
          disabled={isLoading || (activeTab === 'url' ? !url.trim() : uploadedImages.length === 0)}
          className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Đang trích xuất & xử lý OCR/Dịch truyện...</span>
            </>
          ) : (
            <>
              <span>
                {activeTab === 'url'
                  ? 'Bắt đầu Dịch Chapter (Translate)'
                  : `Dịch ${uploadedImages.length} trang đã tải lên`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
