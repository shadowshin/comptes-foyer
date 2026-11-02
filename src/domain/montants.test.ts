import { describe, expect, it } from 'vitest'
import { lireMontant } from './libelles'
import { formaterEuros, somme } from './montants'

describe('montants', () => {
  it('additionne sans erreur d’arrondi', () => {
    expect(somme([0.1, 0.2])).toBe(0.3)
    expect(somme([-420, 420])).toBe(0)
    expect(somme([])).toBe(0)
  })

  it('lit un montant saisi à la française ou à l’anglaise', () => {
    expect(lireMontant('54,3')).toBe(54.3)
    expect(lireMontant('1 234,56 €')).toBe(1234.56)
    expect(lireMontant('1234.56')).toBe(1234.56)
    expect(lireMontant('12')).toBe(12)
  })

  it('rejette une saisie qui n’est pas un montant', () => {
    expect(lireMontant('')).toBeNaN()
    expect(lireMontant('abc')).toBeNaN()
    expect(lireMontant('-5')).toBeNaN()
    expect(lireMontant('1,2,3')).toBeNaN()
  })

  it('formate en euros à la française', () => {
    // Intl insère des espaces insécables : on les normalise pour la comparaison
    expect(formaterEuros(1234.5).replace(/\s/g, ' ')).toBe('1 234,50 €')
    expect(formaterEuros(-0).replace(/\s/g, ' ')).toBe('0,00 €')
  })
})
