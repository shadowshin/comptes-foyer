import { genererDonneesExemple } from '../domain/donneesExemple'
import { versIso } from '../domain/dates'
import type { LigneAInserer, MiseAJourVirement } from '../domain/import/preparation'
import type { Regle } from '../domain/import/regles'
import { construireOperations, type Saisie } from '../domain/saisie'
import type { Categorie, Compte, CompteMembre, Membre, Recurrence, Transaction } from '../domain/types'
import { supabase } from './supabase'

const TAILLE_LOT = 500
// PostgREST renvoie au plus 1 000 lignes par requête : on lit par pages
const TAILLE_PAGE = 1000

function verifier<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

function echouerSi(error: { message: string } | null, contexte: string) {
  if (error) throw new Error(`${contexte} : ${error.message}`)
}

async function insererParLots(table: string, lignes: object[]) {
  for (let i = 0; i < lignes.length; i += TAILLE_LOT) {
    const { error } = await supabase.from(table).insert(lignes.slice(i, i + TAILLE_LOT))
    echouerSi(error, table)
  }
}

// Postgres renvoie les colonnes numeric sous forme de texte ou de nombre selon les cas : on normalise
function normaliserCompte(c: Compte): Compte {
  return { ...c, solde_initial: Number(c.solde_initial), plafond: c.plafond === null ? null : Number(c.plafond) }
}

function normaliserTransaction(t: Transaction): Transaction {
  return { ...t, montant: Number(t.montant) }
}

// --- Référentiel : membres, comptes, titulaires, catégories ---

export interface Referentiel {
  membres: Membre[]
  comptes: Compte[]
  comptesMembres: CompteMembre[]
  categories: Categorie[]
}

export async function lireReferentiel(): Promise<Referentiel> {
  const [membres, comptes, comptesMembres, categories] = await Promise.all([
    supabase.from('membres').select('id, nom, ordre').order('ordre').then(verifier<Membre[]>),
    supabase.from('comptes').select('*').order('ordre').then(verifier<Compte[]>),
    supabase.from('comptes_membres').select('compte_id, membre_id').then(verifier<CompteMembre[]>),
    supabase.from('categories').select('id, nom, type, archivee').order('nom').then(verifier<Categorie[]>),
  ])
  return { membres, comptes: comptes.map(normaliserCompte), comptesMembres, categories }
}

export interface CompteAvecSolde extends Compte {
  solde: number
  membres: string[]
}

export async function lireComptes(): Promise<CompteAvecSolde[]> {
  const [{ comptes, comptesMembres, membres }, soldes] = await Promise.all([
    lireReferentiel(),
    supabase.from('soldes_comptes').select('compte_id, solde').then(verifier<{ compte_id: string; solde: number }[]>),
  ])
  const soldeParCompte = new Map(soldes.map((s) => [s.compte_id, Number(s.solde)]))
  const nomParMembre = new Map(membres.map((m) => [m.id, m.nom]))
  return comptes
    .filter((c) => c.actif)
    .map((c) => ({
      ...c,
      solde: soldeParCompte.get(c.id) ?? c.solde_initial,
      membres: comptesMembres.filter((l) => l.compte_id === c.id).map((l) => nomParMembre.get(l.membre_id) ?? '?'),
    }))
}

// --- Membres ---

export async function creerMembre(nom: string, ordre: number) {
  const { error } = await supabase.from('membres').insert({ nom: nom.trim(), ordre })
  echouerSi(error, 'Ajout du membre')
}

export async function renommerMembre(id: string, nom: string) {
  const { error } = await supabase.from('membres').update({ nom: nom.trim() }).eq('id', id)
  echouerSi(error, 'Modification du membre')
}

// Refusée si le membre est titulaire d'un compte : le compte resterait sans titulaire
export async function supprimerMembre(id: string) {
  const { count, error } = await supabase
    .from('comptes_membres')
    .select('compte_id', { count: 'exact', head: true })
    .eq('membre_id', id)
  echouerSi(error, 'Vérification du membre')
  if (count) {
    throw new Error(
      `Ce membre est titulaire de ${count} compte(s) : retire-le d'abord des titulaires (ou supprime ces comptes).`,
    )
  }
  const { error: errSuppression } = await supabase.from('membres').delete().eq('id', id)
  echouerSi(errSuppression, 'Suppression du membre')
}

// --- Comptes ---

export type DonneesCompte = Omit<Compte, 'id' | 'cle_import'>

export async function enregistrerCompte(compte: DonneesCompte, membreIds: string[], id?: string) {
  let compteId = id
  if (compteId) {
    const { error } = await supabase.from('comptes').update(compte).eq('id', compteId)
    echouerSi(error, 'Modification du compte')
    const { error: errSuppression } = await supabase.from('comptes_membres').delete().eq('compte_id', compteId)
    echouerSi(errSuppression, 'Mise à jour des titulaires')
  } else {
    const { data, error } = await supabase.from('comptes').insert(compte).select('id').single()
    echouerSi(error, 'Création du compte')
    compteId = (data as { id: string }).id
  }
  const { error } = await supabase
    .from('comptes_membres')
    .insert(membreIds.map((membre_id) => ({ compte_id: compteId, membre_id })))
  echouerSi(error, 'Enregistrement des titulaires')
}

export async function modifierSoldeInitial(compteId: string, soldeInitial: number) {
  const { error } = await supabase.from('comptes').update({ solde_initial: soldeInitial }).eq('id', compteId)
  echouerSi(error, 'Ajustement du solde initial')
}

// Suppression réservée aux comptes sans opération : la base supprimerait sinon
// tout leur historique en cascade. Pour un compte utilisé, on archive.
export async function supprimerCompte(id: string) {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('compte_id', id)
  echouerSi(error, 'Vérification du compte')
  if (count) {
    throw new Error(
      `Ce compte a ${count} opération(s) : il ne peut pas être supprimé. Décoche « Compte actif » pour l'archiver.`,
    )
  }
  const { error: errSuppression } = await supabase.from('comptes').delete().eq('id', id)
  echouerSi(errSuppression, 'Suppression du compte')
}

// --- Catégories ---

export async function creerCategorie(nom: string, type: Categorie['type']) {
  const { error } = await supabase.from('categories').insert({ nom: nom.trim(), type })
  if (error?.code === '23505') throw new Error('Cette catégorie existe déjà pour ce type.')
  echouerSi(error, 'Ajout de la catégorie')
}

export async function modifierCategorie(id: string, modifications: Partial<Pick<Categorie, 'nom' | 'archivee'>>) {
  const { error } = await supabase.from('categories').update(modifications).eq('id', id)
  if (error?.code === '23505') throw new Error('Cette catégorie existe déjà pour ce type.')
  echouerSi(error, 'Modification de la catégorie')
}

// --- Transactions ---

export async function lireTransactions(): Promise<Transaction[]> {
  const toutes: Transaction[] = []
  for (let debut = 0; ; debut += TAILLE_PAGE) {
    const page = await supabase
      .from('transactions')
      .select('*')
      .order('date_operation', { ascending: false })
      .order('id')
      .range(debut, debut + TAILLE_PAGE - 1)
      .then(verifier<Transaction[]>)
    toutes.push(...page.map(normaliserTransaction))
    if (page.length < TAILLE_PAGE) return toutes
  }
}

export async function compterTransactions(): Promise<number> {
  const { count, error } = await supabase.from('transactions').select('id', { count: 'exact', head: true })
  echouerSi(error, 'Comptage des transactions')
  return count ?? 0
}

export async function creerSaisie(saisie: Saisie) {
  const transfertId = saisie.type === 'virement_interne' ? crypto.randomUUID() : null
  const { transactions, recurrence } = construireOperations(saisie, transfertId)

  let recurrenceId: string | null = null
  if (recurrence) {
    const { data, error } = await supabase.from('recurrences').insert(recurrence).select('id').single()
    echouerSi(error, 'Création de la récurrence')
    recurrenceId = (data as { id: string }).id
  }

  const { error } = await supabase
    .from('transactions')
    .insert(transactions.map((t) => ({ ...t, recurrence_id: recurrenceId })))
  echouerSi(error, 'Enregistrement de la transaction')
}

// Modifie une opération (ou les deux opérations d'un virement) en conservant ce qui
// ne vient pas du formulaire : identifiants, origine, empreinte d'import, récurrence.
export async function modifierSaisie(anciennes: Transaction[], saisie: Saisie) {
  const transfertId =
    saisie.type === 'virement_interne' ? (anciennes.find((t) => t.transfert_id)?.transfert_id ?? crypto.randomUUID()) : null
  const { transactions } = construireOperations({ ...saisie, recurrente: false }, transfertId)

  // Associe chaque nouvelle opération à l'ancienne du même sens (sortie / entrée),
  // à défaut à n'importe quelle ancienne restante
  const restantes = [...anciennes]
  const lignes = transactions.map((nouvelle) => {
    const memeSens = restantes.findIndex((a) => Math.sign(a.montant) === Math.sign(nouvelle.montant))
    const index = memeSens >= 0 ? memeSens : restantes.length > 0 ? 0 : -1
    const ancienne = index >= 0 ? restantes.splice(index, 1)[0] : undefined
    return ancienne
      ? {
          ...nouvelle,
          id: ancienne.id,
          source: ancienne.source,
          empreinte_import: ancienne.empreinte_import,
          recurrence_id: ancienne.recurrence_id,
          description: ancienne.description,
        }
      : nouvelle
  })

  // defaultToNull: false pour qu'une nouvelle ligne sans id reçoive l'id généré par la base
  const { error } = await supabase.from('transactions').upsert(lignes, { defaultToNull: false })
  echouerSi(error, 'Modification de la transaction')
  if (restantes.length > 0) await supprimerTransactions(restantes.map((t) => t.id))
}

export async function supprimerTransactions(ids: string[]) {
  const { error } = await supabase.from('transactions').delete().in('id', ids)
  echouerSi(error, 'Suppression')
}

// --- Récurrences ---

export async function lireRecurrences(): Promise<Recurrence[]> {
  const lignes = await supabase.from('recurrences').select('*').order('libelle').then(verifier<Recurrence[]>)
  return lignes.map((r) => ({ ...r, montant: Number(r.montant) }))
}

export type DonneesRecurrence = Omit<Recurrence, 'id'>

export async function enregistrerRecurrence(r: DonneesRecurrence, id?: string) {
  const { error } = id
    ? await supabase.from('recurrences').update(r).eq('id', id)
    : await supabase.from('recurrences').insert(r)
  echouerSi(error, 'Enregistrement de la récurrence')
}

// Les opérations déjà générées depuis cette récurrence restent (le lien est mis à vide)
export async function supprimerRecurrence(id: string) {
  const { error } = await supabase.from('recurrences').delete().eq('id', id)
  echouerSi(error, 'Suppression de la récurrence')
}

// --- Règles de catégorisation ---

export async function lireRegles(): Promise<Regle[]> {
  return supabase
    .from('regles_categorisation')
    .select('id, motif, type, categorie_id, compte_cible_id, priorite')
    .order('motif')
    .then(verifier<Regle[]>)
}

export async function creerRegle(regle: Omit<Regle, 'id'>) {
  const { error } = await supabase.from('regles_categorisation').insert({ ...regle, motif: regle.motif.trim() })
  echouerSi(error, 'Création de la règle')
}

export async function supprimerRegle(id: string) {
  const { error } = await supabase.from('regles_categorisation').delete().eq('id', id)
  echouerSi(error, 'Suppression de la règle')
}

// --- Import de relevés ---

export interface DonneesImport {
  insertions: LigneAInserer[]
  misesAJour: MiseAJourVirement[]
  // cleImport → compte, mémorisé pour reconnaître le bloc aux imports suivants
  rattachements: Record<string, string>
  nouvellesRegles: Omit<Regle, 'id'>[]
}

export async function importerReleves(d: DonneesImport) {
  for (const [cleImport, compteId] of Object.entries(d.rattachements)) {
    // une clé ne désigne qu'un compte : on la retire d'un éventuel ancien rattachement
    const { error: errAncien } = await supabase
      .from('comptes')
      .update({ cle_import: null })
      .eq('cle_import', cleImport)
      .neq('id', compteId)
    echouerSi(errAncien, 'Rattachement des comptes')
    const { error } = await supabase.from('comptes').update({ cle_import: cleImport }).eq('id', compteId)
    echouerSi(error, 'Rattachement des comptes')
  }
  if (d.nouvellesRegles.length > 0) await insererParLots('regles_categorisation', d.nouvellesRegles)
  await insererParLots('transactions', d.insertions)
  for (const { id, ...modifications } of d.misesAJour) {
    const { error } = await supabase.from('transactions').update(modifications).eq('id', id)
    echouerSi(error, 'Liaison des virements')
  }
}

// --- Données d'exemple ---

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
    echouerSi(error, table)
  }
}
