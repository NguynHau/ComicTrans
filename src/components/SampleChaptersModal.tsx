import React from 'react';
import { Sparkles, X, Play, BookOpen } from 'lucide-react';
import { SampleChapter } from '../types';

const SAMPLES: SampleChapter[] = [
  {
    id: 'sample-jp',
    title: 'One Piece - Chapter 1090 [Trang mẫu Tiếng Nhật]',
    type: 'Manga (JP)',
    url: 'sample://manga/chapter-1',
    source_language: 'ja',
    target_language: 'vi',
    thumbnail: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=80',
    description: 'Trang truyện Shonen hành động nhiều bong bóng thoại thoại tiếng Nhật kanji/hiragana.',
  },
  {
    id: 'sample-kr',
    title: 'Solo Leveling - Episode 1 [Webtoon Tiếng Hàn]',
    type: 'Manhwa (KR)',
    url: 'sample://manhwa/action',
    source_language: 'ko',
    target_language: 'vi',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
    description: 'Khổ dọc Webtoon đặc trưng Hàn Quốc với hiệu ứng hình ảnh sắc nét và font chữ Hangul.',
  },
  {
    id: 'sample-zh',
    title: 'Đấu Phá Thương Khung - Chap 88 [Manhua Tiếng Trung]',
    type: 'Manhua (ZH)',
    url: 'sample://manhua/cultivation',
    source_language: 'zh',
    target_language: 'vi',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80',
    description: 'Manhua tu tiên Trung Quốc chữ Hán giản thể với màu sắc phong phú.',
  },
];

interface SampleChaptersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (sample: SampleChapter) => void;
}

export const SampleChaptersModal: React.FC<SampleChaptersModalProps> = ({
  isOpen,
  onClose,
  onSelectSample,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Chọn Chapter Mẫu Dùng Thử</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal List */}
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {SAMPLES.map((sample) => (
            <div
              key={sample.id}
              className="group relative bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl p-3 flex gap-3 transition-all cursor-pointer"
              onClick={() => {
                onSelectSample(sample);
                onClose();
              }}
            >
              <img
                src={sample.thumbnail}
                alt={sample.title}
                className="w-20 h-24 object-cover rounded-lg flex-shrink-0 bg-slate-900"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                      {sample.type}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {sample.source_language.toUpperCase()} → {sample.target_language.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                    {sample.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                    {sample.description}
                  </p>
                </div>

                <div className="flex items-center text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform gap-1 mt-2">
                  <Play className="w-3 h-3 fill-indigo-400" />
                  <span>Dịch chapter này</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
