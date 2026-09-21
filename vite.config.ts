import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Read version dynamically from package.json
let appVersion = '1.0.6';
try {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version) {
      appVersion = pkg.version;
    }
  }
} catch (e) {
  console.warn('Unable to read package.json version:', e);
}

const currentBuildTime = Date.now();
const versionInfo = {
  version: appVersion,
  buildTime: currentBuildTime,
  description: `Bản cập nhật v${appVersion} tự động đồng bộ.`,
};

function autoVersionPlugin(): Plugin {
  return {
    name: 'auto-version-generator',
    buildStart() {
      try {
        const publicDir = path.resolve(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        fs.writeFileSync(
          path.join(publicDir, 'version.json'),
          JSON.stringify(versionInfo, null, 2)
        );
      } catch (e) {
        console.warn('Unable to write public/version.json:', e);
      }
    },
    writeBundle() {
      try {
        const distDir = path.resolve(process.cwd(), 'dist');
        if (fs.existsSync(distDir)) {
          fs.writeFileSync(
            path.join(distDir, 'version.json'),
            JSON.stringify(versionInfo, null, 2)
          );
        }
      } catch (e) {
        console.warn('Unable to write dist/version.json:', e);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    define: {
      '__APP_BUILD_TIME__': JSON.stringify(currentBuildTime),
      '__APP_VERSION__': JSON.stringify(appVersion),
    },
    plugins: [
      autoVersionPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: './',
          name: 'RiXia',
          short_name: 'RiXia',
          description: 'Dịch và đọc truyện tranh thông minh theo cách của bạn trên điện thoại di động.',
          theme_color: '#0d0d0f',
          background_color: '#0d0d0f',
          display: 'standalone',
          orientation: 'portrait',
          start_url: './',
          scope: './',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            }
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/version.json', 'version.json'],
          navigateFallbackDenylist: [/^\/version\.json/, /version\.json$/],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
