import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // base '/' untuk dev lokal, '/campusrelove/' untuk build GitHub Pages
  base: command === 'build' ? '/campusrelove/' : '/',
}))
