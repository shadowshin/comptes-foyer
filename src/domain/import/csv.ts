// Outils de lecture communs aux relevés bancaires

// Découpe un CSV en lignes et champs. Gère les champs entre guillemets qui
// contiennent des retours à la ligne ou le séparateur, et les guillemets doublés.
export function lireCsv(texte: string, separateur = ';'): string[][] {
  const lignes: string[][] = []
  let ligne: string[] = []
  let champ = ''
  let entreGuillemets = false

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        champ += '"'
        i++
      } else if (c === '"') {
        entreGuillemets = false
      } else {
        champ += c
      }
    } else if (c === '"') {
      entreGuillemets = true
    } else if (c === separateur) {
      ligne.push(champ)
      champ = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++
      ligne.push(champ)
      lignes.push(ligne)
      ligne = []
      champ = ''
    } else {
      champ += c
    }
  }
  if (champ !== '' || ligne.length > 0) {
    ligne.push(champ)
    lignes.push(ligne)
  }
  return lignes
}

// « 15/10/2026 » → « 2026-10-15 », null si le texte n'est pas une date valide
export function lireDateFr(texte: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texte.trim())
  if (!m) return null
  const [, j, mo, a] = m
  const date = new Date(Number(a), Number(mo) - 1, Number(j))
  if (date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(j)) return null
  return `${a}-${mo}-${j}`
}

// « 1 234,56 », « -12,34 », « +99,99 », « 99 » → nombre ; null si vide ou invalide
export function lireMontantBancaire(texte: string): number | null {
  const nettoye = texte.replace(/[\s  €]/g, '').replace(',', '.')
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(nettoye)) return null
  return Math.round(Number(nettoye) * 100) / 100
}

// Majuscules, sans accents, espaces multiples réduits : pour comparer des libellés
export function normaliserTexte(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Les exports Crédit Agricole sont en Windows-1252, ceux de la Caisse d'Épargne en UTF-8
export function decoderFichier(octets: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(octets)
  }
}
