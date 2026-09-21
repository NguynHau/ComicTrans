declare const __APP_BUILD_TIME__: number | undefined;
declare const __APP_VERSION__: string | undefined;

export interface VersionInfo {
  version: string;
  buildTime: number;
  description?: string;
}

// Current bundled build version info (injected dynamically at compile time by Vite)
export const CURRENT_VERSION: VersionInfo = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.6',
  buildTime: typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : Date.now(),
  description: 'Bản dịch hiện tại',
};

export type UpdateCheckStatus = 'idle' | 'checking' | 'has_update' | 'up_to_date' | 'error';

export interface CheckUpdateResult {
  status: UpdateCheckStatus;
  hasUpdate: boolean;
  currentVersion: string;
  currentBuildTime: number;
  latestVersion: string;
  latestBuildTime?: number;
  description?: string;
  error?: string;
}

/**
 * Calculates the exact root base URL of the app, accounting for:
 * - GitHub Pages subpaths: https://<user>.github.io/<repo>/
 * - Custom domains: https://example.com/
 * - Relative bases (./)
 */
export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return '/';

  // 1. Check document.baseURI
  if (document.baseURI) {
    try {
      const url = new URL(document.baseURI);
      let path = url.pathname;
      if (/\.[a-zA-Z0-9]+$/.test(path)) {
        path = path.substring(0, path.lastIndexOf('/') + 1);
      }
      if (!path.endsWith('/')) path += '/';
      return `${url.origin}${path}`;
    } catch {
      // ignore
    }
  }

  // 2. Check window.location
  let pathname = window.location.pathname;
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    pathname = pathname.substring(0, pathname.lastIndexOf('/') + 1);
  }
  if (!pathname.endsWith('/')) {
    pathname += '/';
  }

  return `${window.location.origin}${pathname}`;
}

/**
 * Helper to fetch version.json across multiple candidate URLs (direct origin, relative base, etc.)
 */
async function fetchServerVersionInfo(): Promise<VersionInfo | null> {
  const timestamp = Date.now();
  const baseUrl = getAppBaseUrl();
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  const candidateUrls = [
    `${cleanBase}version.json?_t=${timestamp}`,
    `./version.json?_t=${timestamp}`,
    `version.json?_t=${timestamp}`,
    `${window.location.origin}/version.json?_t=${timestamp}`,
  ];

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const text = await response.text();
        // Ensure valid JSON response (not index.html fallback)
        if (text.trim().startsWith('{')) {
          const data = JSON.parse(text) as VersionInfo;
          if (data && typeof data.buildTime === 'number' && data.version) {
            return data;
          }
        }
      }
    } catch {
      // Continue to next candidate URL
    }
  }

  return null;
}

/**
 * Checks for app updates against GitHub Pages / server.
 * 1. Fetches version.json from server bypassing all caches.
 * 2. Triggers Service Worker update check.
 * 3. Inspects index.html scripts hash as secondary verification.
 * 4. Accurately reports status (never returns 'up_to_date' on network error).
 */
export async function checkForAppUpdate(): Promise<CheckUpdateResult> {
  let hasUpdate = false;
  let latestVersion = CURRENT_VERSION.version;
  let latestBuildTime = CURRENT_VERSION.buildTime;
  let description = CURRENT_VERSION.description;
  let networkFailed = false;
  let errorMessage = '';

  // Check offline status first
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      status: 'error',
      hasUpdate: false,
      currentVersion: CURRENT_VERSION.version,
      currentBuildTime: CURRENT_VERSION.buildTime,
      latestVersion: CURRENT_VERSION.version,
      error: 'Thiết bị đang ngoại tuyến (Offline). Vui lòng kết nối Internet để kiểm tra cập nhật.',
    };
  }

  // 1. Service Worker update check in background
  let swHasWaitingWorker = false;
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        // Prompt SW to check server for new sw.js
        await registration.update();
        if (registration.waiting) {
          swHasWaitingWorker = true;
        }
      }
    }
  } catch (swErr) {
    console.warn('SW check warning:', swErr);
  }

  // 2. Fetch live version.json from server
  const serverVersion = await fetchServerVersionInfo();

  if (serverVersion) {
    latestVersion = serverVersion.version;
    latestBuildTime = serverVersion.buildTime;
    description = serverVersion.description || description;

    // Check if server version is newer:
    // a. Semantic version change
    // b. Or build timestamp is newer by more than 1 second (1000ms)
    const isVersionDiff = serverVersion.version !== CURRENT_VERSION.version;
    const isBuildNewer = serverVersion.buildTime > CURRENT_VERSION.buildTime + 1000;

    if (isVersionDiff || isBuildNewer || swHasWaitingWorker) {
      hasUpdate = true;
    }
  } else {
    // If version.json could not be reached, try fallback check on index.html
    networkFailed = true;
    errorMessage = 'Không thể tải thông tin phiên bản từ máy chủ GitHub Pages. Vui lòng kiểm tra kết nối mạng.';
  }

  // 3. Fallback: If version.json failed or was identical, inspect index.html script tags
  if (!hasUpdate && typeof document !== 'undefined') {
    try {
      const baseUrl = getAppBaseUrl();
      const indexUrl = `${baseUrl}index.html?_t=${Date.now()}`;
      const indexRes = await fetch(indexUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (indexRes.ok) {
        networkFailed = false; // index.html was reachable
        const htmlText = await indexRes.text();
        const serverScripts = Array.from(htmlText.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)).map((m) => m[1]);

        if (serverScripts.length > 0) {
          const clientScripts = Array.from(document.querySelectorAll('script[src]')).map(
            (s) => s.getAttribute('src') || ''
          );

          const isDifferentScript = serverScripts.some((src) => !clientScripts.includes(src));
          if (isDifferentScript) {
            hasUpdate = true;
            latestVersion = `${CURRENT_VERSION.version} (Mới)`;
            description = 'Đã phát hiện bản cập nhật mã nguồn mới trên máy chủ.';
          }
        }
      }
    } catch {
      // index check error
    }
  }

  // If SW already has a waiting worker, we definitely have an update
  if (swHasWaitingWorker) {
    hasUpdate = true;
  }

  // Determine final status
  let status: UpdateCheckStatus = 'up_to_date';
  if (hasUpdate) {
    status = 'has_update';
  } else if (networkFailed) {
    status = 'error';
  }

  return {
    status,
    hasUpdate,
    currentVersion: CURRENT_VERSION.version,
    currentBuildTime: CURRENT_VERSION.buildTime,
    latestVersion,
    latestBuildTime,
    description,
    error: status === 'error' ? errorMessage : undefined,
  };
}

/**
 * Safely applies the app update:
 * 1. Activates any waiting Service Worker (SKIP_WAITING).
 * 2. Clears HTTP response caches (CacheStorage) so new bundles load immediately.
 * 3. Unregisters old Service Worker instances.
 * 4. Reloads application cleanly with anti-cache query parameter.
 * 
 * GUARANTEE: NEVER clears localStorage or IndexedDB. All API keys, saved comics,
 * translations, folders, and OCR results remain 100% intact!
 */
export async function applyAppUpdate(): Promise<void> {
  // Prevent infinite reload loops via sessionStorage guard
  const lastUpdateAttempt = sessionStorage.getItem('rixia_last_update_reload');
  const now = Date.now();
  if (lastUpdateAttempt && now - parseInt(lastUpdateAttempt, 10) < 3000) {
    console.warn('Update reload throttled to avoid loop');
    return;
  }
  sessionStorage.setItem('rixia_last_update_reload', now.toString());

  try {
    // 1. Signal any waiting service worker to skip waiting
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        await reg.unregister();
      }
    }

    // 2. Clear HTTP CacheStorage (static JS/CSS/HTML caches)
    // NOTE: This only touches window.caches (HTTP cache), NOT IndexedDB or localStorage
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }
  } catch (e) {
    console.warn('Update cache purge warning (continuing update):', e);
  }

  // 3. Clean navigation reload
  const baseUrl = getAppBaseUrl();
  const cleanUrl = `${baseUrl}?v=${now}`;
  
  // Use replace to prevent history stack pollution
  window.location.replace(cleanUrl);
}
