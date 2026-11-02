import type { CompteMembre, Transaction, TypeTransaction } from './types'

export interface Filtres {
  type: TypeTransaction | ''
  categorieId: string
  compteId: string
  membreId: string
  du: string
  au: string
  recherche: string
}

export const FILTRES_VIDES: Filtres = {
  type: '',
  categorieId: '',
  compteId: '',
  membreId: '',
  du: '',
  au: '',
  recherche: '',
}

// Comparaison sans accents ni casse : « energie » trouve « Énergie »
function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function filtrerTransactions(
  transactions: Transaction[],
  f: Filtres,
  comptesMembres: CompteMembre[],
): Transaction[] {
  const comptesDuMembre = f.membreId
    ? new Set(comptesMembres.filter((cm) => cm.membre_id === f.membreId).map((cm) => cm.compte_id))
    : null
  const recherche = normaliser(f.recherche.trim())

  return transactions.filter(
    (t) =>
      (!f.type || t.type === f.type) &&
      (!f.categorieId || t.categorie_id === f.categorieId) &&
      (!f.compteId || t.compte_id === f.compteId) &&
      (!comptesDuMembre || comptesDuMembre.has(t.compte_id)) &&
      (!f.du || t.date_operation >= f.du) &&
      (!f.au || t.date_operation <= f.au) &&
      (!recherche || normaliser(`${t.libelle} ${t.notes ?? ''}`).includes(recherche)),
  )
}

// Plus récentes d'abord ; à date égale, ordre stable par libellé
export function trierParDateDecroissante(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort(
    (a, b) => b.date_operation.localeCompare(a.date_operation) || a.libelle.localeCompare(b.libelle, 'fr'),
  )
}
