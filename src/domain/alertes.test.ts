import { describe, expect, it } from 'vitest'
import { calculerAlertes, libelleCompte, type DonneesAlertes, type SujetAlerte } from './alertes'
import { PARAMETRES_PAR_DEFAUT, type Compte, type Recurrence, type Transaction } from './types'

const AUJOURDHUI = '2026-11-10'

const compte = (id: string, o: Partial<Compte> = {}): Compte => ({
  id,
  nom: id,
  banque: 'Banque',
  nature: 'courant',
  disponible: true,
  solde_initial: 1000,
  date_solde_initial: '2026-11-01',
  plafond: null,
  date_echeance: null,
  cle_import: null,
  actif: true,
  ordre: 0,
  ...o,
})

let n = 0
const tx = (date_operation: string, montant: number, o: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  compte_id: 'courant',
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
  date_debut: '2026-09-20',
  date_fin: null,
  actif: true,
  ...o,
})

const donnees = (o: Partial<DonneesAlertes> = {}): DonneesAlertes => ({
  membres: [],
  comptes: [compte('courant')],
  comptesMembres: [],
  categories: [],
  transactions: [],
  recurrences: [],
  budgets: [],
  parametres: PARAMETRES_PAR_DEFAUT,
  aujourdhui: AUJOURDHUI,
  ...o,
})

const duSujet = (d: DonneesAlertes, sujet: SujetAlerte) => calculerAlertes(d).filter((a) => a.sujet === sujet)

describe('alertes de solde', () => {
  it('signale en critique un découvert prévu sous 30 jours, avec la date et le montant à virer', () => {
    const [alerte] = duSujet(donnees({ comptes: [compte('courant', { solde_initial: 100 })], recurrences: [rec({ montant: -200 })] }), 'solde')
    expect(alerte).toMatchObject({ niveau: 'critique', date: '2026-11-20' })
    expect(alerte.detail).toContain('20 novembre')
    // pour remonter au coussin de 150 € depuis -100 € : 250 €
    expect(alerte.action).toMatch(/250,00/)
  })

  it('signale en avertissement un solde prévu sous le coussin mais positif', () => {
    const alertes = duSujet(donnees({ recurrences: [rec({ montant: -900 })] }), 'solde')
    expect(alertes.map((a) => a.niveau)).toEqual(['avertissement'])
  })

  it('ne dit rien quand le solde reste au-dessus du coussin', () => {
    expect(duSujet(donnees({ recurrences: [rec({ montant: -800 })] }), 'solde')).toEqual([])
  })

  it('tient compte des dépenses courantes estimées, sinon la projection serait trop optimiste', () => {
    // 310 € de dépenses variables sur 31 jours : 10 € par jour, soit 300 € sur 30 jours
    const d = donnees({
      comptes: [compte('courant', { solde_initial: 700, date_solde_initial: '2026-10-11' })],
      transactions: [tx('2026-10-20', -310)],
    })
    const [alerte] = duSujet(d, 'solde')
    expect(alerte.niveau).toBe('avertissement')
    expect(alerte.detail).toMatch(/90,00/)
  })

  it('ne surveille que les comptes courants actifs', () => {
    const d = donnees({
      comptes: [
        compte('livret', { nature: 'livret', solde_initial: 10 }),
        compte('ferme', { solde_initial: -50, actif: false }),
      ],
    })
    expect(duSujet(d, 'solde')).toEqual([])
  })
})

describe('alertes de budget', () => {
  const categories = [{ id: 'courses', nom: 'Courses', type: 'depense_variable' as const, archivee: false }]
  const budgets = [{ id: 'b', categorie_id: 'courses', montant_mensuel: 100 }]

  it('avertit quand une catégorie atteint le seuil, avec ce qui reste', () => {
    const [alerte] = duSujet(donnees({ categories, budgets, transactions: [tx('2026-11-05', -85, { categorie_id: 'courses' })] }), 'budget')
    expect(alerte.titre).toBe('Budget Courses à 85 %')
    expect(alerte.action).toMatch(/15,00/)
  })

  it('avertit du dépassement et de son montant', () => {
    const [alerte] = duSujet(donnees({ categories, budgets, transactions: [tx('2026-11-05', -120, { categorie_id: 'courses' })] }), 'budget')
    expect(alerte.titre).toBe('Budget Courses dépassé')
    expect(alerte.action).toMatch(/20,00/)
  })

  it('ne compte que le mois en cours', () => {
    const d = donnees({ categories, budgets, transactions: [tx('2026-10-28', -300, { categorie_id: 'courses' })] })
    expect(duSujet(d, 'budget')).toEqual([])
  })
})

describe('alertes de revenus', () => {
  // revenus de mai à septembre : 2 000 € par mois
  const historique = ['05', '06', '07', '08', '09'].map((m) => tx(`2026-${m}-01`, 2000))

  it('compare le dernier mois complet à la moyenne des mois précédents', () => {
    const [alerte] = duSujet(donnees({ transactions: [...historique, tx('2026-10-28', 1500)] }), 'revenus')
    expect(alerte.titre).toBe('Revenus de octobre en baisse de 25 %')
    expect(alerte.detail).toContain('5 mois')
  })

  it('tolère une baisse sous le seuil', () => {
    expect(duSujet(donnees({ transactions: [...historique, tx('2026-10-28', 1700)] }), 'revenus')).toEqual([])
  })

  it('ne juge pas le mois en cours, encore incomplet', () => {
    const d = donnees({ transactions: [...historique, tx('2026-10-28', 2000)] })
    expect(duSujet(d, 'revenus')).toEqual([])
  })

  it("se tait tant que l'historique ne couvre pas un mois de référence complet", () => {
    expect(duSujet(donnees({ transactions: [tx('2026-09-15', 2000), tx('2026-10-28', 100)] }), 'revenus')).toEqual([])
  })
})

describe("alertes d'échéance", () => {
  it('annonce les sorties récurrentes des 7 prochains jours, pas les entrées', () => {
    const d = donnees({
      recurrences: [
        rec({ id: 'box', libelle: 'Box internet', montant: -30, date_debut: '2026-10-15' }),
        rec({ id: 'loin', libelle: 'Assurance', montant: -30, date_debut: '2026-10-25' }),
        rec({ id: 'salaire', libelle: 'Salaire', type: 'revenu', montant: 2000, date_debut: '2026-10-14' }),
      ],
    })
    const alertes = duSujet(d, 'echeance')
    expect(alertes.map((a) => [a.titre, a.niveau])).toEqual([['Box internet le 15 novembre', 'info']])
  })
})

describe('alertes de placement', () => {
  it("annonce l'échéance d'un placement dans les 30 jours", () => {
    const d = donnees({
      comptes: [
        compte('courant'),
        compte('dat', { nature: 'placement', disponible: false, date_echeance: '2026-12-01' }),
        compte('long', { nature: 'placement', disponible: false, date_echeance: '2027-03-08' }),
      ],
    })
    expect(duSujet(d, 'placement').map((a) => a.id)).toEqual(['placement-dat'])
  })
})

describe('calculerAlertes', () => {
  it('range les critiques en premier, puis par date', () => {
    const d = donnees({
      comptes: [compte('courant', { solde_initial: 100 }), compte('dat', { nature: 'placement', date_echeance: '2026-11-12' })],
      recurrences: [rec({ id: 'box', libelle: 'Box', montant: -30, date_debut: '2026-10-15' }), rec({ montant: -200 })],
    })
    expect(calculerAlertes(d).map((a) => [a.niveau, a.date])).toEqual([
      ['critique', '2026-11-20'],
      ['info', '2026-11-12'],
      ['info', '2026-11-15'],
    ])
  })
})

describe('libelleCompte', () => {
  it('ajoute les titulaires pour distinguer deux comptes du même nom', () => {
    const membres = [
      { id: 's', nom: 'Sabrina', ordre: 0 },
      { id: 'm', nom: 'Mère', ordre: 1 },
    ]
    const joint = compte('joint', { nom: 'Compte joint', banque: 'CA' })
    const liens = [
      { compte_id: 'joint', membre_id: 's' },
      { compte_id: 'joint', membre_id: 'm' },
    ]
    expect(libelleCompte(joint, membres, liens)).toBe('Compte joint · CA (Sabrina et Mère)')
    expect(libelleCompte(joint, membres, [])).toBe('Compte joint · CA')
  })
})
