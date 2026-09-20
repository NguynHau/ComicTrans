import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-amber-200 text-xs flex items-center justify-center gap-2">
      <WifiOff className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
      <span>
        Bạn đang offline. Các trang truyện đã tải trước đó vẫn có thể xem từ bộ nhớ đệm cache PWA.
      </span>
    </div>
  );
};
