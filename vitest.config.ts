import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      all: false
    }
  }
});
