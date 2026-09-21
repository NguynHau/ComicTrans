import localforage from 'localforage';
import { MangaPage } from '../types';

// Configure localforage instance for offline manga cache
const offlineStore = localforage.createInstance({
  name: 'ComicTranslatorDB',
  storeName: 'offline_chapters_store',
  description: 'Stores full images and metadata for offline reading',
});

export interface OfflineChapterMeta {
  chapterId: string;
  title: string;
  pageCount: number;
  downloadedAt: number;
  totalSizeEstimated?: string;
}

const META_PREFIX = 'meta_';
const PAGE_PREFIX = 'page_';

// Convert image url to base64 DataURL or Blob for persistent offline storage
async function fetchImageAsDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:image/')) {
    return url;
  }
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    // If CORS or fetch fails, return original url as fallback
    console.warn('Could not fetch image for offline conversion:', err);
    return url;
  }
}

/**
 * Check if a chapter has been cached offline
 */
export async function isChapterCachedOffline(chapterId: string): Promise<boolean> {
  try {
    const meta = await offlineStore.getItem<OfflineChapterMeta>(`${META_PREFIX}${chapterId}`);
    return !!meta;
  } catch {
    return false;
  }
}

/**
 * Cache an entire chapter and its pages for offline viewing
 */
export async function downloadChapterOffline(
  chapterId: string,
  title: string,
  pages: MangaPage[],
  onProgress?: (downloaded: number, total: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const total = pages.length;
    if (total === 0) {
      return { success: false, error: 'Không có trang nào để tải.' };
    }

    const cachedPages: MangaPage[] = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const targetUrl = page.processed_image || page.source_image;
      
      let offlineImage = targetUrl;
      if (targetUrl) {
        offlineImage = await fetchImageAsDataUrl(targetUrl);
      }

      const cachedPage: MangaPage = {
        ...page,
        processed_image: offlineImage,
        source_image: offlineImage,
      };

      cachedPages.push(cachedPage);
      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    // Save pages array for this chapter
    await offlineStore.setItem(`${PAGE_PREFIX}${chapterId}`, cachedPages);

    // Save metadata
    const meta: OfflineChapterMeta = {
      chapterId,
      title,
      pageCount: total,
      downloadedAt: Date.now(),
    };
    await offlineStore.setItem(`${META_PREFIX}${chapterId}`, meta);

    return { success: true };
  } catch (error: any) {
    console.error('Error caching chapter offline:', error);
    return { success: false, error: error?.message || 'Lỗi khi tải dữ liệu offline' };
  }
}

/**
 * Get offline cached pages for a chapter if available
 */
export async function getOfflineChapterPages(chapterId: string): Promise<MangaPage[] | null> {
  try {
    const cached = await offlineStore.getItem<MangaPage[]>(`${PAGE_PREFIX}${chapterId}`);
    return cached || null;
  } catch {
    return null;
  }
}

/**
 * Delete a chapter from offline cache
 */
export async function deleteOfflineChapter(chapterId: string): Promise<void> {
  try {
    await offlineStore.removeItem(`${PAGE_PREFIX}${chapterId}`);
    await offlineStore.removeItem(`${META_PREFIX}${chapterId}`);
  } catch (err) {
    console.warn('Error deleting offline chapter:', err);
  }
}
