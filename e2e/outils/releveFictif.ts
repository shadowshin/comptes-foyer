// Relevé Caisse d'Épargne entièrement fictif, au format exact de l'export CSV.
// Généré à chaque test avec des dates récentes : des dates fixes finiraient par tomber
// avant le solde initial des comptes d'exemple, et l'import les écarterait.

export type OperationFictive = { ilYaJours: number; libelle: string; montant: number }

export const OPERATIONS_FICTIVES: OperationFictive[] = [
  { ilYaJours: 5, libelle: 'BOULANGERIE DEMO', montant: -4.2 },
  { ilYaJours: 3, libelle: 'PHARMACIE DEMO', montant: -12.5 },
  { ilYaJours: 2, libelle: 'REMBOURSEMENT DEMO', montant: 30 },
]

// Numéro de compte fictif : la Caisse d'Épargne le met dans le nom du fichier
const NUMERO = '12345678'

const dateFr = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

const montantCE = (m: number) => `${m < 0 ? '-' : '+'}${Math.abs(m).toFixed(2).replace('.', ',')}`

// Titre du compte tel que l'écran d'import l'affiche (4 derniers chiffres)
export const TITRE_COMPTE_FICTIF = `Compte n° …${NUMERO.slice(-4)}`

// Fichier prêt pour page.setInputFiles()
export function releveCEFictif(operations = OPERATIONS_FICTIVES) {
  const entete =
    'Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation'
  const lignes = operations.map(({ ilYaJours, libelle, montant }) => {
    const d = new Date()
    d.setDate(d.getDate() - ilYaJours)
    const debit = montant < 0 ? montantCE(montant) : ''
    const credit = montant > 0 ? montantCE(montant) : ''
    return `${dateFr(d)};${libelle};${libelle};;;Carte bancaire;;;${debit};${credit};${dateFr(d)};${dateFr(d)};0`
  })
  return {
    name: `${NUMERO}_01012026_31122026.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from([entete, ...lignes].join('\r\n'), 'utf-8'),
  }
}
