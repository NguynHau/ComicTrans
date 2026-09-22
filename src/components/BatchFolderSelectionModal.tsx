import React, { useState, useEffect } from 'react';
import { X, Folder, Plus, FolderPlus, Check, ChevronRight } from 'lucide-react';
import { MangaFolder } from '../types';
import { getFoldersFromStorage, saveFoldersToStorage } from '../lib/storage';

interface BatchFolderSelectionModalProps {
  seriesName: string;
  onSelect: (folder: MangaFolder) => void;
  onCancel: () => void;
}

export const BatchFolderSelectionModal: React.FC<BatchFolderSelectionModalProps> = ({
  seriesName,
  onSelect,
  onCancel,
}) => {
  const [folders, setFolders] = useState<MangaFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(true);
  const [newFolderName, setNewFolderName] = useState<string>(seriesName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const stored = await getFoldersFromStorage();
        setFolders(stored);
        
        // Try to match seriesName with an existing folder
        const match = stored.find(
          (f) => f.name.toLowerCase().trim() === seriesName.toLowerCase().trim()
        );
        if (match) {
          setSelectedFolderId(match.id);
          setIsCreatingNew(false);
        } else if (stored.length > 0) {
          setSelectedFolderId(stored[0].id);
          setIsCreatingNew(false);
        } else {
          setIsCreatingNew(true);
        }
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, [seriesName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (isCreatingNew) {
        const nameTrim = newFolderName.trim();
        if (!nameTrim) {
          setError('Vui lòng nhập tên thư mục mới');
          return;
        }

        const existing = folders.find(
          (f) => f.name.toLowerCase().trim() === nameTrim.toLowerCase().trim()
        );

        if (existing) {
          onSelect(existing);
        } else {
          const newFolder: MangaFolder = {
            id: 'folder_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            name: nameTrim,
            createdAt: new Date().toISOString(),
          };
          const updated = [newFolder, ...folders];
          await saveFoldersToStorage(updated);
          onSelect(newFolder);
        }
      } else {
        const found = folders.find((f) => f.id === selectedFolderId);
        if (found) {
          onSelect(found);
        } else {
          setError('Thư mục được chọn không hợp lệ');
        }
      }
    } catch (err) {
      setError('Đã xảy ra lỗi khi tạo thư mục');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#0a0a0c] border border-zinc-800/80 shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-[#e06b3a]" />
            <h3 className="text-sm font-bold text-zinc-100">Chọn Thư Mục Lưu Trữ</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-zinc-400 font-semibold leading-relaxed">
              Phiên dịch tự động phát hiện bộ truyện:
            </p>
            <p className="text-xs text-emerald-400 font-mono font-bold truncate">
              {seriesName}
            </p>
          </div>

          {/* Mode Switcher */}
          {folders.length > 0 && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 rounded-xl border border-zinc-900">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                  !isCreatingNew
                    ? 'bg-zinc-900 text-zinc-200 border border-zinc-800/60 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Chọn thư mục hiện có
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                  isCreatingNew
                    ? 'bg-zinc-900 text-zinc-200 border border-zinc-800/60 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Tạo thư mục mới
              </button>
            </div>
          )}

          {/* New Folder Option */}
          {isCreatingNew ? (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Tên thư mục mới
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nhập tên thư mục..."
                  className="w-full h-11 px-4 text-xs rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#e06b3a]/50 transition-colors"
                  required
                />
                <FolderPlus className="absolute right-3 top-3.5 w-4 h-4 text-zinc-600" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Danh sách thư mục truyện của bạn
              </label>
              <div className="max-h-[160px] overflow-y-auto rounded-xl border border-zinc-900 bg-zinc-950 divide-y divide-zinc-900/60 custom-scrollbar">
                {folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFolderId(f.id)}
                    className="w-full flex items-center justify-between p-3 text-left transition-colors hover:bg-zinc-900/50"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Folder className={`w-4 h-4 ${selectedFolderId === f.id ? 'text-[#e06b3a]' : 'text-zinc-600'}`} />
                      <span className={`text-xs truncate ${selectedFolderId === f.id ? 'text-zinc-100 font-bold' : 'text-zinc-400'}`}>
                        {f.name}
                      </span>
                    </div>
                    {selectedFolderId === f.id && (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-[11px] text-rose-400 font-bold text-center">
              ⚠ {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-bold transition-colors active:scale-[0.98]"
            >
              Hủy bỏ (Tự lưu mặc định)
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#e06b3a] hover:bg-[#c9592b] text-white text-xs font-bold transition-all shadow-md shadow-[#e06b3a]/10 flex items-center justify-center gap-1 active:scale-[0.98]"
            >
              <span>Xác nhận</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
