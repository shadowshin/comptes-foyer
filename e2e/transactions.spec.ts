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

test('un virement interne crée deux opérations liées et ne change pas le total du foyer', async ({ page, exemple }) => {
  // PRÉPARER : les données et le résultat attendu
  const description = 'Test E2E virement livret'
  const montant = 100
  const totalFoyer = somme([...exemple.comptes.map((c) => soldeFinDeJour(c, exemple.transactions, '2100-01-01'))])

  // AGIR : une seule action, la saisie
  await page.goto('/transactions')
  const formulaire = new FormulaireTransaction(page)
  await formulaire.saisirVirement({ description, montant: String(montant), compte: 'Compte courant Alice', destination: 'Livret A Alice' })

  // VÉRIFIER 1 : deux lignes portent la description
  const lignes = page.getByRole('row').filter({ hasText: description })
  await expect(lignes).toHaveCount(2)

  // VÉRIFIER 2 : chaque ligne, isolée par un second filtre
  const sortie = lignes.filter({ hasText: 'vers Livret A Alice' })
  await expect(sortie.locator('.montant')).toHaveText(formaterEuros(-montant))
  const entree = lignes.filter({ hasText: 'depuis Compte courant Alice' })
  await expect(entree.locator('.montant')).toHaveText(formaterEuros(montant))

  // VÉRIFIER 3 : le total du foyer sur l'accueil
  const tuileTotal = page.locator('.kpi').filter({ hasText: 'Total foyer' })
  await page.goto('/')
  await expect(tuileTotal).toContainText(formaterEuros(totalFoyer))
})