export type Banque = 'CA' | 'CE'

// Une opération telle que lue dans le relevé, avant tout classement
export interface OperationBancaire {
  date: string
  // libellé court, affiché dans le tableau
  libelle: string
  // texte complet de la banque, utilisé pour les règles et l'empreinte
  detail: string
  // nature de l'opération selon la banque (« Paiement par carte », « Prélèvement »…)
  typeBanque: string
  // signé : négatif = débit, positif = crédit
  montant: number
  // catégorie proposée par la banque (Caisse d'Épargne uniquement)
  categorieBanque: string | null
}

// Un compte dans un relevé. Un fichier Crédit Agricole en contient plusieurs,
// un fichier Caisse d'Épargne un seul.
export interface BlocReleve {
  banque: Banque
  // clé stable pour rattacher le bloc au même compte d'un import à l'autre
  cleImport: string
  titre: string
  // solde indiqué par la banque, s'il figure dans le relevé
  solde: { date: string; montant: number } | null
  operations: OperationBancaire[]
}

export interface Releve {
  nomFichier: string
  banque: Banque
  blocs: BlocReleve[]
}
