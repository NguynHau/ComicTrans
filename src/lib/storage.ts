import { RecentItem, MangaFolder } from '../types';

const DB_NAME = 'ComicTranslatorDB';
const DB_VERSION = 1;
const RECENTS_STORE = 'recents';
const FOLDERS_STORE = 'folders';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(RECENTS_STORE)) {
        db.createObjectStore(RECENTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
        db.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecentItemToStorage(item: RecentItem): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(RECENTS_STORE, 'readwrite');
    const store = tx.objectStore(RECENTS_STORE);
    await new Promise<void>((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (idbErr) {
    console.warn('IndexedDB save failed, falling back to localStorage:', idbErr);
    try {
      const stored = localStorage.getItem('COMIC_TRANS_RECENTS');
      const list: RecentItem[] = stored ? JSON.parse(stored) : [];
      const updated = [item, ...list.filter((x) => x.id !== item.id)];
      localStorage.setItem('COMIC_TRANS_RECENTS', JSON.stringify(updated));
    } catch (lsErr) {
      console.error('LocalStorage quota exceeded:', lsErr);
      throw new Error('Dung lượng trình duyệt đã đầy (Quota Exceeded).');
    }
  }
}

export async function getRecentItemsFromStorage(): Promise<RecentItem[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(RECENTS_STORE, 'readonly');
    const store = tx.objectStore(RECENTS_STORE);
    const items = await new Promise<RecentItem[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const storedLS = localStorage.getItem('COMIC_TRANS_RECENTS');
    if (storedLS) {
      try {
        const lsItems: RecentItem[] = JSON.parse(storedLS);
        const map = new Map<string, RecentItem>();
        items.forEach((i) => map.set(i.id, i));
        lsItems.forEach((i) => {
          if (!map.has(i.id)) map.set(i.id, i);
        });
        return Array.from(map.values());
      } catch (e) {
        // ignore
      }
    }

    return items;
  } catch (idbErr) {
    console.warn('IndexedDB read failed, trying localStorage:', idbErr);
    const storedLS = localStorage.getItem('COMIC_TRANS_RECENTS');
    return storedLS ? JSON.parse(storedLS) : [];
  }
}

export async function deleteRecentItemFromStorage(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(RECENTS_STORE, 'readwrite');
    const store = tx.objectStore(RECENTS_STORE);
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to delete from IndexedDB:', e);
  }

  try {
    const storedLS = localStorage.getItem('COMIC_TRANS_RECENTS');
    if (storedLS) {
      const list: RecentItem[] = JSON.parse(storedLS);
      const updated = list.filter((x) => x.id !== id);
      localStorage.setItem('COMIC_TRANS_RECENTS', JSON.stringify(updated));
    }
  } catch (e) {
    // ignore
  }
}

export async function saveFoldersToStorage(folders: MangaFolder[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(FOLDERS_STORE, 'readwrite');
    const store = tx.objectStore(FOLDERS_STORE);
    store.clear();
    for (const folder of folders) {
      store.put(folder);
    }
  } catch (e) {
    console.warn('Failed to save folders to IndexedDB:', e);
  }
  try {
    localStorage.setItem('COMIC_TRANS_FOLDERS', JSON.stringify(folders));
  } catch (e) {
    // ignore
  }
}

export async function getFoldersFromStorage(): Promise<MangaFolder[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(FOLDERS_STORE, 'readonly');
    const store = tx.objectStore(FOLDERS_STORE);
    const folders = await new Promise<MangaFolder[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (folders.length > 0) return folders;

    const storedLS = localStorage.getItem('COMIC_TRANS_FOLDERS');
    return storedLS ? JSON.parse(storedLS) : [];
  } catch (e) {
    const storedLS = localStorage.getItem('COMIC_TRANS_FOLDERS');
    return storedLS ? JSON.parse(storedLS) : [];
  }
}
