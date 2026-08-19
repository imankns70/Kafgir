import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // `scripts` is included so migration/seed helpers can carry tests. Modules there must not run
    // work at import time — `migrate-sqlserver.ts` calls `main()`, which is why its pre-flight rules
    // live in `legacy-order-numbers.ts` instead.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
