// Occurrences des récurrences et détection des récurrences dans l'historique

import { ajouterJours, ajouterMois } from './dates'
import { normaliserTexte } from './import/csv'
import type { Recurrence, Transaction } from './types'

// Dates d'une récurrence comprises entre du et au (inclus). Les mensuelles restent
// calées sur le jour de la date de début (le 31 devient le 30 ou le 28 selon le mois).
export function occurrences(r: Pick<Recurrence, 'frequence' | 'date_debut' | 'date_fin' | 'actif'>, du: string, au: string): string[] {
  if (!r.actif) return []
  const fin = r.date_fin && r.date_fin < au ? r.date_fin : au
  const dates: string[] = []
  const pas = (k: number) => {
    switch (r.frequence) {
      case 'quotidienne':
        return ajouterJours(r.date_debut, k)
      case 'hebdomadaire':
        return ajouterJours(r.date_debut, 7 * k)
      case 'mensuelle':
        return ajouterMois(r.date_debut, k)
      case 'annuelle':
        return ajouterMois(r.date_debut, 12 * k)
    }
  }
  for (let k = 0; ; k++) {
    const date = pas(k)
    if (date > fin) break
    if (date >= du) dates.push(date)
  }
  return dates
}

// Libellé réduit à ce qui identifie l'émetteur : sans chiffres, dates ni numéro de carte
export function cleLibelle(libelle: string): string {
  return normaliserTexte(libelle)
    .replace(/\bX\d{4}\b/g, '')
    .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, '')
    .replace(/\d+/g, '')
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Nom court proposé pour une récurrence créée depuis un libellé bancaire :
// « Prélèvement · FREE MOBILE - Free » → « FREE MOBILE »
export function nomCourt(libelle: string): string {
  const detail = libelle.includes(' · ') ? libelle.split(' · ').slice(1).join(' · ') : libelle
  return detail.split(' - ')[0].trim().slice(0, 60) || libelle.slice(0, 60)
}

// Récurrence déjà déclarée pour la même opération : même compte et même type,
// avec le même émetteur ou un montant à ± 15 %
export function recurrenceSemblable(
  existantes: Recurrence[],
  o: Pick<Transaction, 'compte_id' | 'type' | 'libelle' | 'montant'>,
): Recurrence | undefined {
  return existantes.find(
    (r) =>
      r.compte_id === o.compte_id &&
      r.type === o.type &&
      (cleLibelle(r.libelle) === cleLibelle(o.libelle) ||
        cleLibelle(r.libelle) === cleLibelle(nomCourt(o.libelle)) ||
        Math.abs(r.montant - o.montant) <= Math.abs(o.montant) * TOLERANCE_MONTANT),
  )
}

export interface SuggestionRecurrence {
  libelle: string
  compte_id: string
  compte_cible_id: string | null
  type: Recurrence['type']
  categorie_id: string | null
  montant: number
  mode_paiement: Recurrence['mode_paiement']
  frequence: 'mensuelle'
  date_debut: string
  // dates des opérations qui ont mené à la suggestion
  vues: string[]
}

const TOLERANCE_MONTANT = 0.15
const TOLERANCE_JOUR = 6

function mediane(valeurs: number[]): number {
  const triees = [...valeurs].sort((a, b) => a - b)
  const milieu = Math.floor(triees.length / 2)
  return triees.length % 2 ? triees[milieu] : (triees[milieu - 1] + triees[milieu]) / 2
}

// Repère les opérations mensuelles : même compte, même émetteur, au moins deux mois
// différents, montants proches (± 15 %) et jour du mois proche (± 6 jours).
// Pour un virement interne, on ne regarde que la sortie et on retient le compte d'arrivée.
export function detecterRecurrences(transactions: Transaction[], existantes: Recurrence[]): SuggestionRecurrence[] {
  const compteDeTransfert = new Map<string, string>()
  for (const t of transactions) if (t.transfert_id && t.montant > 0) compteDeTransfert.set(t.transfert_id, t.compte_id)

  const groupes = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (t.type === 'virement_interne' && t.montant > 0) continue
    const cle = [t.compte_id, t.type, cleLibelle(t.libelle)].join('|')
    groupes.set(cle, [...(groupes.get(cle) ?? []), t])
  }

  const suggestions: SuggestionRecurrence[] = []
  for (const operations of groupes.values()) {
    const mois = new Set(operations.map((o) => o.date_operation.slice(0, 7)))
    if (mois.size < 2) continue
    const montantType = mediane(operations.map((o) => o.montant))
    const jours = operations.map((o) => Number(o.date_operation.slice(8, 10)))
    const montantsProches = operations.every((o) => Math.abs(o.montant - montantType) <= Math.abs(montantType) * TOLERANCE_MONTANT)
    const joursProches = Math.max(...jours) - Math.min(...jours) <= TOLERANCE_JOUR
    if (!montantsProches || !joursProches) continue

    const derniere = [...operations].sort((a, b) => b.date_operation.localeCompare(a.date_operation))[0]
    const compteCible = derniere.transfert_id ? (compteDeTransfert.get(derniere.transfert_id) ?? null) : null
    if (derniere.type === 'virement_interne' && !compteCible) continue

    if (recurrenceSemblable(existantes, derniere)) continue

    suggestions.push({
      libelle: nomCourt(derniere.libelle),
      compte_id: derniere.compte_id,
      compte_cible_id: compteCible,
      type: derniere.type,
      categorie_id: derniere.categorie_id,
      montant: derniere.montant,
      mode_paiement: derniere.mode_paiement,
      frequence: 'mensuelle',
      date_debut: derniere.date_operation,
      vues: operations.map((o) => o.date_operation).sort(),
    })
  }
  return suggestions.sort((a, b) => a.montant - b.montant)
}
