// Soldes, flux et projection de trésorerie, sur un ensemble de comptes choisi
// (périmètre). Les virements entre deux comptes du périmètre s'annulent d'eux-mêmes ;
// un virement vers un compte hors périmètre (épargne) compte comme une sortie.

import { ajouterJours, ajouterMois, dateDuMois } from './dates'
import { somme } from './montants'
import { occurrences } from './recurrences'
import type { Compte, CompteMembre, Recurrence, Transaction, TypeTransaction } from './types'

export type Perimetre = 'courants' | 'disponible' | 'tout'

export interface PointSolde {
  date: string
  solde: number
}

export interface FluxJour {
  date: string
  entrees: number
  sorties: number
  net: number
}

export function comptesDuPerimetre(
  comptes: Compte[],
  comptesMembres: CompteMembre[],
  perimetre: Perimetre,
  membreId: string | null,
): Compte[] {
  const duMembre = membreId
    ? new Set(comptesMembres.filter((cm) => cm.membre_id === membreId).map((cm) => cm.compte_id))
    : null
  return comptes.filter(
    (c) =>
      c.actif &&
      (!duMembre || duMembre.has(c.id)) &&
      (perimetre === 'tout' || (perimetre === 'disponible' ? c.disponible : c.nature === 'courant')),
  )
}

// Solde d'un compte en fin de journée. Le solde initial vaut au début du jour
// date_solde_initial : les opérations de ce jour et des suivants s'y ajoutent ;
// avant cette date, on remonte le temps en retranchant les opérations connues.
export function soldeFinDeJour(compte: Compte, transactions: Transaction[], date: string): number {
  const dsi = compte.date_solde_initial
  const montants = transactions
    .filter((t) => t.compte_id === compte.id)
    .flatMap((t) => {
      if (t.date_operation >= dsi && t.date_operation <= date) return [t.montant]
      if (date < dsi && t.date_operation > date && t.date_operation < dsi) return [-t.montant]
      return []
    })
  return somme([compte.solde_initial, ...montants])
}

// Solde total du périmètre pour chaque jour de la période
export function historiqueSoldes(comptes: Compte[], transactions: Transaction[], du: string, au: string): PointSolde[] {
  const ids = new Set(comptes.map((c) => c.id))
  const concernees = transactions.filter((t) => ids.has(t.compte_id))
  let solde = somme(comptes.map((c) => soldeFinDeJour(c, concernees, du)))
  const points: PointSolde[] = [{ date: du, solde }]

  // Passage d'un jour au suivant : on ajoute les opérations du jour qui comptent
  // dans le solde (pour chaque compte, à partir de sa date de solde initial, ou bien
  // avant elle puisque le solde remonté les retranchait)
  const parDate = Map.groupBy(concernees, (t) => t.date_operation)
  for (let date = ajouterJours(du, 1); date <= au; date = ajouterJours(date, 1)) {
    solde = somme([solde, ...(parDate.get(date) ?? []).map((t) => t.montant)])
    points.push({ date, solde })
  }
  return points
}

export function fluxQuotidiens(comptes: Compte[], transactions: Transaction[], du: string, au: string): FluxJour[] {
  const ids = new Set(comptes.map((c) => c.id))
  const parDate = Map.groupBy(
    transactions.filter((t) => ids.has(t.compte_id) && t.date_operation >= du && t.date_operation <= au),
    (t) => t.date_operation,
  )
  const flux: FluxJour[] = []
  for (let date = du; date <= au; date = ajouterJours(date, 1)) {
    const montants = (parDate.get(date) ?? []).map((t) => t.montant)
    const entrees = somme(montants.filter((m) => m > 0))
    const sorties = somme(montants.filter((m) => m < 0))
    flux.push({ date, entrees, sorties, net: somme([entrees, sorties]) })
  }
  return flux
}

// Effet d'une récurrence sur le périmètre, à chaque occurrence
function effetRecurrence(r: Recurrence, ids: Set<string>): number {
  if (r.type === 'virement_interne') {
    const sortie = ids.has(r.compte_id) ? r.montant : 0
    const entree = r.compte_cible_id && ids.has(r.compte_cible_id) ? -r.montant : 0
    return somme([sortie, entree])
  }
  return ids.has(r.compte_id) ? r.montant : 0
}

// Dépense variable moyenne par jour sur la période (valeur positive). Les récurrences
// ne couvrent pas les courses, le carburant, etc. : sans cette estimation, la projection
// resterait plate entre deux échéances et serait trop optimiste.
export function depenseCouranteQuotidienne(comptes: Compte[], transactions: Transaction[], du: string, au: string): number {
  const ids = new Set(comptes.map((c) => c.id))
  let jours = 0
  for (let d = du; d <= au; d = ajouterJours(d, 1)) jours++
  const total = -somme(
    transactions
      .filter((t) => ids.has(t.compte_id) && t.type === 'depense_variable' && t.date_operation >= du && t.date_operation <= au)
      .map((t) => t.montant),
  )
  return jours > 0 ? Math.max(0, Math.round((total / jours) * 100) / 100) : 0
}

export interface EvenementProjete {
  date: string
  recurrence: Recurrence
  effet: number
}

// Projection : solde d'aujourd'hui, puis chaque occurrence future des récurrences
// (à partir de demain : ce qui est passé figure déjà dans les opérations importées),
// moins une dépense courante estimée chaque jour
export function projeter(
  comptes: Compte[],
  transactions: Transaction[],
  recurrences: Recurrence[],
  aujourdhui: string,
  jours: number,
  depenseQuotidienne = 0,
): { points: PointSolde[]; evenements: EvenementProjete[] } {
  const ids = new Set(comptes.map((c) => c.id))
  const fin = ajouterJours(aujourdhui, jours)
  const evenements = recurrences
    .flatMap((r) => {
      const effet = effetRecurrence(r, ids)
      return effet === 0 ? [] : occurrences(r, ajouterJours(aujourdhui, 1), fin).map((date) => ({ date, recurrence: r, effet }))
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const parDate = Map.groupBy(evenements, (e) => e.date)
  let solde = somme(comptes.map((c) => soldeFinDeJour(c, transactions, aujourdhui)))
  const points: PointSolde[] = [{ date: aujourdhui, solde }]
  for (let date = ajouterJours(aujourdhui, 1); date <= fin; date = ajouterJours(date, 1)) {
    solde = somme([solde, -depenseQuotidienne, ...(parDate.get(date) ?? []).map((e) => e.effet)])
    points.push({ date, solde })
  }
  return { points, evenements }
}

const TYPES_DEPENSE: TypeTransaction[] = ['depense_fixe', 'depense_variable', 'impot', 'epargne']

export interface IndicateursMois {
  soldeActuel: number
  revenus: number
  depenses: number
  revenusMoisPrecedent: number
  depensesMoisPrecedent: number
  soldeProjete30: number
}

// Revenus et dépenses d'une période, hors virements internes ; les dépenses sont
// rendues en valeur positive (un remboursement les diminue)
export function revenusEtDepenses(comptes: Compte[], transactions: Transaction[], du: string, au: string) {
  const ids = new Set(comptes.map((c) => c.id))
  const periode = transactions.filter((t) => ids.has(t.compte_id) && t.date_operation >= du && t.date_operation <= au)
  return {
    revenus: somme(periode.filter((t) => t.type === 'revenu').map((t) => t.montant)),
    depenses: 0 - somme(periode.filter((t) => TYPES_DEPENSE.includes(t.type)).map((t) => t.montant)),
  }
}

// Le mois précédent sert de repère en début de mois, quand le mois en cours est encore vide
export function indicateurs(
  comptes: Compte[],
  transactions: Transaction[],
  projection: PointSolde[],
  aujourdhui: string,
): IndicateursMois {
  const debutMois = dateDuMois(aujourdhui, 1)
  const moisEnCours = revenusEtDepenses(comptes, transactions, debutMois, aujourdhui)
  const precedent = revenusEtDepenses(comptes, transactions, ajouterMois(debutMois, -1), ajouterJours(debutMois, -1))
  return {
    soldeActuel: projection[0]?.solde ?? 0,
    ...moisEnCours,
    revenusMoisPrecedent: precedent.revenus,
    depensesMoisPrecedent: precedent.depenses,
    soldeProjete30: projection[Math.min(30, projection.length - 1)]?.solde ?? 0,
  }
}
