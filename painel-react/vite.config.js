import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    // Os testes de telas pedem o jsdom no próprio arquivo (// @vitest-environment jsdom).
    setupFiles: ['./src/test/setup.js'],
  },
})
