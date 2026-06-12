import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_BASE_URL || 'http://54.116.176.242:8080'
  const mediaTarget = env.VITE_MEDIA_SERVER_URL || 'http://54.116.176.242:4000'

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    server: {
      host: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          headers: {
            Origin: 'http://localhost:5173',
          },
        },
        '/oauth2': {
          target: apiTarget,
          changeOrigin: false,
        },
        '/login/oauth2': {
          target: apiTarget,
          changeOrigin: false,
        },
        '/socket.io': {
          target: mediaTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
