import { releveCEFictif, TITRE_COMPTE_FICTIF, OPERATIONS_FICTIVES } from './outils/releveFictif'
import { expect, test } from './fixtures'

test('un relevé importé une deuxième fois ne crée aucun doublon', async ({ page }) => {
  // PRÉPARER
  const nb = OPERATIONS_FICTIVES.length
  const champFichier = page.locator('input[type="file"]')
  const resume = page.locator('.resume-tableau')
  const menuCompte = page.getByRole('combobox', { name: `Compte pour ${TITRE_COMPTE_FICTIF}` })

  // AGIR 1 : premier import
  await page.goto('/import')
  await champFichier.setInputFiles(releveCEFictif())
  await menuCompte.selectOption('Compte courant Alice')

  // VÉRIFIER 1 : l'aperçu, puis le message après import
  await expect(resume).toContainText(`${nb} à importer`)
  await page.getByRole('button', { name: `Importer ${nb} opération(s)` }).click()
  await expect(page.getByRole('status')).toContainText(`${nb} opération(s) importée(s)`)

  // AGIR 2 : réimport du même fichier, sans choisir le compte
  await champFichier.setInputFiles(releveCEFictif())

  // VÉRIFIER 2 : le compte est reconnu tout seul. On attend cet état stable avant de lire
  // les compteurs : tant que le rattachement mémorisé n'est pas rechargé, l'écran affiche
  // brièvement « 0 à importer », ce qui faisait passer la vérification suivante à tort
  await expect(menuCompte.locator('option:checked')).toHaveText('Compte courant Alice')

  // VÉRIFIER 3 : tout est reconnu comme déjà importé
  await expect(resume).toContainText(`0 à importer`)
  await expect(resume).toContainText(`${nb} déjà importée(s)`)
  await expect(page.getByRole('button', { name: `Importer 0 opération(s)` })).toBeDisabled()
})