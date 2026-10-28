import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    setupFiles: ['./tests/setup.ts'],
    include: process.env.OUD_INTEGRATION === '1'
      ? ['tests/**/*.test.ts']
      : ['tests/unit/**/*.test.ts', 'tests/golden-scenario.test.ts', 'tests/multi-year-2027.test.ts', 'tests/quick-exercise.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
