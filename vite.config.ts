import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/lactalog/',
  preview: { port: 5173 },
  plugins: [
    solid(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'LactaLog',
        short_name: 'LactaLog',
        description: 'Track baby feeding and pumped milk, backed by a Google Sheet.',
        theme_color: '#5cb3e6',
        background_color: '#0c1622',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Google APIs and the GIS script must always hit the network.
            urlPattern: /^https:\/\/(sheets|www|accounts|apis)\.google(apis)?\.com\/.*/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/docs\.google\.com\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
