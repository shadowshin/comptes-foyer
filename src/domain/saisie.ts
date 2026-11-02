// Transforme une saisie du formulaire en opérations à enregistrer.
// L'utilisatrice saisit toujours un montant positif : le signe dépend du type
// (un revenu entre sur le compte, une dépense en sort) et, pour un virement
// interne, une sortie sur le compte source et une entrée sur le compte cible.

import type { Frequence, ModePaiement, Recurrence, Transaction, TypeTransaction } from './types'

export interface Saisie {
  date: string
  libelle: string
  type: TypeTransaction
  montant: number
  compteId: string
  compteCibleId: string | null
  categorieId: string | null
  modePaiement: ModePaiement | null
  notes: string
  recurrente: boolean
  frequence: Frequence
}

export type ErreursSaisie = Partial<Record<keyof Saisie, string>>

export function validerSaisie(s: Saisie): ErreursSaisie {
  const erreurs: ErreursSaisie = {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) erreurs.date = 'Date obligatoire.'
  if (!s.libelle.trim()) erreurs.libelle = 'Description obligatoire.'
  if (!Number.isFinite(s.montant) || s.montant <= 0) erreurs.montant = 'Montant supérieur à 0 obligatoire.'
  else if (Math.abs(s.montant * 100 - Math.round(s.montant * 100)) > 1e-6) erreurs.montant = 'Deux décimales au maximum.'
  if (!s.compteId) erreurs.compteId = 'Compte obligatoire.'
  if (s.type === 'virement_interne') {
    if (!s.compteCibleId) erreurs.compteCibleId = 'Compte de destination obligatoire.'
    else if (s.compteCibleId === s.compteId) erreurs.compteCibleId = 'Le compte de destination doit être différent.'
  } else if (!s.categorieId) {
    erreurs.categorieId = 'Catégorie obligatoire.'
  }
  return erreurs
}

export function signeDuType(type: TypeTransaction): 1 | -1 {
  return type === 'revenu' ? 1 : -1
}

export type NouvelleTransaction = Omit<Transaction, 'id'> & { id?: string }

export interface OperationsSaisies {
  transactions: NouvelleTransaction[]
  recurrence: Omit<Recurrence, 'id'> | null
}

export function construireOperations(s: Saisie, transfertId: string | null = null): OperationsSaisies {
  const montant = Math.round(s.montant * 100) / 100
  const commun = {
    date_operation: s.date,
    libelle: s.libelle.trim(),
    description: null,
    type: s.type,
    mode_paiement: s.modePaiement,
    notes: s.notes.trim() || null,
    recurrence_id: null,
    source: 'manuel' as const,
    empreinte_import: null,
  }

  const transactions: NouvelleTransaction[] =
    s.type === 'virement_interne'
      ? [
          { ...commun, compte_id: s.compteId, montant: -montant, categorie_id: null, transfert_id: transfertId },
          {
            ...commun,
            compte_id: s.compteCibleId!,
            montant,
            categorie_id: null,
            transfert_id: transfertId,
            mode_paiement: null,
          },
        ]
      : [
          {
            ...commun,
            compte_id: s.compteId,
            montant: signeDuType(s.type) * montant,
            categorie_id: s.categorieId,
            transfert_id: null,
          },
        ]

  const recurrence = s.recurrente
    ? {
        libelle: commun.libelle,
        compte_id: s.compteId,
        compte_cible_id: s.type === 'virement_interne' ? s.compteCibleId : null,
        type: s.type,
        categorie_id: s.type === 'virement_interne' ? null : s.categorieId,
        montant: s.type === 'virement_interne' ? -montant : signeDuType(s.type) * montant,
        mode_paiement: s.modePaiement,
        frequence: s.frequence,
        date_debut: s.date,
        date_fin: null,
        actif: true,
      }
    : null

  return { transactions, recurrence }
}

// Opération (ou paire de virement) existante → saisie, pour préremplir le formulaire de modification
export function saisieDepuisOperations(operations: Transaction[]): Saisie {
  const source = operations.find((o) => o.montant < 0) ?? operations[0]
  const cible = operations.length === 2 ? operations.find((o) => o !== source)! : null
  return {
    date: source.date_operation,
    libelle: source.libelle,
    type: source.type,
    montant: Math.abs(source.montant),
    compteId: source.compte_id,
    compteCibleId: cible?.compte_id ?? null,
    categorieId: source.categorie_id,
    modePaiement: source.mode_paiement,
    notes: source.notes ?? '',
    recurrente: false,
    frequence: 'mensuelle',
  }
}
