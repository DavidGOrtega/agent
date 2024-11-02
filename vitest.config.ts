import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  test: {
    testTimeout: 10000, // Global timeout of 10000ms for all tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**.test.ts'],
      include: ['src'],
    },
  },
});
