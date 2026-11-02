// Lecteur des exports CSV de la Caisse d'Épargne.
//
// Un fichier par compte, nommé <numéro de compte>_<JJMMAAAA>_<JJMMAAAA>.csv.
// Première ligne = en-tête de colonnes, puis une opération par ligne.
// Pas de solde dans le fichier. Montants signés : débit « -12,34 », crédit « +12,34 ».

import { lireCsv, lireDateFr, lireMontantBancaire } from './csv'
import type { BlocReleve, OperationBancaire } from './types'

const COLONNES = {
  dateComptabilisation: 'Date de comptabilisation',
  libelleSimplifie: 'Libelle simplifie',
  libelleOperation: 'Libelle operation',
  informations: 'Informations complementaires',
  typeOperation: 'Type operation',
  categorie: 'Categorie',
  sousCategorie: 'Sous categorie',
  debit: 'Debit',
  credit: 'Credit',
  dateOperation: 'Date operation',
} as const

export function estReleveCE(texte: string): boolean {
  return /^﻿?Date de comptabilisation;Libelle simplifie;/i.test(texte)
}

export function numeroCompteCE(nomFichier: string): string | null {
  return /^(\d{8,})_\d{8}_\d{8}/.exec(nomFichier)?.[1] ?? null
}

export function lireReleveCE(texte: string, nomFichier: string): BlocReleve {
  const [entete, ...lignes] = lireCsv(texte.replace(/^﻿/, ''))
  const index = Object.fromEntries(
    Object.entries(COLONNES).map(([cle, nom]) => [cle, entete.findIndex((e) => e.trim() === nom)]),
  ) as Record<keyof typeof COLONNES, number>
  const champ = (ligne: string[], cle: keyof typeof COLONNES) => (index[cle] >= 0 ? (ligne[index[cle]] ?? '').trim() : '')

  const operations: OperationBancaire[] = []
  for (const ligne of lignes) {
    const date = lireDateFr(champ(ligne, 'dateOperation')) ?? lireDateFr(champ(ligne, 'dateComptabilisation'))
    const montant = lireMontantBancaire(champ(ligne, 'debit')) ?? lireMontantBancaire(champ(ligne, 'credit'))
    if (!date || montant === null || montant === 0) continue

    const libelleOperation = champ(ligne, 'libelleOperation')
    const informations = champ(ligne, 'informations')
    const categorie = [champ(ligne, 'categorie'), champ(ligne, 'sousCategorie')].filter(Boolean).join(' / ')
    operations.push({
      date,
      libelle: champ(ligne, 'libelleSimplifie') || libelleOperation,
      detail: [libelleOperation, informations].filter(Boolean).join(' | '),
      typeBanque: champ(ligne, 'typeOperation'),
      montant,
      categorieBanque: categorie || null,
    })
  }

  const numero = numeroCompteCE(nomFichier)
  return {
    banque: 'CE',
    // sans numéro dans le nom du fichier, on ne peut pas reconnaître le compte d'un import à l'autre
    cleImport: numero ? `CE|${numero}` : `CE|${nomFichier}`,
    titre: numero ? `Compte n° …${numero.slice(-4)}` : nomFichier,
    solde: null,
    operations,
  }
}
