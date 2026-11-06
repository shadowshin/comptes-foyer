import { FormulaireTransaction } from './pages/FormulaireTransaction'
import { expect, test } from './fixtures'

test('un budget modifié est signalé, enregistré par le bouton et conservé après rechargement', async ({ page, exemple }) => {
  // PRÉPARER : un budget existant des données d'exemple, et une nouvelle valeur différente
  const categorie = 'Carburant'
  const idCategorie = exemple.categories.find((c) => c.nom === categorie)!.id
  const ancien = exemple.budgets.find((b) => b.categorie_id === idCategorie)!.montant_mensuel
  const nouveau = ancien + 30
  const champ = page.getByRole('spinbutton', { name: `Budget mensuel ${categorie}` })
  const enregistrer = page.getByRole('button', { name: 'Enregistrer les budgets' })

  await page.goto('/budgets')
  await expect(champ).toHaveValue(String(ancien))
  // rien à enregistrer tant qu'aucun champ n'a changé
  await expect(enregistrer).toBeDisabled()

  // AGIR 1 : modifier le champ
  await champ.fill(String(nouveau))
  await expect(enregistrer).toBeEnabled()

  // VÉRIFIER 1 : la modification est signalée (champ en jaune) mais pas encore enregistrée
  await expect(champ).toHaveClass(/\bmodifie\b/)
  await expect(page.getByText('1 modification(s) non enregistrée(s)')).toBeVisible()

  // AGIR 2 : enregistrer
  await enregistrer.click()

  // VÉRIFIER 2 : confirmation, puis la valeur vient bien de la base après rechargement
  await expect(page.getByRole('status')).toHaveText('1 budget(s) enregistré(s).')
  await expect(champ).not.toHaveClass(/\bmodifie\b/)
  await page.reload()
  await expect(champ).toHaveValue(String(nouveau))
})

test('un budget fixé sous le réel du mois affiche une barre rouge et une alerte de dépassement', async ({ page }) => {
  // PRÉPARER : une dépense du jour garantit un réel non nul dans le mois en cours,
  // quel que soit le jour où le test tourne (le 1er du mois, les données d'exemple
  // n'ont parfois encore aucune course)
  const categorie = 'Courses'
  const budgetTropBas = 10
  await page.goto('/transactions')
  await new FormulaireTransaction(page).saisirDepense({
    description: 'Test E2E courses',
    montant: '50',
    compte: 'Compte courant Alice',
    categorie,
  })
  await expect(page.getByRole('row').filter({ hasText: 'Test E2E courses' })).toHaveCount(1)

  // AGIR : fixer le budget sous le réel
  await page.goto('/budgets')
  await page.getByRole('spinbutton', { name: `Budget mensuel ${categorie}` }).fill(String(budgetTropBas))
  await page.getByRole('button', { name: 'Enregistrer les budgets' }).click()
  await expect(page.getByRole('status')).toHaveText('1 budget(s) enregistré(s).')

  // VÉRIFIER 1 : barre rouge, au-delà de 100 %
  const barre = page.getByRole('progressbar', { name: `Budget ${categorie}` })
  await expect(barre).toHaveClass(/\betat-depasse\b/)
  await expect(barre).toHaveAttribute('aria-valuenow', '100')

  // VÉRIFIER 2 : l'alerte correspondante
  await page.goto('/alertes')
  await expect(page.getByRole('heading', { name: `Budget ${categorie} dépassé` })).toBeVisible()
})
