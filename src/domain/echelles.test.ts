import { describe, expect, it } from 'vitest'
import { euroCompact, graduations } from './echelles'

describe('graduations', () => {
  it('produit des valeurs rondes qui encadrent les données', () => {
    expect(graduations(0, 1060)).toEqual([0, 500, 1000, 1500])
    expect(graduations(-120, 340)).toEqual([-200, 0, 200, 400])
  })

  it('gère une série constante', () => {
    const g = graduations(500, 500)
    expect(g[0]).toBeLessThanOrEqual(500)
    expect(g.at(-1)).toBeGreaterThanOrEqual(500)
  })
})

describe('euroCompact', () => {
  it('abrège les milliers', () => {
    expect(euroCompact(1234).replace(/\s/g, ' ')).toBe('1,2 k€')
    expect(euroCompact(-850)).toBe('-850 €')
  })
})
