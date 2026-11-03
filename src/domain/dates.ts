// Dates manipulées au format ISO 'AAAA-MM-JJ', sans fuseau horaire,
// pour éviter les décalages d'un jour liés à l'heure d'été.

export function versIso(date: Date): string {
  const a = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const j = String(date.getDate()).padStart(2, '0')
  return `${a}-${m}-${j}`
}

export function depuisIso(iso: string): Date {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(a, m - 1, j)
}

export function ajouterJours(iso: string, jours: number): string {
  const d = depuisIso(iso)
  d.setDate(d.getDate() + jours)
  return versIso(d)
}

// Ajoute des mois en restant sur le dernier jour du mois si besoin (31 janvier + 1 mois = 28 ou 29 février)
export function ajouterMois(iso: string, mois: number): string {
  const d = depuisIso(iso)
  const jour = d.getDate()
  const cible = new Date(d.getFullYear(), d.getMonth() + mois, 1)
  const dernierJour = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate()
  cible.setDate(Math.min(jour, dernierJour))
  return versIso(cible)
}

// Premiers jours des n mois qui précèdent celui de `date`, du plus récent au plus ancien,
// en ne gardant que les mois entièrement couverts par l'historique (commencés après `debutHistorique`)
export function moisCompletsAvant(date: string, n: number, debutHistorique: string): string[] {
  const debutMois = dateDuMois(date, 1)
  const mois: string[] = []
  for (let k = 1; k <= n; k++) {
    const debut = ajouterMois(debutMois, -k)
    if (debut < debutHistorique) break
    mois.push(debut)
  }
  return mois
}

export function finDuMois(iso: string): string {
  return ajouterJours(ajouterMois(dateDuMois(iso, 1), 1), -1)
}

export function dateDuMois(iso: string, jour: number): string {
  const d = depuisIso(iso)
  const dernierJour = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return versIso(new Date(d.getFullYear(), d.getMonth(), Math.min(jour, dernierJour)))
}
