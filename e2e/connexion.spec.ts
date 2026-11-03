import { expect, test } from './fixtures'
import { environnement } from './outils/environnement'

// Ce test doit démarrer déconnecté : on annule la session enregistrée par auth.setup.ts
test.use({ storageState: { cookies: [], origins: [] } })

test('un mauvais mot de passe affiche une erreur et laisse sur la page de connexion', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail').fill(environnement.email)
  await page.getByLabel('Mot de passe').fill('mot-de-passe-incorrect')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('alert')).toHaveText('Adresse e-mail ou mot de passe incorrect.')
  await expect(page).toHaveURL('/connexion')
})