// Point d'entrée des tests : importer { test, expect } d'ici plutôt que de @playwright/test.
// Chaque test démarre sur les données d'exemple fraîchement rechargées, et peut les lire
// avec le paramètre `exemple` pour calculer ses résultats attendus.

import { test as base, expect } from '@playwright/test'
import type { DonneesExemple } from '../src/domain/donneesExemple'
import { chargerExemple } from './outils/donnees'

export const test = base.extend<{ exemple: DonneesExemple }>({
  exemple: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, utiliser) => {
      await utiliser(await chargerExemple())
    },
    // auto : les données sont rechargées même si le test ne lit pas `exemple`
    { auto: true },
  ],
})

export { expect }
