/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev-only: forward API calls to the backend so the app can use relative URLs.
  // Without this, `localhost` in VITE_SERVER_URL resolves to whatever device
  // opened the app, so phones on the LAN can't reach the API.
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5126",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    setupFiles: './src/test-setup.ts',
    css: true,
  },
})
