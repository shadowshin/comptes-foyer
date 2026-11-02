import { describe, expect, it } from 'vitest'
import { ajouterJours, ajouterMois, dateDuMois } from './dates'

describe('dates', () => {
  it('ajoute des jours en changeant de mois et d’année', () => {
    expect(ajouterJours('2026-12-31', 1)).toBe('2027-01-01')
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('ne décale pas d’un jour au passage à l’heure d’été ou d’hiver', () => {
    expect(ajouterJours('2026-03-28', 1)).toBe('2026-03-29')
    expect(ajouterJours('2026-03-29', 1)).toBe('2026-03-30')
    expect(ajouterJours('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('reste sur le dernier jour du mois quand le jour n’existe pas', () => {
    expect(ajouterMois('2026-01-31', 1)).toBe('2026-02-28')
    expect(ajouterMois('2028-01-31', 1)).toBe('2028-02-29')
    expect(ajouterMois('2026-11-15', -3)).toBe('2026-08-15')
  })

  it('place un jour donné dans le mois', () => {
    expect(dateDuMois('2026-02-10', 31)).toBe('2026-02-28')
    expect(dateDuMois('2026-11-02', 9)).toBe('2026-11-09')
  })
})
