import React, { useState, useEffect } from 'react';
import { X, Folder, Plus, BookmarkCheck, Loader2, AlertCircle } from 'lucide-react';
import { MangaJob, MangaPage, MangaFolder, RecentItem } from '../types';
import { suggestMangaAndChapter } from '../lib/mangaUtils';
import { getFoldersFromStorage, saveFoldersToStorage, saveRecentItemToStorage } from '../lib/storage';

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
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const parsedFolders = await getFoldersFromStorage();
        if (!isMounted) return;
        setFolders(parsedFolders);

        const suggestions = suggestMangaAndChapter(job.source_url);
        setNewFolderName(suggestions.mangaName);
        setChapterName(suggestions.chapterName);

        if (parsedFolders.length > 0) {
          const match = parsedFolders.find(
            (f) => f.name.toLowerCase() === suggestions.mangaName.toLowerCase()
          );
          if (match) {
            setSelectedFolderId(match.id);
            setIsCreatingNew(false);
          } else {
            setSelectedFolderId(parsedFolders[0].id);
            setIsCreatingNew(false);
          }
        } else {
          setIsCreatingNew(true);
        }
      } catch (e) {
        if (isMounted) setIsCreatingNew(true);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [job]);

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    try {
      let targetFolderId = selectedFolderId;
      let targetFolderName = '';
      let currentFolders = [...folders];

      if (isCreatingNew || !targetFolderId) {
        const folderNameTrim = newFolderName.trim() || 'Bộ truyện mới';
        const existing = currentFolders.find(
          (f) => f.name.toLowerCase() === folderNameTrim.toLowerCase()
        );
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
          await saveFoldersToStorage(currentFolders);
        }
      } else {
        const found = currentFolders.find((f) => f.id === targetFolderId);
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
        completedPages: pages.filter((p) => p.status === 'completed').length || pages.length,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        job: {
          ...job,
          status: 'completed',
        },
        pages: pages,
      };

      await saveRecentItemToStorage(recentItem);

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save to folder:', err);
      setSaveError(err?.message || 'Có lỗi xảy ra khi lưu truyện. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
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
            disabled={isSaving}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleConfirmSave} className="p-5 space-y-4">
          {saveError && (
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

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
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#e06b3a] hover:bg-[#ff7e40] shadow-lg shadow-orange-950/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <BookmarkCheck className="w-4 h-4" />
                  <span>Xác nhận lưu</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

