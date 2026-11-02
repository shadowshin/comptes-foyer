// Graduations « rondes » pour les axes des graphiques

export function graduations(min: number, max: number, nombre = 4): number[] {
  if (min === max) {
    const ecart = Math.abs(min) || 100
    return graduations(min - ecart, max + ecart, nombre)
  }
  const brut = (max - min) / nombre
  const puissance = 10 ** Math.floor(Math.log10(brut))
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut)!
  const debut = Math.floor(min / pas) * pas
  const fin = Math.ceil(max / pas) * pas
  const valeurs: number[] = []
  for (let v = debut; v <= fin + pas / 2; v += pas) valeurs.push(Math.round(v * 100) / 100)
  return valeurs
}

// 1 234 → « 1,2 k€ » au-delà de 1 000, sinon « 850 € »
export function euroCompact(valeur: number): string {
  if (Math.abs(valeur) >= 1000) {
    return `${(valeur / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`
  }
  return `${Math.round(valeur).toLocaleString('fr-FR')} €`
}
