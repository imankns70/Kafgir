import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@kafgir/contracts', '@kafgir/server-core'] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
    server: {
      // Keep the dev renderer on IPv4 so Electron's localhost URL resolves to
      // the same listener on Windows (where Vite may otherwise bind only ::1).
      host: '127.0.0.1',
    },
  },
})
