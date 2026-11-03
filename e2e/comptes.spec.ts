import { soldeFinDeJour } from '../src/domain/tresorerie'
import { formaterEuros, somme } from '../src/domain/montants'
import { expect, test } from './fixtures'

test('l’accueil affiche le total de chaque groupe et le total du foyer', async ({ page, exemple }) => {
  // Solde attendu de chaque compte : la même règle que l'appli
  const solde = (c: (typeof exemple.comptes)[number]) => soldeFinDeJour(c, exemple.transactions, '2100-01-01')

  const totalFoyer = somme(exemple.comptes.map(solde))
  const tuileTotal = page.locator('.kpi').filter({ hasText: 'Total foyer' })
  const groupes = [
    { nature: 'courant', titre: 'Comptes courants' },
    { nature: 'livret', titre: 'Livrets' },
    { nature: 'placement', titre: 'Placements' },
  ]

  await page.goto('/')
  for (const g of groupes) {
    const total = somme(exemple.comptes.filter((c) => c.nature === g.nature).map(solde))
    await expect(page.getByRole('heading', { name: `${g.titre} · ${formaterEuros(total)}` })).toBeVisible()
  }
  await expect(tuileTotal).toContainText(formaterEuros(totalFoyer))
})