import React from 'react';
import { Sun, Moon, Eye, Sliders, Check } from 'lucide-react';

export type ReaderFilterType = 'none' | 'blue-light' | 'sepia' | 'mono';

export interface ReaderSettings {
  brightness: number; // 30 - 150
  filter: ReaderFilterType;
}

interface ReaderSettingsPanelProps {
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  onClose?: () => void;
}

export const getFilterStyle = (settings: ReaderSettings): React.CSSProperties => {
  const filters: string[] = [`brightness(${settings.brightness}%)`];

  if (settings.filter === 'blue-light') {
    // Warm tone, reduced harsh blue light for nighttime reading
    filters.push('sepia(0.35) saturate(0.85) hue-rotate(-20deg)');
  } else if (settings.filter === 'sepia') {
    // Classic yellowed vintage paper tone
    filters.push('sepia(0.65) contrast(0.95)');
  } else if (settings.filter === 'mono') {
    // High contrast black & white manga style
    filters.push('grayscale(1) contrast(1.15)');
  }

  return {
    filter: filters.join(' '),
    transition: 'filter 0.2s ease',
  };
};

export const ReaderSettingsPanel: React.FC<ReaderSettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  return (
    <div className="w-full bg-[#141417] border border-zinc-800 rounded-2xl p-3.5 sm:p-4 text-xs space-y-3.5 shadow-2xl animate-fadeIn">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 font-bold text-zinc-200">
          <Sliders className="w-4 h-4 text-[#e06b3a]" />
          <span>Tùy chỉnh Trình đọc</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 font-medium px-2 py-0.5 rounded bg-zinc-800/60"
          >
            Đóng
          </button>
        )}
      </div>

      {/* Độ sáng */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-zinc-300">
          <div className="flex items-center gap-1.5 font-medium">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Độ sáng màn hình</span>
          </div>
          <span className="font-mono text-zinc-400 text-[11px]">{settings.brightness}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">Tối</span>
          <input
            type="range"
            min="30"
            max="150"
            step="5"
            value={settings.brightness}
            onChange={(e) => onUpdateSettings({ brightness: Number(e.target.value) })}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#e06b3a]"
          />
          <span className="text-[10px] text-zinc-500">Sáng</span>
        </div>
      </div>

      {/* Bộ lọc ánh sáng & chế độ đọc */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-zinc-300 font-medium">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-indigo-400" />
            <span>Chế độ bảo vệ mắt & Bộ lọc màu</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => onUpdateSettings({ filter: 'none' })}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 font-medium transition-all ${
              settings.filter === 'none'
                ? 'bg-[#e06b3a] text-white shadow-md shadow-orange-950/40 font-bold'
                : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            {settings.filter === 'none' && <Check className="w-3 h-3" />}
            <span>Mặc định</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ filter: 'blue-light' })}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 font-medium transition-all ${
              settings.filter === 'blue-light'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40 font-bold'
                : 'bg-zinc-850 hover:bg-zinc-800 text-amber-300/80 hover:text-amber-200 border border-zinc-800'
            }`}
            title="Lọc ánh sáng xanh, bảo vệ mắt ban đêm"
          >
            <Moon className="w-3 h-3" />
            <span>Ban đêm</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ filter: 'sepia' })}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 font-medium transition-all ${
              settings.filter === 'sepia'
                ? 'bg-amber-700 text-amber-100 shadow-md font-bold'
                : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
            title="Tông giấy ngả vàng cổ điển"
          >
            {settings.filter === 'sepia' && <Check className="w-3 h-3" />}
            <span>Sepia</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ filter: 'mono' })}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 font-medium transition-all ${
              settings.filter === 'mono'
                ? 'bg-zinc-700 text-white shadow-md font-bold'
                : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
            title="Đen trắng tương phản cao"
          >
            {settings.filter === 'mono' && <Check className="w-3 h-3" />}
            <span>Đen trắng</span>
          </button>
        </div>
      </div>
    </div>
  );
};
