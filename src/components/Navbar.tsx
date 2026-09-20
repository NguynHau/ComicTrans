import React from 'react';
import { Download, WifiOff, Settings, ArrowLeft } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface NavbarProps {
  onOpenApiDocs?: () => void;
  onOpenSettings: () => void;
  onReset: () => void;
  hasActiveJob: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSettings,
  onReset,
  hasActiveJob,
}) => {
  const { isInstallable, triggerInstall } = usePWAInstall();
  const isOnline = useOnlineStatus();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0d0d0f]/95 backdrop-blur-md border-b border-zinc-800/40 text-zinc-100">
      {/* Main Bar */}
      <div className="max-w-md mx-auto px-4 h-12 flex items-center justify-between">
        {hasActiveJob ? (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white font-medium py-1.5 px-2 -ml-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#e06b3a]" />
            <span>Trở về</span>
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <span className="font-serif-logo text-lg tracking-wide text-zinc-100 font-bold">Comic</span>
            <span className="font-serif-logo text-lg italic font-bold text-[#e06b3a]">Trans</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <WifiOff className="w-3 h-3" />
              Ngoại tuyến
            </span>
          )}
          {isInstallable && (
            <button
              onClick={triggerInstall}
              className="text-[11px] text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20"
              title="Cài đặt ứng dụng về màn hình chính"
            >
              <Download className="w-3 h-3" />
              Cài app
            </button>
          )}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
            title="Cài đặt API Key & Tùy chọn"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
