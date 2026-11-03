/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vitest ne lance que les tests unitaires : les tests e2e/ sont pour Playwright
  test: {
    include: ['src/**/*.test.ts'],
  },
})
