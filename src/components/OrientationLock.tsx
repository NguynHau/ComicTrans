import React, { useEffect, useState } from 'react';
import { Smartphone, RotateCw } from 'lucide-react';

export const OrientationLock: React.FC = () => {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    // Attempt system orientation lock if available
    try {
      if (typeof window !== 'undefined' && 'screen' in window && 'orientation' in window.screen) {
        const orientation = window.screen.orientation as any;
        if (orientation && typeof orientation.lock === 'function') {
          orientation.lock('portrait').catch(() => {
            // Browsers often reject this without user gesture or fullscreen, which is normal
          });
        }
      }
    } catch {
      // Ignore
    }

    const checkOrientation = () => {
      // Check if width is greater than height and screen width is typical mobile/tablet size
      const isLand = window.innerWidth > window.innerHeight && window.innerHeight < 650;
      setIsLandscape(isLand);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isLandscape) return null;

  return (
    <div
      id="orientation-lock-screen"
      className="fixed inset-0 z-[9999] bg-[#0b0b0d]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white"
    >
      <div className="relative mb-6">
        <div className="w-16 h-24 border-2 border-orange-500/80 rounded-2xl flex items-center justify-center relative shadow-lg shadow-orange-500/20 animate-pulse">
          <div className="w-8 h-1 bg-zinc-700 rounded-full absolute top-2" />
          <div className="w-2 h-2 rounded-full bg-zinc-700 absolute bottom-2" />
          <Smartphone className="w-8 h-8 text-orange-400" />
        </div>
        <div className="absolute -top-2 -right-2 p-1.5 bg-orange-600 rounded-full text-white animate-spin duration-1000">
          <RotateCw className="w-4 h-4" />
        </div>
      </div>

      <h2 className="text-lg font-bold text-zinc-100 mb-2 font-serif-logo tracking-wide">
        Vui lòng xoay dọc điện thoại
      </h2>
      <p className="text-xs text-zinc-400 max-w-xs leading-relaxed mb-4">
        <span className="text-zinc-200 font-semibold">RiXia</span> được tối ưu hóa chuyên biệt cho màn hình dọc di động. Hãy giữ điện thoại thẳng đứng để tiếp tục đọc truyện.
      </p>

      <div className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
        Khóa hướng hiển thị: <span className="text-orange-400 font-medium">Màn hình dọc</span>
      </div>
    </div>
  );
};
