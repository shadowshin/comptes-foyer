import { genererDonneesExemple } from '../domain/donneesExemple'
import { versIso } from '../domain/dates'
import type { Compte, CompteMembre, Membre } from '../domain/types'
import { supabase } from './supabase'

const TAILLE_LOT = 500

function verifier<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

async function insererParLots(table: string, lignes: object[]) {
  for (let i = 0; i < lignes.length; i += TAILLE_LOT) {
    const { error } = await supabase.from(table).insert(lignes.slice(i, i + TAILLE_LOT))
    if (error) throw new Error(`${table} : ${error.message}`)
  }
}

export interface CompteAvecSolde extends Compte {
  solde: number
  membres: string[]
}

export async function lireComptes(): Promise<CompteAvecSolde[]> {
  const [comptes, soldes, liens, membres] = await Promise.all([
    supabase.from('comptes').select('*').eq('actif', true).order('ordre').then(verifier<Compte[]>),
    supabase.from('soldes_comptes').select('compte_id, solde').then(verifier<{ compte_id: string; solde: number }[]>),
    supabase.from('comptes_membres').select('compte_id, membre_id').then(verifier<CompteMembre[]>),
    supabase.from('membres').select('*').order('ordre').then(verifier<Membre[]>),
  ])
  const soldeParCompte = new Map(soldes.map((s) => [s.compte_id, Number(s.solde)]))
  const nomParMembre = new Map(membres.map((m) => [m.id, m.nom]))
  return comptes.map((c) => ({
    ...c,
    solde_initial: Number(c.solde_initial),
    plafond: c.plafond === null ? null : Number(c.plafond),
    solde: soldeParCompte.get(c.id) ?? Number(c.solde_initial),
    membres: liens.filter((l) => l.compte_id === c.id).map((l) => nomParMembre.get(l.membre_id) ?? '?'),
  }))
}

export async function compterTransactions(): Promise<number> {
  const { count, error } = await supabase.from('transactions').select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function chargerDonneesExemple() {
  const d = genererDonneesExemple({ aujourdhui: versIso(new Date()) })
  await insererParLots('membres', d.membres)
  await insererParLots('comptes', d.comptes)
  await insererParLots('comptes_membres', d.comptesMembres)
  await insererParLots('categories', d.categories)
  await insererParLots('recurrences', d.recurrences)
  await insererParLots('transactions', d.transactions)
  await insererParLots('budgets', d.budgets)
}

// Supprime toutes les données de l'utilisatrice connectée (les règles RLS
// empêchent de toucher à celles d'un autre compte). Les paramètres sont conservés.
// La suppression des comptes et catégories entraîne celle des lignes qui en dépendent.
export async function viderDonnees() {
  for (const table of ['transactions', 'recurrences', 'regles_categorisation', 'budgets', 'comptes', 'categories', 'membres']) {
    const { error } = await supabase.from(table).delete().not('id', 'is', null)
    if (error) throw new Error(`${table} : ${error.message}`)
  }
}
