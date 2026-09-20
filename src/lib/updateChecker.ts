export interface VersionInfo {
  version: string;
  buildTime: number;
  description?: string;
}

// Current bundled build version info
export const CURRENT_VERSION: VersionInfo = {
  version: '1.0.4',
  buildTime: 1758362000000,
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
  try {
    // Fetch version.json from root or current base path with cache-busting timestamp
    const baseUrl = import.meta.env.BASE_URL || '/';
    const versionUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}version.json?t=${Date.now()}`;
    
    const response = await fetch(versionUrl, {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Không thể tải thông tin phiên bản từ máy chủ.`);
    }

    const data: VersionInfo = await response.json();

    if (!data || typeof data.buildTime !== 'number') {
      throw new Error('Dữ liệu phiên bản trên máy chủ không hợp lệ.');
    }

    const hasUpdate = data.buildTime > CURRENT_VERSION.buildTime || data.version !== CURRENT_VERSION.version;

    return {
      hasUpdate,
      currentVersion: CURRENT_VERSION.version,
      latestVersion: data.version,
      latestBuildTime: data.buildTime,
      description: data.description,
    };
  } catch (err: any) {
    console.warn('Lỗi kiểm tra cập nhật:', err);
    return {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION.version,
      latestVersion: CURRENT_VERSION.version,
      error: err.message || 'Không thể kết nối đến máy chủ kiểm tra cập nhật.',
    };
  }
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
