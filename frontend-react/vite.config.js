// frontend-react/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/static/", // This should match Django's STATIC_URL
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    manifest: false, // Set to false for simpler deployment
    rollupOptions: {
      output: {
        // Ensure consistent file naming
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
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

