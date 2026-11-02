// Types du domaine, alignés sur le schéma SQL (supabase/migrations).
// Les montants sont signés du point de vue du compte : négatif = sortie.

export type TypeTransaction =
  | 'revenu'
  | 'depense_fixe'
  | 'depense_variable'
  | 'epargne'
  | 'impot'
  | 'virement_interne'

export type ModePaiement =
  | 'virement_instantane'
  | 'virement'
  | 'carte'
  | 'especes'
  | 'prelevement'
  | 'cheque'

export type Frequence = 'quotidienne' | 'hebdomadaire' | 'mensuelle' | 'annuelle'

export type NatureCompte = 'courant' | 'livret' | 'placement'

export type SourceTransaction = 'manuel' | 'recurrence' | 'import_ca' | 'import_ce' | 'exemple'

export interface Membre {
  id: string
  nom: string
  ordre: number
}

export interface Compte {
  id: string
  nom: string
  banque: string
  nature: NatureCompte
  disponible: boolean
  solde_initial: number
  date_solde_initial: string
  plafond: number | null
  date_echeance: string | null
  cle_import: string | null
  actif: boolean
  ordre: number
}

export interface CompteMembre {
  compte_id: string
  membre_id: string
}

export interface Categorie {
  id: string
  nom: string
  type: Exclude<TypeTransaction, 'virement_interne'>
  archivee: boolean
}

export interface Recurrence {
  id: string
  libelle: string
  compte_id: string
  compte_cible_id: string | null
  type: TypeTransaction
  categorie_id: string | null
  montant: number
  mode_paiement: ModePaiement | null
  frequence: Frequence
  date_debut: string
  date_fin: string | null
  actif: boolean
}

export interface Transaction {
  id: string
  compte_id: string
  date_operation: string
  libelle: string
  description: string | null
  type: TypeTransaction
  categorie_id: string | null
  montant: number
  mode_paiement: ModePaiement | null
  notes: string | null
  transfert_id: string | null
  recurrence_id: string | null
  source: SourceTransaction
  empreinte_import: string | null
}

export interface Budget {
  id: string
  categorie_id: string
  montant_mensuel: number
}

export const LIBELLES_TYPE: Record<TypeTransaction, string> = {
  revenu: 'Revenu',
  depense_fixe: 'Dépense fixe',
  depense_variable: 'Dépense variable',
  epargne: 'Épargne',
  impot: 'Impôt et taxe',
  virement_interne: 'Virement interne',
}

export const LIBELLES_NATURE: Record<NatureCompte, string> = {
  courant: 'Compte courant',
  livret: 'Livret',
  placement: 'Placement',
}
