import type { Categorie } from '../types'
import type { Classement } from './regles'

// Encodage d'un classement dans un menu déroulant :
// « cat:<id> » pour une catégorie, « vir:<compteId> » pour un virement interne, « » pour « à catégoriser »

export function valeurClassement(c: Classement | null): string {
  if (!c) return ''
  if (c.type === 'virement_interne') return c.compteCibleId ? `vir:${c.compteCibleId}` : ''
  return c.categorieId ? `cat:${c.categorieId}` : ''
}

export function classementDepuisValeur(valeur: string, categories: Categorie[]): Classement | null {
  if (valeur.startsWith('vir:')) return { type: 'virement_interne', categorieId: null, compteCibleId: valeur.slice(4) }
  const categorie = categories.find((c) => `cat:${c.id}` === valeur)
  return categorie ? { type: categorie.type, categorieId: categorie.id, compteCibleId: null } : null
}
