import { describe, expect, it } from 'vitest'
import { bilanMois, evolutionParCategorie, indicateursBilan, moisAffiches, moisDeSecurite, moyenneBilans } from './rapports'
import type { Compte, Transaction } from './types'

const compte = (id: string, o: Partial<Compte> = {}): Compte => ({
  id,
  nom: id,
  banque: 'Banque',
  nature: 'courant',
  disponible: true,
  solde_initial: 0,
  date_solde_initial: '2026-09-01',
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

const virement = (de: string, vers: string, date: string, montant: number): Transaction[] => [
  tx(de, date, -montant, { type: 'virement_interne', transfert_id: `v${n}` }),
  tx(vers, date, montant, { type: 'virement_interne', transfert_id: `v${n}` }),
]

const comptes = [
  compte('courant'),
  compte('livret', { nature: 'livret' }),
  compte('livret2', { nature: 'livret' }),
  compte('dat', { nature: 'placement', disponible: false }),
]

describe('bilanMois', () => {
  it('répartit revenus et dépenses par type, hors virements internes', () => {
    const b = bilanMois(
      comptes,
      [
        tx('courant', '2026-10-01', 2000),
        tx('courant', '2026-10-05', -600, { type: 'depense_fixe' }),
        tx('courant', '2026-10-06', -300),
        tx('courant', '2026-10-07', -100, { type: 'impot' }),
        tx('courant', '2026-10-08', 20, { type: 'depense_variable' }), // remboursement
        tx('courant', '2026-11-01', -999), // hors période
      ],
      '2026-10-01',
      '2026-10-31',
    )
    expect(b).toEqual({ revenus: 2000, fixes: 600, variables: 280, impots: 100, depenses: 980, epargneNette: 0 })
  })

  it("compte l'épargne nette : versements vers l'épargne moins les retraits", () => {
    const b = bilanMois(
      comptes,
      [
        ...virement('courant', 'livret', '2026-10-02', 300),
        ...virement('courant', 'dat', '2026-10-18', 50),
        ...virement('livret', 'courant', '2026-10-20', 100),
      ],
      '2026-10-01',
      '2026-10-31',
    )
    expect(b.epargneNette).toBe(250)
    expect(b.revenus).toBe(0)
    expect(b.depenses).toBe(0)
  })

  it('devient négative quand on puise dans les livrets', () => {
    const b = bilanMois(comptes, virement('livret', 'courant', '2026-10-20', 400), '2026-10-01', '2026-10-31')
    expect(b.epargneNette).toBe(-400)
  })

  it('ignore un virement entre deux livrets', () => {
    expect(bilanMois(comptes, virement('livret', 'livret2', '2026-10-20', 400), '2026-10-01', '2026-10-31').epargneNette).toBe(0)
  })

  it("compte une opération de type Épargne sur un compte courant (épargne non suivie dans l'appli)", () => {
    const b = bilanMois(comptes, [tx('courant', '2026-10-09', -80, { type: 'epargne' })], '2026-10-01', '2026-10-31')
    expect(b.epargneNette).toBe(80)
    expect(b.depenses).toBe(0)
  })

  it("en vue membre, compte l'arrivée sur son livret même si l'argent vient d'un autre membre", () => {
    const b = bilanMois([compte('livret', { nature: 'livret' })], virement('courant', 'livret', '2026-10-02', 300), '2026-10-01', '2026-10-31')
    expect(b.epargneNette).toBe(300)
  })
})

describe('indicateursBilan', () => {
  const bilan = { revenus: 2000, fixes: 600, variables: 300, impots: 100, depenses: 1000, epargneNette: 200 }

  it('calcule taux d’épargne, parts des dépenses et reste à vivre', () => {
    expect(indicateursBilan(bilan)).toEqual({
      tauxEpargne: 0.1,
      partFixes: 0.6,
      partVariables: 0.3,
      partImpots: 0.1,
      resteAVivre: 1300,
    })
  })

  it('ne donne ni taux sans revenu, ni parts sans dépense', () => {
    const i = indicateursBilan({ ...bilan, revenus: 0, fixes: 0, variables: 0, impots: 0, depenses: 0 })
    expect(i).toMatchObject({ tauxEpargne: null, partFixes: null, partVariables: null, partImpots: null, resteAVivre: 0 })
  })

  it('donne un reste à vivre négatif quand les charges dépassent les revenus', () => {
    expect(indicateursBilan({ ...bilan, revenus: 500 }).resteAVivre).toBe(-200)
  })
})

describe('moyenneBilans', () => {
  it('fait la moyenne champ par champ', () => {
    const m = moyenneBilans([
      { revenus: 2000, fixes: 600, variables: 300, impots: 100, depenses: 1000, epargneNette: 200 },
      { revenus: 1000, fixes: 600, variables: 500, impots: 0, depenses: 1100, epargneNette: -100 },
    ])
    expect(m).toEqual({ revenus: 1500, fixes: 600, variables: 400, impots: 50, depenses: 1050, epargneNette: 50 })
    // le taux moyen est donc le rapport des sommes, pas la moyenne des taux
    expect(indicateursBilan(m!).tauxEpargne).toBeCloseTo(1 / 30)
  })

  it('rend null sans aucun mois', () => {
    expect(moyenneBilans([])).toBeNull()
  })
})

describe('moisAffiches', () => {
  it('rend les n mois finissant par le mois choisi, du plus ancien au plus récent', () => {
    expect(moisAffiches('2026-10-15', 3, '2026-01-01')).toEqual(['2026-08-01', '2026-09-01', '2026-10-01'])
  })

  it("ne remonte pas avant le mois où commence l'historique", () => {
    expect(moisAffiches('2026-10-15', 6, '2026-09-12')).toEqual(['2026-09-01', '2026-10-01'])
  })
})

describe('evolutionParCategorie', () => {
  it('donne les dépenses de chaque catégorie par mois, les plus grosses en premier', () => {
    const lignes = evolutionParCategorie(
      comptes,
      [
        tx('courant', '2026-09-10', -100, { categorie_id: 'courses' }),
        tx('courant', '2026-10-10', -150, { categorie_id: 'courses' }),
        tx('courant', '2026-10-11', -500, { type: 'depense_fixe', categorie_id: 'loyer' }),
        tx('courant', '2026-10-12', -20),
        tx('courant', '2026-10-13', 2000, { categorie_id: 'salaire' }),
      ],
      [
        ['2026-09-01', '2026-09-30'],
        ['2026-10-01', '2026-10-31'],
      ],
    )
    expect(lignes).toEqual([
      { categorieId: 'loyer', montants: [0, 500], total: 500 },
      { categorieId: 'courses', montants: [100, 150], total: 250 },
      { categorieId: null, montants: [0, 20], total: 20 },
    ])
  })
})

describe('moisDeSecurite', () => {
  it("divise l'épargne disponible par les dépenses mensuelles, l'épargne bloquée à part", () => {
    const liste = [
      compte('courant', { solde_initial: 5000 }),
      compte('livret', { nature: 'livret', solde_initial: 3000 }),
      compte('ldds', { nature: 'livret', solde_initial: 1200 }),
      compte('dat', { nature: 'placement', disponible: false, solde_initial: 8000 }),
      compte('ferme', { nature: 'livret', solde_initial: 999, actif: false }),
    ]
    const r = moisDeSecurite(liste, virement('livret', 'courant', '2026-10-01', 200), '2026-10-31', 1250)
    expect(r).toEqual({ disponible: 4000, bloquee: 8000, mois: 3.2 })
  })

  it('ne calcule pas de durée sans dépenses connues', () => {
    expect(moisDeSecurite(comptes, [], '2026-10-31', 0).mois).toBeNull()
  })
})
