import { describe, expect, it } from 'vitest'
import { cleLibelle, detecterRecurrences, nomCourt, occurrences, recurrenceSemblable } from './recurrences'
import {
  comptesDuPerimetre,
  depenseCouranteQuotidienne,
  fluxQuotidiens,
  historiqueSoldes,
  indicateurs,
  projeter,
  soldeFinDeJour,
} from './tresorerie'
import type { Compte, Recurrence, Transaction } from './types'

const compte = (id: string, o: Partial<Compte> = {}): Compte => ({
  id,
  nom: id,
  banque: 'Banque',
  nature: 'courant',
  disponible: true,
  solde_initial: 1000,
  date_solde_initial: '2026-10-01',
  plafond: null,
  date_echeance: null,
  cle_import: null,
  actif: true,
  ordre: 0,
  ...o,
})

let n = 0
const tx = (compte_id: string, date_operation: string, montant: number, o: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  compte_id,
  date_operation,
  libelle: 'Opération',
  description: null,
  type: montant > 0 ? 'revenu' : 'depense_variable',
  categorie_id: null,
  montant,
  mode_paiement: null,
  notes: null,
  transfert_id: null,
  recurrence_id: null,
  source: 'manuel',
  empreinte_import: null,
  ...o,
})

const rec = (o: Partial<Recurrence>): Recurrence => ({
  id: 'r',
  libelle: 'Loyer',
  compte_id: 'courant',
  compte_cible_id: null,
  type: 'depense_fixe',
  categorie_id: null,
  montant: -500,
  mode_paiement: 'prelevement',
  frequence: 'mensuelle',
  date_debut: '2026-09-05',
  date_fin: null,
  actif: true,
  ...o,
})

describe('occurrences', () => {
  it('reste calé sur le jour de départ, même après un mois court', () => {
    expect(occurrences(rec({ date_debut: '2026-01-31' }), '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  it('gère les fréquences hebdomadaire, quotidienne et annuelle', () => {
    expect(occurrences(rec({ frequence: 'hebdomadaire', date_debut: '2026-11-02' }), '2026-11-03', '2026-11-20')).toEqual([
      '2026-11-09',
      '2026-11-16',
    ])
    expect(occurrences(rec({ frequence: 'quotidienne', date_debut: '2026-11-01' }), '2026-11-02', '2026-11-03')).toHaveLength(2)
    expect(occurrences(rec({ frequence: 'annuelle', date_debut: '2025-10-15' }), '2026-01-01', '2027-12-31')).toEqual([
      '2026-10-15',
      '2027-10-15',
    ])
  })

  it('s’arrête à la date de fin et ignore une récurrence inactive', () => {
    expect(occurrences(rec({ date_fin: '2026-10-31' }), '2026-09-01', '2026-12-31')).toEqual(['2026-09-05', '2026-10-05'])
    expect(occurrences(rec({ actif: false }), '2026-09-01', '2026-12-31')).toEqual([])
  })
})

describe('soldes', () => {
  const courant = compte('courant')
  const operations = [tx('courant', '2026-09-28', -30), tx('courant', '2026-10-01', -100), tx('courant', '2026-10-10', 250)]

  it('part du solde initial au début du jour indiqué', () => {
    expect(soldeFinDeJour(courant, operations, '2026-10-01')).toBe(900)
    expect(soldeFinDeJour(courant, operations, '2026-10-10')).toBe(1150)
  })

  it('remonte le temps avant la date du solde initial', () => {
    expect(soldeFinDeJour(courant, operations, '2026-09-30')).toBe(1000)
    expect(soldeFinDeJour(courant, operations, '2026-09-27')).toBe(1030)
  })

  it('produit un historique jour par jour cohérent avec le calcul direct', () => {
    const histo = historiqueSoldes([courant], operations, '2026-09-26', '2026-10-12')
    for (const { date, solde } of histo) expect(solde).toBe(soldeFinDeJour(courant, operations, date))
  })
})

describe('périmètre', () => {
  const comptes = [
    compte('courant'),
    compte('joint'),
    compte('livret', { nature: 'livret' }),
    compte('placement', { nature: 'placement', disponible: false }),
    compte('archive', { actif: false }),
  ]
  const liens = [
    { compte_id: 'courant', membre_id: 'a' },
    { compte_id: 'joint', membre_id: 'a' },
    { compte_id: 'joint', membre_id: 'b' },
    { compte_id: 'livret', membre_id: 'b' },
  ]
  const ids = (p: Parameters<typeof comptesDuPerimetre>[2], m: string | null = null) =>
    comptesDuPerimetre(comptes, liens, p, m).map((c) => c.id)

  it('sélectionne par nature, disponibilité et membre, sans les comptes archivés', () => {
    expect(ids('courants')).toEqual(['courant', 'joint'])
    expect(ids('disponible')).toEqual(['courant', 'joint', 'livret'])
    expect(ids('tout')).toEqual(['courant', 'joint', 'livret', 'placement'])
    expect(ids('disponible', 'b')).toEqual(['joint', 'livret'])
  })
})

describe('flux et projection', () => {
  const courant = compte('courant', { date_solde_initial: '2026-11-01' })
  const livret = compte('livret', { nature: 'livret', date_solde_initial: '2026-11-01' })

  it('additionne entrées et sorties par jour', () => {
    const flux = fluxQuotidiens([courant], [tx('courant', '2026-11-02', 50), tx('courant', '2026-11-02', -20)], '2026-11-01', '2026-11-02')
    expect(flux).toEqual([
      { date: '2026-11-01', entrees: 0, sorties: 0, net: 0 },
      { date: '2026-11-02', entrees: 50, sorties: -20, net: 30 },
    ])
  })

  it('applique les récurrences futures uniquement, à partir de demain', () => {
    const { points, evenements } = projeter([courant], [], [rec({ date_debut: '2026-10-02' })], '2026-11-02', 40)
    expect(evenements.map((e) => e.date)).toEqual(['2026-12-02'])
    expect(points[0]).toEqual({ date: '2026-11-02', solde: 1000 })
    expect(points.at(-1)!.solde).toBe(500)
  })

  it('compte un virement vers l’épargne comme une sortie des comptes courants, neutre sur le foyer', () => {
    const virement = rec({ type: 'virement_interne', compte_cible_id: 'livret', montant: -100, date_debut: '2026-11-06' })
    expect(projeter([courant], [], [virement], '2026-11-02', 10).points.at(-1)!.solde).toBe(900)
    expect(projeter([courant, livret], [], [virement], '2026-11-02', 10).points.at(-1)!.solde).toBe(2000)
  })

  it('estime la dépense courante quotidienne à partir des seules dépenses variables', () => {
    const operations = [
      tx('courant', '2026-10-01', -60, { type: 'depense_variable' }),
      tx('courant', '2026-10-05', -30, { type: 'depense_variable' }),
      tx('courant', '2026-10-05', -500, { type: 'depense_fixe' }),
      tx('courant', '2026-10-06', 20, { type: 'depense_variable' }),
      tx('livret', '2026-10-06', -999, { type: 'depense_variable' }),
    ]
    expect(depenseCouranteQuotidienne([courant], operations, '2026-10-01', '2026-10-10')).toBe(7)
  })

  it('retranche la dépense courante chaque jour de la projection', () => {
    const { points } = projeter([courant], [], [], '2026-11-02', 10, 7.5)
    expect(points[1].solde).toBe(992.5)
    expect(points.at(-1)!.solde).toBe(925)
  })

  it('calcule les indicateurs du mois, hors virements internes', () => {
    const operations = [
      tx('courant', '2026-11-01', 1400, { type: 'revenu' }),
      tx('courant', '2026-11-02', -60, { type: 'depense_variable' }),
      tx('courant', '2026-11-02', 10, { type: 'depense_variable' }),
      tx('courant', '2026-11-02', -100, { type: 'virement_interne' }),
      tx('courant', '2026-10-30', -999, { type: 'depense_fixe' }),
    ]
    const { points } = projeter([courant], operations, [rec({ date_debut: '2026-11-05' })], '2026-11-02', 90)
    expect(indicateurs([courant], operations, points, '2026-11-02')).toEqual({
      soldeActuel: 2250,
      revenus: 1400,
      depenses: 50,
      revenusMoisPrecedent: 0,
      depensesMoisPrecedent: 999,
      soldeProjete30: 1750,
    })
  })
})

describe('détection des récurrences', () => {
  it('normalise le libellé sans chiffres ni dates', () => {
    expect(cleLibelle('Paiement par carte · X1234 STATION DEMO AU 09/10')).toBe('PAIEMENT PAR CARTE STATION DEMO AU')
  })

  it('repère une opération mensuelle stable et ignore les dépenses irrégulières', () => {
    const operations = [
      tx('courant', '2026-09-05', -560, { libelle: 'Prélèvement · BAILLEUR DEMO', type: 'depense_fixe' }),
      tx('courant', '2026-10-05', -560, { libelle: 'Prélèvement · BAILLEUR DEMO', type: 'depense_fixe' }),
      tx('courant', '2026-09-03', -40, { libelle: 'Paiement par carte · SUPERMARCHE' }),
      tx('courant', '2026-10-25', -120, { libelle: 'Paiement par carte · SUPERMARCHE' }),
      tx('courant', '2026-10-12', -96, { libelle: 'Prélèvement · ENERGIE DEMO', type: 'depense_fixe' }),
    ]
    const suggestions = detecterRecurrences(operations, [])
    expect(suggestions.map((s) => [s.libelle, s.montant, s.date_debut])).toEqual([['BAILLEUR DEMO', -560, '2026-10-05']])
  })

  it('retrouve le compte d’arrivée d’un virement mensuel', () => {
    const operations = [
      tx('courant', '2026-09-06', -100, { libelle: 'Virement émis · EPARGNE', type: 'virement_interne', transfert_id: 'a' }),
      tx('livret', '2026-09-06', 100, { libelle: 'Virement reçu', type: 'virement_interne', transfert_id: 'a' }),
      tx('courant', '2026-10-06', -100, { libelle: 'Virement émis · EPARGNE', type: 'virement_interne', transfert_id: 'b' }),
      tx('livret', '2026-10-06', 100, { libelle: 'Virement reçu', type: 'virement_interne', transfert_id: 'b' }),
    ]
    expect(detecterRecurrences(operations, [])).toMatchObject([{ compte_id: 'courant', compte_cible_id: 'livret', montant: -100 }])
  })

  it('propose un nom court à partir du libellé bancaire', () => {
    expect(nomCourt('Prélèvement · FREE MOBILE - Free')).toBe('FREE MOBILE')
    expect(nomCourt('Virement émis · AG MADAME DEMO')).toBe('AG MADAME DEMO')
    expect(nomCourt('Loyer')).toBe('Loyer')
  })

  it('reconnaît une récurrence déjà déclarée pour la même opération, même renommée', () => {
    const existante = rec({ libelle: 'ASSUREUR DEMO VIE', compte_id: 'courant', type: 'virement_interne', montant: -60 })
    const operation = {
      compte_id: 'courant',
      type: 'virement_interne' as const,
      montant: -60,
      libelle: 'Prélèvement · ASSUREUR DEMO VIE - Assureur - CONTRAT 123',
    }
    expect(recurrenceSemblable([existante], operation)).toBe(existante)
    expect(recurrenceSemblable([{ ...existante, libelle: 'Mon placement' }], operation)).toBeDefined()
    expect(recurrenceSemblable([existante], { ...operation, compte_id: 'joint' })).toBeUndefined()
  })

  it('ne propose pas une récurrence déjà déclarée', () => {
    const operations = [
      tx('courant', '2026-09-05', -560, { libelle: 'Prélèvement · BAILLEUR DEMO', type: 'depense_fixe' }),
      tx('courant', '2026-10-05', -560, { libelle: 'Prélèvement · BAILLEUR DEMO', type: 'depense_fixe' }),
    ]
    expect(detecterRecurrences(operations, [rec({ libelle: 'Loyer', montant: -560 })])).toEqual([])
  })
})
