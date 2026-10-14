import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devServerTarget = process.env.VITE_DEV_SERVER_TARGET || 'http://localhost:3001'
const devWebSocketTarget = devServerTarget.replace(/^http/, 'ws')

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: devServerTarget,
        changeOrigin: true
      },
      '/ws': {
        target: devWebSocketTarget,
        ws: true,
        changeOrigin: true
      }
    }
  }
})
