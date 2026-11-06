import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// En local, les accès au projet Supabase de test viennent de .env.e2e.local (jamais
// versionné) ; en CI, des secrets GitHub. Ce projet est distinct de celui des vraies données.
if (existsSync('.env.e2e.local')) process.loadEnvFile('.env.e2e.local')

const PORT = 5174
const SESSION = 'e2e/.auth/session.json'

export default defineConfig({
  testDir: 'e2e',
  // Un seul compte de test et une seule base : les tests ne peuvent pas tourner
  // en parallèle sans se marcher dessus (chacun remet les données à zéro)
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // En CI : journal et annotations GitHub seulement, pas de rapport HTML (il contiendrait
  // les saisies du compte de test et le dépôt est public)
  reporter: process.env.CI ? [['list'], ['github']] : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Connexion une seule fois, la session est réutilisée par les autres tests
    { name: 'connexion', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: SESSION },
      dependencies: ['connexion'],
    },
  ],
  // Vite en mode « e2e » : il lit .env.e2e.local, donc l'appli parle au projet de test
  webServer: {
    command: `npm run dev -- --mode e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
