import { describe, expect, it } from 'vitest'
import { construireOperations, saisieDepuisOperations, validerSaisie, type Saisie } from './saisie'
import type { Transaction } from './types'

const base: Saisie = {
  date: '2026-11-02',
  libelle: '  Supermarché ',
  type: 'depense_variable',
  montant: 54.3,
  compteId: 'courant',
  compteCibleId: null,
  categorieId: 'courses',
  modePaiement: 'carte',
  notes: '',
  recurrente: false,
  frequence: 'mensuelle',
}

describe('validerSaisie', () => {
  it('accepte une saisie complète', () => {
    expect(validerSaisie(base)).toEqual({})
  })

  it('refuse un montant nul, négatif ou à plus de deux décimales', () => {
    expect(validerSaisie({ ...base, montant: 0 }).montant).toBeDefined()
    expect(validerSaisie({ ...base, montant: -5 }).montant).toBeDefined()
    expect(validerSaisie({ ...base, montant: 1.234 }).montant).toBeDefined()
    expect(validerSaisie({ ...base, montant: Number.NaN }).montant).toBeDefined()
  })

  it('accepte les montants à deux décimales malgré les arrondis flottants', () => {
    expect(validerSaisie({ ...base, montant: 0.29 })).toEqual({})
    expect(validerSaisie({ ...base, montant: 1234.56 })).toEqual({})
  })

  it('exige une description non vide et une date', () => {
    expect(validerSaisie({ ...base, libelle: '   ' }).libelle).toBeDefined()
    expect(validerSaisie({ ...base, date: '' }).date).toBeDefined()
  })

  it('exige une catégorie, sauf pour un virement interne', () => {
    expect(validerSaisie({ ...base, categorieId: null }).categorieId).toBeDefined()
    const virement = { ...base, type: 'virement_interne' as const, categorieId: null, compteCibleId: 'livret' }
    expect(validerSaisie(virement)).toEqual({})
  })

  it('exige un compte de destination différent pour un virement interne', () => {
    const virement = { ...base, type: 'virement_interne' as const, categorieId: null }
    expect(validerSaisie({ ...virement, compteCibleId: null }).compteCibleId).toBeDefined()
    expect(validerSaisie({ ...virement, compteCibleId: 'courant' }).compteCibleId).toBeDefined()
  })
})

describe('construireOperations', () => {
  it('rend négative une dépense et nettoie les textes', () => {
    const { transactions, recurrence } = construireOperations(base)
    expect(transactions).toHaveLength(1)
    expect(transactions[0]).toMatchObject({ montant: -54.3, libelle: 'Supermarché', notes: null, source: 'manuel' })
    expect(recurrence).toBeNull()
  })

  it('rend positif un revenu', () => {
    const { transactions } = construireOperations({ ...base, type: 'revenu', montant: 1420 })
    expect(transactions[0].montant).toBe(1420)
  })

  it('rend négatifs un impôt et une épargne externe', () => {
    expect(construireOperations({ ...base, type: 'impot' }).transactions[0].montant).toBeLessThan(0)
    expect(construireOperations({ ...base, type: 'epargne' }).transactions[0].montant).toBeLessThan(0)
  })

  it('crée deux opérations liées et équilibrées pour un virement interne', () => {
    const { transactions } = construireOperations(
      { ...base, type: 'virement_interne', compteCibleId: 'livret', categorieId: 'ignorée', montant: 100 },
      'transfert-1',
    )
    expect(transactions).toHaveLength(2)
    expect(transactions.map((t) => [t.compte_id, t.montant])).toEqual([
      ['courant', -100],
      ['livret', 100],
    ])
    expect(transactions.every((t) => t.transfert_id === 'transfert-1' && t.categorie_id === null)).toBe(true)
  })

  it('prépare une récurrence signée quand la saisie est récurrente', () => {
    const { recurrence } = construireOperations({ ...base, recurrente: true, frequence: 'hebdomadaire' })
    expect(recurrence).toMatchObject({ montant: -54.3, frequence: 'hebdomadaire', date_debut: '2026-11-02' })
  })

  it('prépare une récurrence de virement avec son compte cible', () => {
    const { recurrence } = construireOperations({
      ...base,
      type: 'virement_interne',
      compteCibleId: 'livret',
      montant: 100,
      recurrente: true,
    })
    expect(recurrence).toMatchObject({ montant: -100, compte_cible_id: 'livret', categorie_id: null })
  })
})

describe('saisieDepuisOperations', () => {
  const operation = (o: Partial<Transaction>): Transaction => ({
    id: 'x',
    compte_id: 'courant',
    date_operation: '2026-10-06',
    libelle: 'Épargne',
    description: null,
    type: 'virement_interne',
    categorie_id: null,
    montant: -100,
    mode_paiement: 'virement',
    notes: null,
    transfert_id: 't',
    recurrence_id: null,
    source: 'manuel',
    empreinte_import: null,
    ...o,
  })

  it('retrouve source et destination d’un virement, dans n’importe quel ordre', () => {
    const s = saisieDepuisOperations([operation({ id: 'b', compte_id: 'livret', montant: 100 }), operation({ id: 'a' })])
    expect(s).toMatchObject({ compteId: 'courant', compteCibleId: 'livret', montant: 100 })
  })

  it('redonne un montant positif pour une dépense', () => {
    const s = saisieDepuisOperations([operation({ type: 'depense_fixe', montant: -96, transfert_id: null })])
    expect(s).toMatchObject({ montant: 96, compteCibleId: null })
  })
})
