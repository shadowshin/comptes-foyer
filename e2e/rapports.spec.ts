import { ajouterMois, dateDuMois, depuisIso, versIso } from '../src/domain/dates'
import { expect, test } from './fixtures'

// Même libellé que la page : « octobre 2026 »
const nomMois = (iso: string) => depuisIso(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

test('les rapports s’ouvrent sur le dernier mois complet et ne vont ni dans le futur ni avant l’historique', async ({ page, exemple }) => {
  // PRÉPARER : mois en cours, mois précédent, et premier mois de l'historique d'exemple
  const moisEnCours = dateDuMois(versIso(new Date()), 1)
  const moisPrecedent = ajouterMois(moisEnCours, -1)
  const premierMois = dateDuMois(exemple.transactions.map((t) => t.date_operation).sort()[0], 1)
  const moisAffiche = page.locator('.actions.mois strong')
  const precedent = page.getByRole('button', { name: 'Mois précédent' })
  const suivant = page.getByRole('button', { name: 'Mois suivant' })

  // VÉRIFIER 1 : par défaut, le dernier mois complet
  await page.goto('/rapports')
  await expect(moisAffiche).toHaveText(nomMois(moisPrecedent))

  // VÉRIFIER 2 : › mène au mois en cours, signalé, puis se désactive
  await suivant.click()
  await expect(moisAffiche).toHaveText(`${nomMois(moisEnCours)} (en cours)`)
  await expect(suivant).toBeDisabled()

  // VÉRIFIER 3 : ‹ remonte jusqu'au premier mois de l'historique, puis se désactive
  for (let mois = ajouterMois(moisEnCours, -1); mois >= premierMois; mois = ajouterMois(mois, -1)) {
    await precedent.click()
    await expect(moisAffiche).toHaveText(nomMois(mois))
  }
  await expect(precedent).toBeDisabled()
})
