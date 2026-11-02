const FORMAT_EURO = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

export function formaterEuros(montant: number): string {
  return FORMAT_EURO.format(montant)
}

// Additionne en centimes pour éviter les erreurs d'arrondi des nombres flottants (0,1 + 0,2)
export function somme(montants: number[]): number {
  return montants.reduce((total, m) => total + Math.round(m * 100), 0) / 100
}
