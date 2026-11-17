import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const packageRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: '/Enclave/',
  build: {
    target: 'es2022',
    outDir: resolve(packageRoot, '../../nexus-engine'),
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: resolve(packageRoot, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'nexus-engine.js',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'nexus-engine.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})