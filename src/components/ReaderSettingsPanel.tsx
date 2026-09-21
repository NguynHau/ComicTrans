import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sun, Eye, Sliders } from 'lucide-react';

export type ReaderFilterType = 'none' | 'blue-light' | 'mono';

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
    // Tông ấm dịu mắt, lọc ánh sáng xanh ban đêm
    filters.push('sepia(0.38) saturate(0.85) hue-rotate(-20deg)');
  } else if (settings.filter === 'mono') {
    // Đen trắng tương phản cao cho truyện tranh
    filters.push('grayscale(1) contrast(1.15)');
  }

  return {
    filter: filters.join(' '),
    transition: 'filter 0.2s ease',
  };
};

const FILTER_ITEMS: { id: ReaderFilterType; label: string }[] = [
  { id: 'none', label: 'Mặc định' },
  { id: 'blue-light', label: 'Bảo vệ mắt' },
  { id: 'mono', label: 'Đen trắng' },
];

export const SlidingFilterSelector: React.FC<{
  currentFilter: ReaderFilterType;
  onChange: (filter: ReaderFilterType) => void;
}> = ({ currentFilter, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);

  const activeIndex = Math.max(
    0,
    FILTER_ITEMS.findIndex((f) => f.id === currentFilter)
  );

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const padding = 4;
  const usableWidth = Math.max(0, containerWidth - padding * 2);
  const itemWidth = usableWidth > 0 ? usableWidth / FILTER_ITEMS.length : 0;
  const maxTranslateX = itemWidth * (FILTER_ITEMS.length - 1);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    containerRef.current.setPointerCapture(e.pointerId);
    setIsDragging(true);

    const relX = e.clientX - rect.left - padding;
    const initialPillX = Math.max(0, Math.min(maxTranslateX, relX - itemWidth / 2));
    setDragX(initialPillX);

    const targetIdx = Math.max(
      0,
      Math.min(
        FILTER_ITEMS.length - 1,
        Math.floor((relX / usableWidth) * FILTER_ITEMS.length)
      )
    );
    onChange(FILTER_ITEMS[targetIdx].id);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left - padding;
    const currentPillX = Math.max(0, Math.min(maxTranslateX, relX - itemWidth / 2));
    setDragX(currentPillX);

    const hoveredIdx = Math.max(
      0,
      Math.min(
        FILTER_ITEMS.length - 1,
        Math.floor((relX / usableWidth) * FILTER_ITEMS.length)
      )
    );
    if (FILTER_ITEMS[hoveredIdx].id !== currentFilter) {
      onChange(FILTER_ITEMS[hoveredIdx].id);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {}
    setIsDragging(false);
    setDragX(null);
  };

  const targetX = activeIndex * itemWidth;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative flex items-center bg-[#0d0d10] p-1 rounded-2xl border border-zinc-800 select-none touch-none cursor-grab active:cursor-grabbing w-full overflow-hidden shadow-inner"
    >
      {/* Thẻ được chọn nền màu trắng, hỗ trợ trượt mượt và kéo ngón tay */}
      {itemWidth > 0 && (
        <motion.div
          className="absolute top-1 bottom-1 rounded-xl bg-white shadow-md shadow-black/40 z-0 pointer-events-none"
          style={{ width: itemWidth }}
          animate={{
            x: isDragging && dragX !== null ? dragX : targetX,
          }}
          transition={
            isDragging
              ? { duration: 0 }
              : { type: 'spring', stiffness: 450, damping: 35 }
          }
        />
      )}

      {/* 3 nút nhãn xếp ngang nhau trong cùng 1 container */}
      {FILTER_ITEMS.map((item, idx) => {
        const isActive = activeIndex === idx;
        return (
          <button
            key={item.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(item.id);
            }}
            className={`relative z-10 flex-1 py-2 sm:py-2.5 text-center text-xs transition-colors duration-150 select-none flex items-center justify-center gap-1 ${
              isActive
                ? 'text-zinc-950 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200 font-semibold'
            }`}
          >
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export const ReaderSettingsPanel: React.FC<ReaderSettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  return (
    <div className="w-full bg-[#141417] border border-zinc-800 rounded-2xl p-3.5 sm:p-4 text-xs space-y-4 shadow-2xl animate-fadeIn">
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

      {/* Bộ lọc chế độ đọc: 3 nút xếp ngang cùng 1 container với cơ chế trượt mượt mà */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-zinc-300 font-medium">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-indigo-400" />
            <span>Bộ lọc màu & bảo vệ mắt</span>
          </div>
        </div>

        <SlidingFilterSelector
          currentFilter={settings.filter}
          onChange={(newFilter) => onUpdateSettings({ filter: newFilter })}
        />
      </div>
    </div>
  );
};
