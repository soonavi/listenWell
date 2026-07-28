import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Read the version directly from package.json rather than importing it, so
// this stays plain JSON parsing under Node's ESM loader (no import-assertion
// syntax to keep in sync with the Node version Vite/Electron ship with).
const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  // Relative base so the built app also works from file:// inside Electron
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Stamped in at build time so the running app can compare its own
    // version against the last one the user saw (see src/utils/whatsNew.js).
    __APP_VERSION__: JSON.stringify(version),
  },
})
