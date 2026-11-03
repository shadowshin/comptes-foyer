import { describe, expect, it } from 'vitest'
import { budgetPropose, depensesParCategorie, etatBudget, moyennesMensuelles, suiviBudgets } from './budgets'
import { finDuMois, moisCompletsAvant } from './dates'
import type { Budget, Categorie, Compte, Transaction } from './types'

const compte = (id: string): Compte => ({
  id,
  nom: id,
  banque: 'Banque',
  nature: 'courant',
  disponible: true,
  solde_initial: 1000,
  date_solde_initial: '2026-08-01',
  plafond: null,
  date_echeance: null,
  cle_import: null,
  actif: true,
  ordre: 0,
})

let n = 0
const tx = (date_operation: string, montant: number, o: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  compte_id: 'courant',
  date_operation,
  libelle: 'Opération',
  description: null,
  type: 'depense_variable',
  categorie_id: 'courses',
  montant,
  mode_paiement: null,
  notes: null,
  transfert_id: null,
  recurrence_id: null,
  source: 'manuel',
  empreinte_import: null,
  ...o,
})

const cat = (id: string, o: Partial<Categorie> = {}): Categorie => ({ id, nom: id, type: 'depense_variable', archivee: false, ...o })
const budget = (categorie_id: string, montant_mensuel: number): Budget => ({ id: `b-${categorie_id}`, categorie_id, montant_mensuel })

const comptes = [compte('courant'), compte('autre')]

describe('moisCompletsAvant', () => {
  it('rend les mois précédents, du plus récent au plus ancien', () => {
    expect(moisCompletsAvant('2026-11-03', 3, '2026-01-01')).toEqual(['2026-10-01', '2026-09-01', '2026-08-01'])
  })

  it("s'arrête au premier mois qui n'est pas entièrement couvert par l'historique", () => {
    expect(moisCompletsAvant('2026-11-03', 3, '2026-09-08')).toEqual(['2026-10-01'])
    expect(moisCompletsAvant('2026-11-03', 3, '2026-11-01')).toEqual([])
  })

  it('compte un mois couvert dès son premier jour', () => {
    expect(moisCompletsAvant('2026-11-03', 3, '2026-09-01')).toEqual(['2026-10-01', '2026-09-01'])
  })
})

describe('finDuMois', () => {
  it('gère les mois courts', () => {
    expect(finDuMois('2026-02-10')).toBe('2026-02-28')
    expect(finDuMois('2026-11-03')).toBe('2026-11-30')
  })
})

describe('depensesParCategorie', () => {
  it('additionne les dépenses de la période en valeur positive, remboursements déduits', () => {
    const d = depensesParCategorie(
      comptes,
      [tx('2026-10-05', -50), tx('2026-10-20', -30.1), tx('2026-10-21', 10.1), tx('2026-11-01', -99)],
      '2026-10-01',
      '2026-10-31',
    )
    expect(d.get('courses')).toBe(70)
  })

  it('ignore revenus, épargne et virements internes, et range à part les dépenses sans catégorie', () => {
    const d = depensesParCategorie(
      comptes,
      [
        tx('2026-10-05', 2000, { type: 'revenu', categorie_id: 'salaire' }),
        tx('2026-10-06', -100, { type: 'epargne', categorie_id: 'livret' }),
        tx('2026-10-07', -300, { type: 'virement_interne', categorie_id: null }),
        tx('2026-10-08', -42, { categorie_id: null }),
        tx('2026-10-09', -60, { type: 'depense_fixe', categorie_id: 'energie' }),
        tx('2026-10-10', -80, { type: 'impot', categorie_id: 'ir' }),
      ],
      '2026-10-01',
      '2026-10-31',
    )
    expect([...d.entries()].sort()).toEqual([
      ['energie', 60],
      ['ir', 80],
      [null, 42],
    ].sort())
  })

  it("ne compte que les comptes du périmètre (vue d'un membre)", () => {
    const d = depensesParCategorie([compte('courant')], [tx('2026-10-05', -50), tx('2026-10-06', -20, { compte_id: 'autre' })], '2026-10-01', '2026-10-31')
    expect(d.get('courses')).toBe(50)
  })
})

describe('moyennesMensuelles', () => {
  it('fait la moyenne des 3 derniers mois complets, sans le mois en cours', () => {
    const transactions = [
      tx('2026-07-15', -1000), // hors des 3 mois
      tx('2026-08-10', -300),
      tx('2026-09-10', -330),
      tx('2026-10-10', -360),
      tx('2026-11-02', -999), // mois en cours
    ]
    const { moyennes, nbMois } = moyennesMensuelles(comptes, transactions, '2026-11-03', 3)
    expect(nbMois).toBe(3)
    expect(moyennes.get('courses')).toBe(330)
  })

  it("se contente des mois disponibles quand l'historique est court", () => {
    const { moyennes, nbMois } = moyennesMensuelles(comptes, [tx('2026-09-12', -500), tx('2026-10-10', -120)], '2026-11-03', 3)
    // septembre ne commence qu'au 12 : seul octobre est complet
    expect(nbMois).toBe(1)
    expect(moyennes.get('courses')).toBe(120)
  })

  it('ne propose rien sans aucun mois complet', () => {
    expect(moyennesMensuelles(comptes, [tx('2026-11-02', -10)], '2026-11-03', 3).nbMois).toBe(0)
    expect(moyennesMensuelles(comptes, [], '2026-11-03', 3).nbMois).toBe(0)
  })
})

describe('budgetPropose', () => {
  it('arrondit à la dizaine supérieure', () => {
    expect(budgetPropose(331.4)).toBe(340)
    expect(budgetPropose(330)).toBe(330)
    expect(budgetPropose(0.5)).toBe(10)
  })

  it('ne propose rien pour une catégorie sans dépense', () => {
    expect(budgetPropose(0)).toBeNull()
    expect(budgetPropose(-20)).toBeNull()
  })
})

describe('etatBudget', () => {
  it('passe à « proche » au seuil, à « dépassé » à 100 %', () => {
    expect(etatBudget(79, 100, 80)).toBe('ok')
    expect(etatBudget(80, 100, 80)).toBe('proche')
    expect(etatBudget(99.99, 100, 80)).toBe('proche')
    expect(etatBudget(100, 100, 80)).toBe('depasse')
  })
})

describe('suiviBudgets', () => {
  const categories = [
    cat('courses'),
    cat('energie', { type: 'depense_fixe' }),
    cat('salaire', { type: 'revenu' }),
    cat('livret', { type: 'epargne' }),
    cat('ancienne', { archivee: true }),
    cat('archivee-utilisee', { archivee: true }),
  ]

  it('liste les catégories de dépense, avec ou sans budget', () => {
    const lignes = suiviBudgets(categories, [budget('courses', 400)], new Map([['courses', 340]]), 80)
    expect(lignes.map((l) => [l.categorie.id, l.etat])).toEqual([
      ['courses', 'proche'],
      ['energie', 'sans_budget'],
    ])
    expect(lignes[0].ratio).toBe(0.85)
    expect(lignes[1].ratio).toBeNull()
  })

  it('garde une catégorie archivée qui a encore des dépenses ou un budget', () => {
    const lignes = suiviBudgets(categories, [], new Map([['archivee-utilisee', 12]]), 80)
    expect(lignes.map((l) => l.categorie.id)).toContain('archivee-utilisee')
    expect(lignes.map((l) => l.categorie.id)).not.toContain('ancienne')
  })

  it('compte 0 € dépensé pour une catégorie sans opération', () => {
    const [courses] = suiviBudgets(categories, [budget('courses', 400)], new Map(), 80)
    expect(courses).toMatchObject({ reel: 0, ratio: 0, etat: 'ok' })
  })
})
