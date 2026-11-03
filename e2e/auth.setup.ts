// Se connecte une fois avec le compte de test et enregistre la session : les autres
// tests démarrent déjà connectés (voir storageState dans playwright.config.ts).

import { expect, test as setup } from '@playwright/test'
import { environnement } from './outils/environnement'

setup('connexion du compte de test', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail').fill(environnement.email)
  await page.getByLabel('Mot de passe').fill(environnement.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()

  // L'authentification Supabase dépasse parfois les 5 s par défaut (projet gratuit en veille)
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible({ timeout: 20_000 })
  await page.context().storageState({ path: 'e2e/.auth/session.json' })
})
