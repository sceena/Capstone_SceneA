import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    host: true,  // 0.0.0.0 바인딩 → 같은 네트워크 기기에서 접근 가능
    proxy: {
      '/api': {
        target: 'http://54.116.176.242:8080',
        changeOrigin: true,
      },
      '/oauth2': {
        target: 'http://54.116.176.242:8080',
        changeOrigin: false,
      },
      '/login/oauth2': {
        target: 'http://54.116.176.242:8080',
        changeOrigin: false,
      },
    },
  },
})
