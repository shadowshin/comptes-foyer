// Lecteur des exports CSV du Crédit Agricole.
//
// Un fichier contient plusieurs comptes. Chaque bloc commence par un en-tête :
//   TITULAIRE(S);;;
//   <Type de compte> carte n° ...;;;
//   Solde au JJ/MM/AAAA 1 234,56 €;;;
//   Liste des opérations du compte entre le ... et le ...;;;
//   Date;Libellé;Débit euros;Crédit euros
// puis une ligne par opération, avec un libellé sur plusieurs lignes entre
// guillemets : la première ligne donne la nature de l'opération, les suivantes
// le détail. Un bloc sans opération porte la mention « Aucune opération ».

import { lireCsv, lireDateFr, lireMontantBancaire } from './csv'
import type { BlocReleve, OperationBancaire } from './types'

const LIGNE_TYPE_COMPTE = /^(.+?)\s+carte n°/i
const LIGNE_SOLDE = /^Solde au (\d{2}\/\d{2}\/\d{4})\s+(.+?)\s*€?$/i

// Deux versions de l'en-tête existent : « Date;Libellé;… » (jusqu'à octobre 2026)
// et « Date d'opération;Libellé;…; » (depuis novembre 2026)
export function estReleveCA(texte: string): boolean {
  return /Date( d'op[ée]ration)?;Libell[ée];D[ée]bit euros;Cr[ée]dit euros/i.test(texte)
}

function reduireEspaces(texte: string): string {
  return texte.replace(/\s+/g, ' ').trim()
}

function lireOperation(champs: string[]): OperationBancaire | null {
  const date = lireDateFr(champs[0] ?? '')
  if (!date) return null
  const debit = lireMontantBancaire(champs[2] ?? '')
  const credit = lireMontantBancaire(champs[3] ?? '')
  const montant = debit !== null ? -Math.abs(debit) : credit
  if (montant === null || montant === 0) return null

  const lignes = (champs[1] ?? '')
    .split('\n')
    .map(reduireEspaces)
    .filter(Boolean)
  const typeBanque = lignes[0] ?? ''
  const details = lignes.slice(1)
  return {
    date,
    libelle: details.length > 0 ? `${typeBanque} · ${details[0]}` : typeBanque,
    detail: lignes.join(' | '),
    typeBanque,
    montant,
    categorieBanque: null,
  }
}

export function lireReleveCA(texte: string): BlocReleve[] {
  const lignes = lireCsv(texte)
  const blocs: BlocReleve[] = []
  let bloc: BlocReleve | null = null
  let titulaire = ''

  for (const champs of lignes) {
    const premier = reduireEspaces(champs[0] ?? '')
    if (!premier) continue

    const typeCompte = LIGNE_TYPE_COMPTE.exec(premier)
    if (typeCompte) {
      // la ligne précédente non vide était le titulaire. Le numéro après « carte n° »
      // n'existe pas dans les anciens exports : la clé repose sur titulaire + type de compte
      const nomCompte = reduireEspaces(typeCompte[1])
      bloc = {
        banque: 'CA',
        cleImport: `CA|${titulaire.toUpperCase()}|${nomCompte.toUpperCase()}`,
        titre: `${nomCompte} · ${titulaire}`,
        solde: null,
        operations: [],
      }
      blocs.push(bloc)
      continue
    }

    const solde = LIGNE_SOLDE.exec(premier)
    if (solde && bloc) {
      const date = lireDateFr(solde[1])
      const montant = lireMontantBancaire(solde[2])
      if (date && montant !== null) bloc.solde = { date, montant }
      continue
    }

    const operation = lireOperation(champs)
    if (operation) {
      bloc?.operations.push(operation)
      continue
    }

    // Toute autre ligne de texte libre peut être le titulaire du bloc suivant
    if (!/^(Téléchargement|Liste des opérations|Date\b|Aucune opération)/i.test(premier)) {
      titulaire = premier
    }
  }
  return blocs
}
