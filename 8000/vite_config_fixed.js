// frontend-react/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/", // Change base to root since Django will serve from root
  build: {
    outDir: "dist", // Build to frontend-react/dist
    emptyOutDir: true,
    assetsDir: "assets",
    manifest: true,
  },
  server: {
    port: 8080,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
})