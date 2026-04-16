import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/ResearchRenamer/',
  plugins: [react()],
  server: {
    port: 3000,
    open: '/ResearchRenamer/'
  },
  preview: {
    open: '/ResearchRenamer/'
  },
})
