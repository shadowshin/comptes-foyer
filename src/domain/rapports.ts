// Rapports : bilan d'un mois (revenus, dépenses, épargne nette), indicateurs
// (taux d'épargne, répartition des dépenses, reste à vivre), évolution par catégorie
// et mois de sécurité. Calculés sur un ensemble de comptes (foyer ou membre).

import { depensesParCategorie } from './budgets'
import { ajouterMois, dateDuMois } from './dates'
import { somme } from './montants'
import { soldeFinDeJour } from './tresorerie'
import type { Compte, Transaction } from './types'

export interface BilanMois {
  revenus: number
  // dépenses en valeur positive (un remboursement de même type les diminue)
  fixes: number
  variables: number
  impots: number
  depenses: number
  // vers les livrets et placements, moins ce qui en revient : négative quand on puise dans l'épargne
  epargneNette: number
}

export interface IndicateursBilan {
  // null quand il n'y a pas de revenu : un taux n'aurait pas de sens
  tauxEpargne: number | null
  partFixes: number | null
  partVariables: number | null
  partImpots: number | null
  // revenus moins les charges contraintes (dépenses fixes et impôts)
  resteAVivre: number
}

const estEpargne = (c: Compte) => c.nature !== 'courant'

export function bilanMois(comptes: Compte[], transactions: Transaction[], du: string, au: string): BilanMois {
  const parId = new Map(comptes.map((c) => [c.id, c]))
  const periode = transactions.filter((t) => parId.has(t.compte_id) && t.date_operation >= du && t.date_operation <= au)
  const total = (type: Transaction['type']) => 0 - somme(periode.filter((t) => t.type === type).map((t) => t.montant))
  const fixes = total('depense_fixe')
  const variables = total('depense_variable')
  const impots = total('impot')

  // Côté épargne, on lit les virements à l'arrivée (entrée positive, retrait négatif) :
  // un virement entre deux livrets s'annule. Une opération de type Épargne sur un compte
  // courant part vers une épargne non suivie dans l'appli.
  const epargneNette = somme(
    periode.flatMap((t) => {
      const compte = parId.get(t.compte_id)!
      if (t.type === 'virement_interne' && estEpargne(compte)) return [t.montant]
      if (t.type === 'epargne' && !estEpargne(compte)) return [-t.montant]
      return []
    }),
  )

  return {
    revenus: somme(periode.filter((t) => t.type === 'revenu').map((t) => t.montant)),
    fixes,
    variables,
    impots,
    depenses: somme([fixes, variables, impots]),
    epargneNette,
  }
}

// Moyenne de plusieurs mois, champ par champ
export function moyenneBilans(bilans: BilanMois[]): BilanMois | null {
  if (bilans.length === 0) return null
  const moyenne = (cle: keyof BilanMois) => Math.round((somme(bilans.map((b) => b[cle])) / bilans.length) * 100) / 100
  return {
    revenus: moyenne('revenus'),
    fixes: moyenne('fixes'),
    variables: moyenne('variables'),
    impots: moyenne('impots'),
    depenses: moyenne('depenses'),
    epargneNette: moyenne('epargneNette'),
  }
}

export function indicateursBilan(b: BilanMois): IndicateursBilan {
  const part = (montant: number) => (b.depenses > 0 ? montant / b.depenses : null)
  return {
    tauxEpargne: b.revenus > 0 ? b.epargneNette / b.revenus : null,
    partFixes: part(b.fixes),
    partVariables: part(b.variables),
    partImpots: part(b.impots),
    resteAVivre: somme([b.revenus, -b.fixes, -b.impots]),
  }
}

// Premiers jours des mois à afficher, du plus ancien au plus récent : jusqu'à n mois
// finissant par `dernier`, sans remonter avant le mois où commence l'historique
export function moisAffiches(dernier: string, n: number, debutHistorique: string): string[] {
  const premier = dateDuMois(debutHistorique, 1)
  const mois: string[] = []
  for (let k = n - 1; k >= 0; k--) {
    const debut = ajouterMois(dateDuMois(dernier, 1), -k)
    if (debut >= premier) mois.push(debut)
  }
  return mois
}

export interface LigneEvolution {
  // null : dépenses sans catégorie
  categorieId: string | null
  // un montant par mois, dans l'ordre des mois demandés
  montants: number[]
  total: number
}

// Dépenses de chaque catégorie, mois par mois, les plus grosses catégories en premier.
// `periodes` : [du, au] de chaque mois (le mois en cours s'arrête à aujourd'hui).
export function evolutionParCategorie(
  comptes: Compte[],
  transactions: Transaction[],
  periodes: [string, string][],
): LigneEvolution[] {
  const parMois = periodes.map(([du, au]) => depensesParCategorie(comptes, transactions, du, au))
  const cles = new Set(parMois.flatMap((m) => [...m.keys()]))
  return [...cles]
    .map((categorieId) => {
      const montants = parMois.map((m) => m.get(categorieId) ?? 0)
      return { categorieId, montants, total: somme(montants) }
    })
    .filter((l) => l.montants.some((m) => m !== 0))
    .sort((a, b) => b.total - a.total)
}

export interface Reserve {
  // livrets disponibles (Livret A, LEP, LDDS)
  disponible: number
  // dépôt à terme, contrat à terme : affichés à part
  bloquee: number
  // épargne disponible ÷ dépenses mensuelles moyennes
  mois: number | null
}

export function moisDeSecurite(comptes: Compte[], transactions: Transaction[], date: string, depensesMensuelles: number): Reserve {
  const solde = (liste: Compte[]) => somme(liste.map((c) => soldeFinDeJour(c, transactions, date)))
  const epargne = comptes.filter((c) => c.actif && estEpargne(c))
  const disponible = solde(epargne.filter((c) => c.disponible))
  return {
    disponible,
    bloquee: solde(epargne.filter((c) => !c.disponible)),
    mois: depensesMensuelles > 0 ? Math.round((disponible / depensesMensuelles) * 10) / 10 : null,
  }
}
