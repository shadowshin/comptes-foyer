const RAYON = 4

// Barre arrondie du côté de la valeur, carrée sur la ligne du zéro
export function cheminBarre(x: number, largeur: number, yZero: number, yValeur: number): string {
  const h = Math.abs(yValeur - yZero)
  const r = Math.min(RAYON, h, largeur / 2)
  if (yValeur < yZero) {
    return `M${x},${yZero} V${yValeur + r} Q${x},${yValeur} ${x + r},${yValeur} H${x + largeur - r} Q${x + largeur},${yValeur} ${x + largeur},${yValeur + r} V${yZero} Z`
  }
  return `M${x},${yZero} V${yValeur - r} Q${x},${yValeur} ${x + r},${yValeur} H${x + largeur - r} Q${x + largeur},${yValeur} ${x + largeur},${yValeur - r} V${yZero} Z`
}
