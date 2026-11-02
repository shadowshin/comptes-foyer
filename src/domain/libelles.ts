import type { Frequence, ModePaiement } from './types'

export const LIBELLES_MODE: Record<ModePaiement, string> = {
  virement_instantane: 'Virement instantané',
  virement: 'Virement bancaire',
  carte: 'Carte',
  especes: 'Espèces',
  prelevement: 'Prélèvement',
  cheque: 'Chèque',
}

export const LIBELLES_FREQUENCE: Record<Frequence, string> = {
  quotidienne: 'Quotidienne',
  hebdomadaire: 'Hebdomadaire',
  mensuelle: 'Mensuelle',
  annuelle: 'Annuelle',
}

// Accepte « 1 234,56 », « 1234.56 » ou « 54,3 » ; renvoie NaN si la saisie n'est pas un nombre
export function lireMontant(texte: string): number {
  const nettoye = texte.replace(/[\s  €]/g, '').replace(',', '.')
  return /^\d+(\.\d+)?$/.test(nettoye) ? Number(nettoye) : Number.NaN
}
