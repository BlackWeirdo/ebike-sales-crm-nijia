import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// Server-side tests run in Node (real node:sqlite, in-memory DB). Separate from vite.config (client).
export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['server/**/*.test.ts'],
    pool: 'forks', // each test file = fresh process = isolated in-memory DB
    setupFiles: ['./server/test/setup.ts'],
  },
})
