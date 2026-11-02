import type { ModePaiement, TypeTransaction } from '../types'
import { normaliserTexte } from './csv'
import type { OperationBancaire } from './types'

export interface Regle {
  id: string
  motif: string
  type: TypeTransaction
  categorie_id: string | null
  compte_cible_id: string | null
  priorite: number
}

export interface Classement {
  type: TypeTransaction
  categorieId: string | null
  compteCibleId: string | null
}

function texteRecherche(op: OperationBancaire): string {
  return normaliserTexte(`${op.typeBanque} ${op.libelle} ${op.detail}`)
}

// La règle la plus prioritaire l'emporte ; à priorité égale, le motif le plus précis (le plus long)
export function trouverRegle(op: OperationBancaire, regles: Regle[]): Regle | null {
  const texte = texteRecherche(op)
  const candidates = regles.filter((r) => {
    const motif = normaliserTexte(r.motif)
    return motif.length > 0 && texte.includes(motif)
  })
  candidates.sort((a, b) => b.priorite - a.priorite || b.motif.length - a.motif.length)
  return candidates[0] ?? null
}

export function classementDeRegle(regle: Regle): Classement {
  return { type: regle.type, categorieId: regle.categorie_id, compteCibleId: regle.compte_cible_id }
}

// Sans règle : un crédit est un revenu, un débit une dépense, tous deux à catégoriser
export function classementParDefaut(op: OperationBancaire): Classement {
  return { type: op.montant > 0 ? 'revenu' : 'depense_variable', categorieId: null, compteCibleId: null }
}

export function ressembleAUnVirement(op: OperationBancaire): boolean {
  return /\bVIR\b|VIREMENT/.test(texteRecherche(op)) || /VIREMENT INTERNE/.test(normaliserTexte(op.categorieBanque ?? ''))
}

export function modeDepuisBanque(typeBanque: string): ModePaiement | null {
  const t = normaliserTexte(typeBanque)
  if (t.includes('CARTE')) return 'carte'
  if (t.includes('PRELEVEMENT')) return 'prelevement'
  if (t.includes('INSTANTANE')) return 'virement_instantane'
  if (t.includes('VIREMENT') || t.startsWith('VIR')) return 'virement'
  if (t.includes('CHEQUE')) return 'cheque'
  if (t.includes('RETRAIT')) return 'especes'
  return null
}

// Propose un motif de règle à partir du libellé : le nom du commerçant ou de l'émetteur,
// sans numéro de carte, date ni référence. L'utilisatrice peut le modifier avant de l'enregistrer.
export function suggererMotif(op: OperationBancaire): string {
  const detail = op.libelle.includes(' · ') ? op.libelle.split(' · ').slice(1).join(' ') : op.libelle
  const nettoye = normaliserTexte(detail)
    .replace(/^X\d{4}\s+/, '') // numéro de carte masqué
    .replace(/^(CB|PRLV|VIR(\s+SEPA)?|VIR\.)\s+/, '')
    .replace(/\s+AU\s+\d{2}\/\d{2}.*$/, '') // date de paiement par carte
    .replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?\b.*$/, '')
    .split(' - ')[0]
    .replace(/\b\d{4,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return nettoye || normaliserTexte(op.typeBanque)
}
