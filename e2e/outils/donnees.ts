// Remise à zéro de la base de test, directement par l'API Supabase (bien plus rapide
// que par l'interface). Le compte de test ne voit que ses propres lignes (RLS) : ces
// suppressions ne peuvent rien toucher d'autre.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { versIso } from '../../src/domain/dates'
import { genererDonneesExemple, type DonneesExemple } from '../../src/domain/donneesExemple'
import { environnement } from './environnement'

// Mêmes tables que viderDonnees() dans l'appli, dans un ordre qui respecte les dépendances
const TABLES = ['transactions', 'recurrences', 'regles_categorisation', 'budgets', 'comptes', 'categories', 'membres']

let client: SupabaseClient | null = null

async function connecter(): Promise<SupabaseClient> {
  if (client) return client
  client = createClient(environnement.url, environnement.cle, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email: environnement.email, password: environnement.motDePasse })
  if (error) throw new Error(`Connexion du compte de test impossible : ${error.message}`)
  return client
}

async function inserer(sb: SupabaseClient, table: string, lignes: object[]) {
  if (lignes.length === 0) return
  const { error } = await sb.from(table).insert(lignes)
  if (error) throw new Error(`${table} : ${error.message}`)
}

export async function viderBase() {
  const sb = await connecter()
  for (const table of TABLES) {
    const { error } = await sb.from(table).delete().not('id', 'is', null)
    if (error) throw new Error(`${table} : ${error.message}`)
  }
  // les seuils reviennent aux valeurs de départ
  const { error } = await sb.from('parametres').delete().not('owner_id', 'is', null)
  if (error) throw new Error(`parametres : ${error.message}`)
}

// Base vide puis données d'exemple (graine fixe : les mêmes à chaque fois pour une date donnée).
// Rend les données insérées, pour que les tests calculent leurs résultats attendus.
export async function chargerExemple(aujourdhui = versIso(new Date())): Promise<DonneesExemple> {
  await viderBase()
  const sb = await connecter()
  const d = genererDonneesExemple({ aujourdhui })
  await inserer(sb, 'membres', d.membres)
  await inserer(sb, 'comptes', d.comptes)
  await inserer(sb, 'comptes_membres', d.comptesMembres)
  await inserer(sb, 'categories', d.categories)
  await inserer(sb, 'recurrences', d.recurrences)
  await inserer(sb, 'transactions', d.transactions)
  await inserer(sb, 'budgets', d.budgets)
  return d
}
