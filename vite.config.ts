import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function autoVersionPlugin(): Plugin {
  const buildTime = Date.now();
  const versionInfo = {
    version: '1.0.5',
    buildTime,
    description: 'Bản cập nhật v1.0.5 tự động đồng bộ.',
  };

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

const currentBuildTime = Date.now();

export default defineConfig(() => {
  return {
    base: './',
    define: {
      '__APP_BUILD_TIME__': JSON.stringify(currentBuildTime),
      '__APP_VERSION__': JSON.stringify('1.0.5'),
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
          name: 'ComicTrans',
          short_name: 'ComicTrans',
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
