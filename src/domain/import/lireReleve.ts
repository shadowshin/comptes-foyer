import { estReleveCA, lireReleveCA } from './lecteurCA'
import { estReleveCE, lireReleveCE } from './lecteurCE'
import type { Releve } from './types'

// Reconnaît la banque d'après le contenu du fichier, pas d'après son nom
export function lireReleve(nomFichier: string, texte: string): Releve {
  if (estReleveCA(texte)) return { nomFichier, banque: 'CA', blocs: lireReleveCA(texte) }
  if (estReleveCE(texte)) return { nomFichier, banque: 'CE', blocs: [lireReleveCE(texte, nomFichier)] }
  throw new Error(`${nomFichier} : format non reconnu (ni Crédit Agricole, ni Caisse d'Épargne).`)
}
