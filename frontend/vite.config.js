import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.TURNERO_API_URL || 'http://127.0.0.1:8001',
        changeOrigin: false,
      },
    },
  },
})
