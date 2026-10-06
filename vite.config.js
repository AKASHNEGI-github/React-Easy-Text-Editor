// Dev server + demo-site build (`npm run dev`, `npm run build:demo`).
// The publishable library is built by vite.lib.config.js.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import jcScope from './build/postcss-jc-scope.mjs'

export default defineConfig({
  plugins: [react()],
  // The demo site gets its own output folder. `dist/` belongs to the library build (what gets
  // published); building the demo into it would wipe the package files.
  build: { outDir: 'demo-dist' },
  // Same CSS scoping as the library build, so the demo behaves like the package.
  css: { postcss: { plugins: [jcScope()] } },
})
