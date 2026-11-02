import { describe, expect, it } from 'vitest'
import { formaterEuros, somme } from './montants'

describe('montants', () => {
  it('additionne sans erreur d’arrondi', () => {
    expect(somme([0.1, 0.2])).toBe(0.3)
    expect(somme([-420, 420])).toBe(0)
    expect(somme([])).toBe(0)
  })

  it('formate en euros à la française', () => {
    // Intl insère des espaces insécables : on les normalise pour la comparaison
    expect(formaterEuros(1234.5).replace(/\s/g, ' ')).toBe('1 234,50 €')
  })
})
