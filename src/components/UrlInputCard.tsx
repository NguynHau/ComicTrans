import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Globe,
  Clipboard,
  Sparkles,
  AlertCircle,
  Camera,
  Image as ImageIcon,
  FolderArchive,
  FileText,
  Trash2,
  BookOpen,
  ArrowRight,
  X,
  Languages,
  AlertTriangle,
  Key,
  Lightbulb,
  Layers,
  ChevronRight,
} from 'lucide-react';
import JSZip from 'jszip';
import { RecentItem, DetailedError } from '../types';
import { analyzeChapterUrl } from '../lib/chapterUrlUtils';

interface UrlInputCardProps {
  onSubmit: (
    url: string,
    sourceLang: string,
    targetLang: string,
    images?: string[],
    isBatchMode?: boolean
  ) => Promise<void>;
  isLoading: boolean;
  errorMessage?: string | null;
  detailedError?: DetailedError | null;
  onOpenSettings: () => void;
  onResumeRecent?: (item: RecentItem) => void;
}

const SOURCES = [
  { id: 'jp', label: 'J-Comic (JP)', lang: 'ja', hint: 'Manga Nhật (Tiếng Nhật)' },
  { id: 'kr', label: 'ManhwaHub (KR)', lang: 'ko', hint: 'Manhwa Hàn (Tiếng Hàn)' },
  { id: 'en', label: 'MangaPlus (EN)', lang: 'en', hint: 'Truyện tiếng Anh' },
  { id: 'gl', label: 'Webtoons (GL)', lang: 'ko', hint: 'Webtoon bản quốc tế' },
  { id: 'custom', label: 'Generic Web URL', lang: 'auto', hint: 'Dán liên kết web bất kỳ' },
];

export const UrlInputCard: React.FC<UrlInputCardProps> = ({
  onSubmit,
  isLoading,
  errorMessage,
  detailedError,
  onOpenSettings,
  onResumeRecent,
}) => {
  const [url, setUrl] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang] = useState('vi'); // Always Vietnamese target as requested
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isProcessingZip, setIsProcessingZip] = useState(false);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Load recents from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('COMIC_TRANS_RECENTS');
      if (stored) {
        setRecents(JSON.parse(stored));
      }
    } catch {
      // Ignore
    }
  }, []);

  const handlePaste = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setUrl(text.trim());
          return;
        }
      }
    } catch (err) {
      console.warn('Direct clipboard read failed:', err);
    }

    const inputEl = document.getElementById('comic-url-input') as HTMLInputElement;
    if (inputEl) {
      inputEl.focus();
      try {
        document.execCommand('paste');
      } catch {
        // ignore
      }
    }
  };

  const handleSourceClick = (source: typeof SOURCES[0]) => {
    setSourceLang(source.lang);
    const inputEl = document.getElementById('comic-url-input');
    inputEl?.focus();
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

  // Handle CBZ / ZIP extraction directly in browser
  const handleZipSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingZip(true);
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const extractedImages: string[] = [];

      // Sort files naturally by filename
      const fileNames = Object.keys(contents.files)
        .filter((name) => !name.startsWith('__MACOSX') && /\.(jpe?g|png|webp)$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      for (const fileName of fileNames) {
        const zipEntry = contents.files[fileName];
        if (!zipEntry.dir) {
          const blob = await zipEntry.async('blob');
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          extractedImages.push(dataUrl);
        }
      }

      if (extractedImages.length > 0) {
        setUploadedImages((prev) => [...prev, ...extractedImages]);
      }
    } catch (err) {
      console.error('Lỗi đọc file nén:', err);
    } finally {
      setIsProcessingZip(false);
    }
  };

  const removeUploadedImage = (idx: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearRecents = () => {
    localStorage.removeItem('COMIC_TRANS_RECENTS');
    setRecents([]);
  };

  const urlAnalysis = useMemo(() => {
    if (!url.trim() || !url.startsWith('http')) return null;
    return analyzeChapterUrl(url.trim());
  }, [url]);

  const handleSubmitSingle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (uploadedImages.length > 0) {
      onSubmit('', sourceLang, targetLang, uploadedImages, false);
    } else if (url.trim()) {
      onSubmit(url.trim(), sourceLang, targetLang, undefined, false);
    }
  };

  const handleSubmitBatch = () => {
    if (url.trim()) {
      onSubmit(url.trim(), sourceLang, targetLang, undefined, true);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-fadeIn pb-12 select-none">
      {/* Brand & Subtitle (Matches User Mockup Exactly) */}
      <div className="pt-2 text-left">
        <h1 className="text-3xl sm:text-4xl font-serif-logo font-bold tracking-tight leading-none text-zinc-100 flex items-center">
          <span>Ri</span>
          <span className="italic text-[#e06b3a] ml-0.5">Xia</span>
        </h1>
        <p className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-zinc-500 uppercase mt-2">
          DỊCH VÀ ĐỌC TRUYỆN THEO CÁCH CỦA BẠN.
        </p>
      </div>

      {/* Pill Search / URL Input Field (Matches Mockup) */}
      <div className="space-y-2.5">
        <form onSubmit={handleSubmitSingle} className="relative">
          <div className="relative flex items-center w-full bg-[#18181c]/90 hover:bg-[#1f1f24] border border-zinc-800 focus-within:border-zinc-600 rounded-full px-4 py-3 transition-all shadow-lg shadow-black/40">
            <Globe className="w-4 h-4 text-zinc-400 flex-shrink-0 mr-3" />
            <input
              id="comic-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Dán liên kết truyện để dịch..."
              className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none pr-16"
            />
            {url ? (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="text-zinc-500 hover:text-zinc-300 p-1 mr-1"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePaste}
                className="text-[11px] font-medium text-zinc-400 hover:text-orange-400 px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 transition-colors"
                title="Dán từ khay nhớ tạm"
              >
                Dán
              </button>
            )}
          </div>
        </form>

        {/* Smart Chapter Detection Box & Action Buttons */}
        {url.trim() && urlAnalysis && (
          <div className="p-3 bg-[#141417] border border-zinc-800/90 rounded-2xl space-y-2.5 animate-fadeIn">
            {urlAnalysis.isRecognized ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-orange-300 font-semibold truncate">
                    <Sparkles className="w-3.5 h-3.5 text-[#e06b3a] flex-shrink-0" />
                    <span className="truncate">
                      {urlAnalysis.seriesName} • {urlAnalysis.currentChapterTitle}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono flex-shrink-0">
                    Tự động tiếp {urlAnalysis.nextChapterTitle}...
                  </span>
                </div>

                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleSubmitBatch}
                    disabled={isLoading}
                    className="flex-1 py-2 px-3 bg-gradient-to-r from-orange-600 to-[#e06b3a] hover:from-orange-500 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-950/40 flex items-center justify-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Dịch toàn bộ truyện</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitSingle}
                    disabled={isLoading}
                    className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors border border-zinc-700/80"
                  >
                    Chỉ dịch 1 chap
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[11px] text-zinc-400">
                  Không phát hiện mẫu số chương tự động. Sẽ dịch 1 chương này.
                </span>
                <button
                  type="button"
                  onClick={handleSubmitSingle}
                  disabled={isLoading}
                  className="py-1.5 px-3 bg-[#e06b3a] text-white rounded-xl text-xs font-bold transition-all"
                >
                  Dịch chương này
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Granular Error Banner on Landing */}
      {(detailedError || errorMessage) && (
        <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs space-y-2.5 animate-fadeIn shadow-lg shadow-black/40">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 w-full">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {detailedError?.categoryLabel || 'Lỗi thực thi'}
                </span>
              </div>
              <h4 className="font-semibold text-rose-100 text-xs sm:text-sm">
                {detailedError?.title || 'Không thể bắt đầu dịch truyện'}
              </h4>
              <p className="text-zinc-300 text-xs leading-relaxed">
                {detailedError?.message || errorMessage}
              </p>
            </div>
          </div>

          {detailedError?.suggestion && (
            <div className="p-2.5 rounded-xl bg-[#141417]/90 border border-amber-500/30 text-amber-200/90 text-[11px] leading-relaxed flex items-start gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 font-medium">Gợi ý xử lý: </strong>
                <span>{detailedError.suggestion}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-0.5">
            {(detailedError?.actionType === 'open_settings' || !detailedError) && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e06b3a] hover:bg-orange-600 text-white rounded-xl font-medium text-xs transition-colors shadow-md shadow-orange-950/40"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{detailedError?.actionLabel || 'Cấu hình API Key'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Uploaded Images Preview if any */}
      {uploadedImages.length > 0 && (
        <div className="bg-[#141417] border border-zinc-800/90 rounded-2xl p-3 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Đã chọn <strong className="text-zinc-200">{uploadedImages.length}</strong> trang ảnh</span>
            <button
              type="button"
              onClick={() => setUploadedImages([])}
              className="text-rose-400 hover:text-rose-300 text-[11px]"
            >
              Xóa tất cả
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
            {uploadedImages.map((imgSrc, idx) => (
              <div key={idx} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-zinc-700/60 group">
                <img src={imgSrc} alt={`Trang ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeUploadedImage(idx)}
                  className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-rose-600 text-white rounded-full transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
                <span className="absolute bottom-1 left-1 px-1 bg-black/70 text-[9px] rounded text-zinc-300">
                  #{idx + 1}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => handleSubmitSingle()}
            disabled={isLoading}
            className="w-full py-2.5 bg-[#e06b3a] hover:bg-orange-600 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-orange-900/30"
          >
            <span>Bắt đầu dịch {uploadedImages.length} trang</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Section 1: Translation Sources (Nguồn dịch) */}
      <div className="space-y-2.5">
        <h2 className="text-sm font-semibold text-zinc-200">Nguồn dịch</h2>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((src) => (
            <button
              key={src.id}
              type="button"
              onClick={() => handleSourceClick(src)}
              className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 hover:text-zinc-100 border border-zinc-800/80 hover:border-zinc-700 transition-all active:scale-95 text-left"
              title={src.hint}
            >
              {src.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 2: Recent (Gần đây) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-serif-logo font-bold text-zinc-100">Gần đây</h2>
          {recents.length > 0 && (
            <button
              onClick={clearRecents}
              className="text-[11px] text-zinc-500 hover:text-rose-400 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa lịch sử</span>
            </button>
          )}
        </div>

        {recents.length === 0 ? (
          /* Empty State Matches Mockup Exactly */
          <div className="flex items-center gap-4 p-1">
            {/* Dashed placeholder box */}
            <div className="w-24 h-32 rounded-2xl border border-dashed border-zinc-800 bg-[#121215]/60 flex items-center justify-center flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#e06b3a]">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            {/* Description Text */}
            <div className="space-y-1 pr-2">
              <h3 className="text-sm font-semibold text-zinc-200">
                Chưa có bản dịch nào
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Dán một URL, chọn nguồn truyện, hoặc tải tệp lên để bắt đầu
              </p>
            </div>
          </div>
        ) : (
          /* Recent Items List */
          <div className="space-y-2">
            {recents.slice(0, 3).map((item) => (
              <div
                key={item.id}
                onClick={() => onResumeRecent?.(item)}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-[#141417] hover:bg-[#1a1a1f] border border-zinc-800 cursor-pointer transition-all active:scale-[0.99] group"
              >
                <div className="w-12 h-16 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden flex-shrink-0">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#e06b3a]">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-zinc-200 truncate group-hover:text-orange-400 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {item.completedPages}/{item.totalPages} trang • {item.timestamp}
                  </p>
                  <span className="inline-block mt-1 text-[10px] text-orange-400/90 font-medium">
                    Nhấn để tiếp tục đọc →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Translate your own files (Tự tải tệp lên) */}
      <div className="space-y-2.5 pt-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Tự tải tệp lên</h2>
          <span className="text-[11px] text-zinc-500 block">(hoặc định dạng tương tự)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Upload Images / Album */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 hover:text-zinc-100 border border-zinc-800/80 hover:border-zinc-700 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span>Tải ảnh / Album</span>
          </button>

          {/* Upload PDF */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 hover:text-zinc-100 border border-zinc-800/80 hover:border-zinc-700 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <span>Tải tệp PDF</span>
          </button>

          {/* Upload CBZ / ZIP */}
          <button
            type="button"
            onClick={() => zipInputRef.current?.click()}
            disabled={isProcessingZip}
            className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 hover:text-zinc-100 border border-zinc-800/80 hover:border-zinc-700 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <FolderArchive className="w-3.5 h-3.5 text-zinc-400" />
            <span>{isProcessingZip ? 'Đang giải nén...' : 'Tải tệp CBZ / ZIP'}</span>
          </button>
        </div>
      </div>

      {/* Section 4: Reading in another app (Đọc trên ứng dụng khác) */}
      <div className="space-y-2.5 pt-2">
        <h2 className="text-sm font-semibold text-zinc-200">Đọc trên ứng dụng khác</h2>
        <div className="flex flex-wrap gap-2">
          {/* Quick Capture (Camera directly) */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 hover:text-zinc-100 border border-zinc-800/80 hover:border-zinc-700 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5 text-zinc-400" />
            <span>Chụp nhanh</span>
          </button>

          {/* Screenshot */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 hover:text-zinc-100 border border-zinc-800/80 hover:border-zinc-700 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span>Ảnh chụp màn hình</span>
          </button>

          {/* URL Sniffer (Read Clipboard automatically) */}
          <button
            type="button"
            onClick={handlePaste}
            className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 hover:text-zinc-100 border border-zinc-800/80 hover:border-zinc-700 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Clipboard className="w-3.5 h-3.5 text-zinc-400" />
            <span>Bắt link tự động</span>
          </button>
        </div>
      </div>

      {/* Subtle Source Language Switcher Option */}
      <div className="pt-2 flex items-center justify-start text-xs text-zinc-500">
        <button
          type="button"
          onClick={() => setShowLangPicker(!showLangPicker)}
          className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors"
        >
          <Languages className="w-3.5 h-3.5 text-[#e06b3a]" />
          <span>
            Ngôn ngữ gốc: <strong className="text-zinc-400">{sourceLang === 'auto' ? 'Tự nhận diện' : sourceLang.toUpperCase()}</strong> → <strong className="text-[#e06b3a]">Tiếng Việt</strong>
          </span>
        </button>
      </div>

      {/* Expandable Language Picker */}
      {showLangPicker && (
        <div className="bg-[#141417] border border-zinc-800 rounded-xl p-3 space-y-2 animate-fadeIn text-xs">
          <span className="text-zinc-400 font-medium block">Chọn ngôn ngữ của truyện gốc:</span>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { code: 'auto', name: 'Tự động nhận diện' },
              { code: 'ja', name: 'Tiếng Nhật (Manga)' },
              { code: 'ko', name: 'Tiếng Hàn (Manhwa)' },
              { code: 'zh', name: 'Tiếng Trung (Manhua)' },
              { code: 'en', name: 'Tiếng Anh (Comic)' },
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setSourceLang(item.code);
                  setShowLangPicker(false);
                }}
                className={`py-1.5 px-2.5 rounded-lg text-left text-xs transition-colors ${
                  sourceLang === item.code
                    ? 'bg-[#e06b3a] text-white font-medium'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Message if any */}
      {errorMessage && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFilesSelected}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilesSelected}
        className="hidden"
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,.cbz"
        onChange={handleZipSelected}
        className="hidden"
      />
    </div>
  );
};
