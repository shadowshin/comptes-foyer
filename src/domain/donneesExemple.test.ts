import { describe, expect, it } from 'vitest'
import { genererDonneesExemple } from './donneesExemple'
import { somme } from './montants'

function idsSequentiels() {
  let n = 0
  return () => `id-${++n}`
}

const AUJOURDHUI = '2026-11-02'
const donnees = genererDonneesExemple({ aujourdhui: AUJOURDHUI, genererId: idsSequentiels() })

describe('genererDonneesExemple', () => {
  it('est reproductible avec la même graine', () => {
    const encore = genererDonneesExemple({ aujourdhui: AUJOURDHUI, genererId: idsSequentiels() })
    expect(encore).toEqual(donnees)
  })

  it('couvre les 3 mois précédents jusqu’à aujourd’hui, sans opération future', () => {
    const dates = donnees.transactions.map((t) => t.date_operation).sort()
    expect(dates[0]).toBe('2026-08-01')
    expect(dates.at(-1)! <= AUJOURDHUI).toBe(true)
  })

  it('équilibre chaque virement interne : deux opérations de signe opposé', () => {
    const parTransfert = Map.groupBy(
      donnees.transactions.filter((t) => t.transfert_id),
      (t) => t.transfert_id,
    )
    expect(parTransfert.size).toBeGreaterThan(0)
    for (const operations of parTransfert.values()) {
      expect(operations).toHaveLength(2)
      expect(somme(operations.map((o) => o.montant))).toBe(0)
      expect(operations.every((o) => o.type === 'virement_interne')).toBe(true)
    }
  })

  it('ne référence que des comptes et catégories existants', () => {
    const comptes = new Set(donnees.comptes.map((c) => c.id))
    const categories = new Set(donnees.categories.map((c) => c.id))
    for (const t of donnees.transactions) {
      expect(comptes.has(t.compte_id)).toBe(true)
      if (t.categorie_id) expect(categories.has(t.categorie_id)).toBe(true)
    }
  })

  it('catégorise toutes les opérations sauf les virements internes', () => {
    for (const t of donnees.transactions) {
      expect(t.categorie_id === null).toBe(t.type === 'virement_interne')
    }
  })

  it('respecte le sens des montants selon le type', () => {
    for (const t of donnees.transactions) {
      if (t.type === 'revenu') expect(t.montant).toBeGreaterThan(0)
      if (t.type === 'depense_fixe' || t.type === 'depense_variable' || t.type === 'impot') {
        expect(t.montant).toBeLessThan(0)
      }
    }
  })

  it('rattache le compte joint aux deux membres', () => {
    const joint = donnees.comptes.find((c) => c.nom === 'Compte joint')!
    expect(donnees.comptesMembres.filter((cm) => cm.compte_id === joint.id)).toHaveLength(2)
  })

  it('marque le placement à terme comme épargne bloquée avec une échéance', () => {
    const placement = donnees.comptes.find((c) => c.nature === 'placement')!
    expect(placement.disponible).toBe(false)
    expect(placement.date_echeance).not.toBeNull()
  })
})
