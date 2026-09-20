import React, { useState, useEffect } from 'react';
import { X, Folder, Plus, BookmarkCheck } from 'lucide-react';
import { MangaJob, MangaPage, MangaFolder, RecentItem } from '../types';
import { suggestMangaAndChapter } from '../lib/mangaUtils';

interface SaveFolderModalProps {
  job: MangaJob;
  pages: MangaPage[];
  onClose: () => void;
  onSaveSuccess: () => void;
}

export const SaveFolderModal: React.FC<SaveFolderModalProps> = ({
  job,
  pages,
  onClose,
  onSaveSuccess,
}) => {
  const [folders, setFolders] = useState<MangaFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [chapterName, setChapterName] = useState<string>('');

  useEffect(() => {
    try {
      const storedFolders = localStorage.getItem('COMIC_TRANS_FOLDERS');
      const parsedFolders: MangaFolder[] = storedFolders ? JSON.parse(storedFolders) : [];
      setFolders(parsedFolders);

      const suggestions = suggestMangaAndChapter(job.source_url);
      setNewFolderName(suggestions.mangaName);
      setChapterName(suggestions.chapterName);

      // If folders exist, default to the first one or 'new'
      if (parsedFolders.length > 0) {
        // Check if any folder matches the suggested manga name
        const match = parsedFolders.find(f => f.name.toLowerCase() === suggestions.mangaName.toLowerCase());
        if (match) {
          setSelectedFolderId(match.id);
        } else {
          setSelectedFolderId(parsedFolders[0].id);
        }
      } else {
        setIsCreatingNew(true);
      }
    } catch (e) {
      console.warn('Failed to load folders:', e);
      setIsCreatingNew(true);
    }
  }, [job]);

  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let targetFolderId = selectedFolderId;
      let targetFolderName = '';

      let currentFolders = [...folders];

      if (isCreatingNew || !targetFolderId) {
        const folderNameTrim = newFolderName.trim() || 'Bộ truyện mới';
        // check if folder already exists
        const existing = currentFolders.find(f => f.name.toLowerCase() === folderNameTrim.toLowerCase());
        if (existing) {
          targetFolderId = existing.id;
          targetFolderName = existing.name;
        } else {
          const newFolder: MangaFolder = {
            id: 'folder_' + Date.now(),
            name: folderNameTrim,
            createdAt: new Date().toISOString(),
          };
          currentFolders.unshift(newFolder);
          targetFolderId = newFolder.id;
          targetFolderName = newFolder.name;
          localStorage.setItem('COMIC_TRANS_FOLDERS', JSON.stringify(currentFolders));
        }
      } else {
        const found = currentFolders.find(f => f.id === targetFolderId);
        targetFolderName = found ? found.name : 'Thư mục truyện';
      }

      const recentItem: RecentItem = {
        id: job.job_id,
        title: chapterName.trim() || 'Chương truyện',
        folderId: targetFolderId,
        folderName: targetFolderName,
        sourceUrl: job.source_url,
        thumbnail: pages[0]?.processed_image || pages[0]?.source_image,
        totalPages: pages.length,
        completedPages: pages.filter(p => p.status === 'completed').length || pages.length,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        job: {
          ...job,
          status: 'completed',
        },
        pages: pages,
      };

      const storedRecents = localStorage.getItem('COMIC_TRANS_RECENTS');
      const list: RecentItem[] = storedRecents ? JSON.parse(storedRecents) : [];
      const updatedList = [recentItem, ...list.filter(x => x.id !== job.job_id)];
      localStorage.setItem('COMIC_TRANS_RECENTS', JSON.stringify(updatedList));

      onSaveSuccess();
      onClose();
    } catch (err) {
      console.warn('Failed to save to folder:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#141417] border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="w-5 h-5 text-[#e06b3a]" />
            <h3 className="text-base font-bold text-zinc-100">Lưu trữ vào Thư mục</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleConfirmSave} className="p-5 space-y-4">
          {/* Chapter Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">
              Tên chương / Chap (Hiển thị trong thư mục)
            </label>
            <input
              type="text"
              value={chapterName}
              onChange={(e) => setChapterName(e.target.value)}
              placeholder="VD: Chap 1, Chương 15..."
              className="w-full bg-[#0d0d0f] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
              required
            />
          </div>

          {/* Folder Selection or New Folder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300">
                Chọn Thư mục (Bộ truyện)
              </label>
              {folders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(!isCreatingNew)}
                  className="text-[11px] font-bold text-[#e06b3a] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {isCreatingNew ? 'Chọn thư mục có sẵn' : 'Tạo thư mục mới'}
                </button>
              )}
            </div>

            {folders.length === 0 || isCreatingNew ? (
              <div className="space-y-1.5 animate-fadeIn">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nhập tên bộ truyện (VD: One Piece)..."
                  className="w-full bg-[#0d0d0f] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  required
                />
                <p className="text-[10px] text-zinc-500">
                  Hệ thống sẽ tự động tạo thư mục mới với tên này.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedFolderId === folder.id
                        ? 'bg-[#e06b3a]/10 border-[#e06b3a] text-white'
                        : 'bg-[#0d0d0f] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Folder className={`w-4 h-4 ${selectedFolderId === folder.id ? 'text-[#e06b3a]' : 'text-zinc-500'}`} />
                      <span className="text-xs font-bold">{folder.name}</span>
                    </div>
                    {selectedFolderId === folder.id && (
                      <span className="w-2 h-2 rounded-full bg-[#e06b3a]" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#e06b3a] hover:bg-[#ff7e40] shadow-lg shadow-orange-950/40 transition-all flex items-center gap-1.5"
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>Xác nhận lưu</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
