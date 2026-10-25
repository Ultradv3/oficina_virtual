import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'app/utils/scene-framing.ts',
        'app/utils/desk-layout.ts',
        'app/utils/wall-layout.ts',
        'app/utils/status.ts',
        'server/utils/redact.ts',
      ],
      reporter: ['text', 'html'],
    },
  },
})
