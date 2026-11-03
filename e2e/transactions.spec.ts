import { FormulaireTransaction } from './pages/FormulaireTransaction'
import { expect, test } from './fixtures'
import { soldeFinDeJour } from '../src/domain/tresorerie'
import { formaterEuros, somme } from '../src/domain/montants'

test('une dépense saisie apparaît dans les transactions et diminue le solde du compte', async ({ page, exemple }) => {
  const description = 'Test E2E boulangerie'
  const montant = 50
  const compteAlice = exemple.comptes.find((c) => c.nom === 'Compte courant Alice')!
  const soldeTotal = somme([...exemple.comptes.map((c) => soldeFinDeJour(c, exemple.transactions, '2100-01-01')), -montant])
  const soldeAlice = somme([soldeFinDeJour(compteAlice, exemple.transactions, '2100-01-01'), -montant])

  await page.goto('/transactions')
  const formulaire = new FormulaireTransaction(page)
  await formulaire.saisirDepense({ description, montant: String(montant), compte: 'Compte courant Alice', categorie: 'Courses' })
  const ligne = page.getByRole('row').filter({ hasText: description })
  await expect(ligne).toContainText(formaterEuros(-montant))
  await expect(ligne).toContainText('Courses')

  const tuileTotal = page.locator('.kpi').filter({ hasText: 'Total foyer' })
  await page.goto('/')
  await page.getByText('Comptes courants').click()
  const ligneAlice = page.getByRole('listitem').filter({ hasText: 'Compte courant Alice' })
  await expect(ligneAlice).toContainText(formaterEuros(soldeAlice))
  await expect(tuileTotal).toContainText(formaterEuros(soldeTotal))
})