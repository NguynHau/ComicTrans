declare const __APP_BUILD_TIME__: number | undefined;
declare const __APP_VERSION__: string | undefined;

export interface VersionInfo {
  version: string;
  buildTime: number;
  description?: string;
}

// Current bundled build version info (populated dynamically at compile time by Vite)
export const CURRENT_VERSION: VersionInfo = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.5',
  buildTime: typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : 1758362000000,
  description: 'Bản dịch hiện tại'
};

export interface CheckUpdateResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  latestBuildTime?: number;
  description?: string;
  error?: string;
}

export async function checkForAppUpdate(): Promise<CheckUpdateResult> {
  let hasUpdate = false;
  let latestVersion = CURRENT_VERSION.version;
  let latestBuildTime = CURRENT_VERSION.buildTime;
  let description = CURRENT_VERSION.description;
  let fetchError = '';

  const baseUrl = import.meta.env.BASE_URL || './';
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';

  // 1. Primary check: version.json
  try {
    const versionUrl = `${cleanBaseUrl}version.json?t=${Date.now()}`;
    const response = await fetch(versionUrl, {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    });

    if (response.ok) {
      const data: VersionInfo = await response.json();
      if (data && typeof data.buildTime === 'number') {
        latestVersion = data.version || latestVersion;
        latestBuildTime = data.buildTime;
        description = data.description || description;

        // Has update if server buildTime is strictly greater OR versions differ
        if (data.buildTime > CURRENT_VERSION.buildTime || data.version !== CURRENT_VERSION.version) {
          hasUpdate = true;
        }
      }
    }
  } catch (err: any) {
    fetchError = err?.message || '';
  }

  // 2. Secondary fallback check: index.html script tag hash inspection
  // If version.json didn't report an update, double check index.html script tags
  if (!hasUpdate && typeof document !== 'undefined') {
    try {
      const indexUrl = `${cleanBaseUrl}index.html?t=${Date.now()}`;
      const indexRes = await fetch(indexUrl, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });

      if (indexRes.ok) {
        const htmlText = await indexRes.text();
        // Extract script src attributes from server index.html
        const serverScripts = Array.from(htmlText.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)).map(m => m[1]);

        if (serverScripts.length > 0) {
          const clientScripts = Array.from(document.querySelectorAll('script[src]')).map(
            (s) => s.getAttribute('src') || ''
          );

          // Check if any server script src is missing from currently loaded DOM scripts
          const isDifferentScript = serverScripts.some((src) => !clientScripts.includes(src));
          if (isDifferentScript) {
            hasUpdate = true;
            latestVersion = `${CURRENT_VERSION.version} (Mới)`;
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return {
    hasUpdate,
    currentVersion: CURRENT_VERSION.version,
    latestVersion,
    latestBuildTime,
    description,
    error: hasUpdate ? undefined : fetchError || undefined,
  };
}

/**
 * Apply the update smoothly:
 * 1. Unregisters existing service workers to ensure new scripts/bundles are fetched.
 * 2. Reloads the browser without losing any localStorage data (API Keys, translated comics history).
 */
export async function applyAppUpdate(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }
  } catch (e) {
    console.warn('Failed cleaning caches/SW:', e);
  }

  // Force cache refresh reload
  window.location.href = window.location.origin + window.location.pathname + `?v=${Date.now()}`;
}
