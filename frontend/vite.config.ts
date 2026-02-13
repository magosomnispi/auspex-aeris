import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GH_PAGES ? '/auspex-aeris/' : '/',
  server: {
    proxy: {
      '/api': {
        target: 'http://192.168.68.114:3005',
        changeOrigin: true
      }
    }
  }
})