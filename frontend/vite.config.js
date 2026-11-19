import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss()],
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
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
