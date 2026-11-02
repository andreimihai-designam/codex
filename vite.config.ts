import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Guitar Composer Studio',
        short_name: 'Guitar Studio',
        lang: 'ro',
        description: 'Atelier local de armonie și compoziție pentru chitară.',
        theme_color: '#101815',
        background_color: '#101815',
        display: 'standalone',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
});
