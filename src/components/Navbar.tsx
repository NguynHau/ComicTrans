import React, { useState } from 'react';
import { Home, Settings, RefreshCw } from 'lucide-react';

interface NavbarProps {
  onOpenApiDocs?: () => void;
  onOpenSettings: () => void;
  onOpenUpdateModal: () => void;
  onReset: () => void;
  hasActiveJob: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSettings,
  onOpenUpdateModal,
  onReset,
  hasActiveJob,
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');

  const handleHomeClick = () => {
    setActiveTab('home');
    onReset();
  };

  const handleSettingsClick = () => {
    setActiveTab('settings');
    onOpenSettings();
  };

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 animate-fadeIn pointer-events-auto">
      <nav className="bg-[#18181c]/90 backdrop-blur-md border border-zinc-700/70 rounded-full px-2 py-1.5 flex items-center gap-1 shadow-2xl shadow-black/80 text-xs">
        {/* Home Tab */}
        <button
          type="button"
          onClick={handleHomeClick}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-medium transition-all ${
            !hasActiveJob && activeTab === 'home'
              ? 'bg-[#e06b3a] text-white font-bold shadow-md shadow-orange-950/50'
              : 'text-zinc-300 hover:text-white hover:bg-zinc-800/70'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>

        {/* Settings Tab */}
        <button
          type="button"
          onClick={handleSettingsClick}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-medium transition-all ${
            activeTab === 'settings'
              ? 'bg-[#e06b3a] text-white font-bold shadow-md shadow-orange-950/50'
              : 'text-zinc-300 hover:text-white hover:bg-zinc-800/70'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Cài đặt</span>
        </button>

        {/* Separator */}
        <div className="h-4 w-[1px] bg-zinc-700/80 my-auto mx-0.5" />

        {/* Quick Check Update Button */}
        <button
          type="button"
          onClick={onOpenUpdateModal}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-all text-[11px]"
          title="Kiểm tra bản cập nhật mới"
        >
          <RefreshCw className="w-3 h-3 text-[#e06b3a]" />
          <span className="hidden sm:inline font-medium">Cập nhật</span>
        </button>
      </nav>
    </div>
  );
};



