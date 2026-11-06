import { expect, test } from './fixtures'

test('une section repliée le reste après rechargement de la page', async ({ page }) => {
  // PRÉPARER : une section ouverte par défaut sur la page Rapports
  const section = page.locator('details').filter({ has: page.getByRole('heading', { name: 'Dépenses par catégorie' }) })
  const titre = section.locator('summary')
  const contenu = section.locator('.repliable-contenu')

  await page.goto('/rapports')
  await expect(section).toHaveAttribute('open')
  await expect(contenu).toBeVisible()

  // AGIR : replier, puis recharger
  await titre.click()
  await expect(contenu).toBeHidden()
  // Le navigateur replie tout de suite, mais l'appli n'enregistre l'état qu'un instant
  // après : recharger avant rendait le test instable (1 échec sur la suite complète)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('repliable.rapports.categories'))).toBe('false')
  await page.reload()

  // VÉRIFIER : toujours repliée, et elle se rouvre normalement
  await expect(section).not.toHaveAttribute('open')
  await expect(contenu).toBeHidden()
  await titre.click()
  await expect(contenu).toBeVisible()
})
