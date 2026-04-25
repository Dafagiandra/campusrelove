import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/campusrelove/',
  build: {
    outDir: 'docs',  // GitHub Pages bisa deploy dari /docs
  },
})
