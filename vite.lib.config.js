// Builds the publishable package into dist/:
//   dist/index.js   ES module        (import)
//   dist/index.cjs  CommonJS         (require)
//   dist/style.css  all editor styles, every selector scoped under .jc-root
//   dist/index.d.ts, dist/index.d.cts   hand-written types (types/index.d.ts)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import jcScope from './build/postcss-jc-scope.mjs'

// react (and its JSX runtime) must stay external: bundling a second copy of React is what
// causes "Invalid hook call". highlight.js is a normal dependency, so it stays external too —
// but only its JS entry points. Its theme CSS is not imported anywhere any more (see
// scripts/generate-hljs-css.mjs).
const external = [/^react($|\/)/, /^highlight\.js($|\/)/]

const emitTypes = () => ({
  name: 'jc-emit-types',
  closeBundle() {
    copyFileSync('types/index.d.ts', 'dist/index.d.ts')
    copyFileSync('types/index.d.ts', 'dist/index.d.cts')
  },
})

export default defineConfig({
  plugins: [react(), emitTypes()],
  publicDir: false, // don't copy the demo's favicon etc. into the package
  css: { postcss: { plugins: [jcScope()] } },
  build: {
    lib: {
      entry: 'src/index.js',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
      cssFileName: 'style',
    },
    sourcemap: true,
    minify: false,
    rolldownOptions: {
      external,
      output: {
        exports: 'named',
        // Next.js App Router: marks the bundle as a Client Component so `import { Editor }` works
        // from a Server Component file without the consumer adding 'use client' themselves.
        banner: '"use client";',
      },
    },
  },
})
