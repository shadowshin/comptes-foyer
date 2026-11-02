import { describe, expect, it } from 'vitest'
import { FILTRES_VIDES, filtrerTransactions, trierParDateDecroissante } from './filtres'
import type { CompteMembre, Transaction } from './types'

const op = (o: Partial<Transaction>): Transaction => ({
  id: o.libelle ?? 'x',
  compte_id: 'courant-a',
  date_operation: '2026-10-15',
  libelle: 'Opération',
  description: null,
  type: 'depense_variable',
  categorie_id: 'courses',
  montant: -10,
  mode_paiement: 'carte',
  notes: null,
  transfert_id: null,
  recurrence_id: null,
  source: 'manuel',
  empreinte_import: null,
  ...o,
})

const transactions = [
  op({ libelle: 'Supermarché', date_operation: '2026-10-01' }),
  op({ libelle: 'Fournisseur Énergie', type: 'depense_fixe', categorie_id: 'energie', compte_id: 'joint', date_operation: '2026-10-12' }),
  op({ libelle: 'Retraite', type: 'revenu', categorie_id: 'retraite', compte_id: 'courant-b', montant: 1300, date_operation: '2026-10-09' }),
  op({ libelle: 'Pharmacie', notes: 'ordonnance du chat', categorie_id: 'sante', date_operation: '2026-11-02' }),
]

const liens: CompteMembre[] = [
  { compte_id: 'courant-a', membre_id: 'alice' },
  { compte_id: 'courant-b', membre_id: 'brigitte' },
  { compte_id: 'joint', membre_id: 'alice' },
  { compte_id: 'joint', membre_id: 'brigitte' },
]

const libelles = (f: Partial<typeof FILTRES_VIDES>) =>
  filtrerTransactions(transactions, { ...FILTRES_VIDES, ...f }, liens).map((t) => t.libelle)

describe('filtrerTransactions', () => {
  it('ne filtre rien sans critère', () => {
    expect(libelles({})).toHaveLength(4)
  })

  it('filtre par type, catégorie et compte', () => {
    expect(libelles({ type: 'revenu' })).toEqual(['Retraite'])
    expect(libelles({ categorieId: 'energie' })).toEqual(['Fournisseur Énergie'])
    expect(libelles({ compteId: 'joint' })).toEqual(['Fournisseur Énergie'])
  })

  it('inclut le compte joint dans les opérations de chaque membre', () => {
    expect(libelles({ membreId: 'brigitte' })).toEqual(['Fournisseur Énergie', 'Retraite'])
    expect(libelles({ membreId: 'alice' })).toEqual(['Supermarché', 'Fournisseur Énergie', 'Pharmacie'])
  })

  it('filtre par plage de dates, bornes incluses', () => {
    expect(libelles({ du: '2026-10-09', au: '2026-10-12' })).toEqual(['Fournisseur Énergie', 'Retraite'])
    expect(libelles({ du: '2026-11-01' })).toEqual(['Pharmacie'])
  })

  it('recherche dans le libellé et les notes, sans tenir compte des accents ni de la casse', () => {
    expect(libelles({ recherche: 'energie' })).toEqual(['Fournisseur Énergie'])
    expect(libelles({ recherche: 'CHAT' })).toEqual(['Pharmacie'])
  })

  it('combine les critères', () => {
    expect(libelles({ membreId: 'alice', type: 'depense_variable', du: '2026-10-02' })).toEqual(['Pharmacie'])
  })
})

describe('trierParDateDecroissante', () => {
  it('place les opérations récentes en premier sans modifier la liste d’origine', () => {
    const triees = trierParDateDecroissante(transactions)
    expect(triees.map((t) => t.date_operation)).toEqual(['2026-11-02', '2026-10-12', '2026-10-09', '2026-10-01'])
    expect(transactions[0].libelle).toBe('Supermarché')
  })
})
