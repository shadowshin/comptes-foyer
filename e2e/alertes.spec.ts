import { FormulaireTransaction } from './pages/FormulaireTransaction'
import { expect, test } from './fixtures'

test('un compte courant qui passera sous 0 € déclenche une alerte critique et le badge de la navigation', async ({ page }) => {
  // PRÉPARER
  const compte = 'Compte courant Brigitte'
  const alerteDecouvert = page.getByRole('heading', { name: new RegExp(`^${compte} .*découvert prévu`) })
  const critiques = page.getByRole('region', { name: /Critiques/ })
  const badge = page.locator('.badge-alertes')

  // Point de départ : avec les données d'exemple, ce compte n'est pas en alerte
  await page.goto('/alertes')
  await expect(page.getByRole('heading', { name: 'Alertes', level: 1 })).toBeVisible()
  await expect(alerteDecouvert).toHaveCount(0)

  // AGIR : une grosse dépense qui met le compte à découvert
  await page.goto('/transactions')
  await new FormulaireTransaction(page).saisirDepense({
    description: 'Test E2E grosse dépense',
    montant: '5000',
    compte,
    categorie: 'Maison et bricolage',
  })
  await expect(page.getByRole('row').filter({ hasText: 'Test E2E grosse dépense' })).toHaveCount(1)

  // VÉRIFIER 1 : l'alerte apparaît dans la section Critiques
  await page.goto('/alertes')
  await expect(critiques.getByRole('heading', { name: new RegExp(`^${compte} .*découvert prévu`) })).toBeVisible()

  // VÉRIFIER 2 : le badge compte exactement les alertes critiques de la page
  const nbCritiques = await critiques.getByRole('listitem').count()
  await expect(badge).toHaveText(`${nbCritiques} alerte(s) critique(s)`)
})
