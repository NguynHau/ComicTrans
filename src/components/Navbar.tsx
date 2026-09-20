import React from 'react';
import { BookOpen, Download, Smartphone, Wifi, WifiOff, FileCode2, Sparkles, Settings } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface NavbarProps {
  onOpenApiDocs: () => void;
  onOpenSamples: () => void;
  onOpenSettings: () => void;
  onReset: () => void;
  hasActiveJob: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenApiDocs,
  onOpenSamples,
  onOpenSettings,
  onReset,
  hasActiveJob,
}) => {
  const { isInstallable, isInstalled, isIOS, triggerInstall } = usePWAInstall();
  const isOnline = useOnlineStatus();

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <button
          onClick={onReset}
          className="flex items-center gap-2.5 text-left group focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              MangaTranslate
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PWA
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium leading-none">
              OCR & AI Localization
            </p>
          </div>
        </button>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Sample Picker button */}
          <button
            onClick={onOpenSamples}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
            title="Dùng thử với các chapter mẫu (Tiếng Nhật/Hàn/Trung)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Chapter mẫu</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Cài đặt API Key"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* API Docs Button */}
          <button
            onClick={onOpenApiDocs}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Xem tài liệu REST API"
          >
            <FileCode2 className="w-4 h-4" />
          </button>

          {/* PWA Install Trigger */}
          {isInstallable && (
            <button
              onClick={triggerInstall}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Cài App</span>
            </button>
          )}

          {/* Connection status dot */}
          <div
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-emerald-400 ring-4 ring-emerald-400/20' : 'bg-rose-500 ring-4 ring-rose-500/20'
            }`}
            title={isOnline ? 'Đang online' : 'Đang offline'}
          />
        </div>
      </div>
    </header>
  );
};
