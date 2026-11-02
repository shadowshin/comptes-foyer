import type { Categorie } from './types'

// Catégories de départ, issues du cahier des charges. Personnalisables dans l'appli.
export const CATEGORIES_PAR_DEFAUT: Record<Categorie['type'], string[]> = {
  revenu: [
    'Salaire',
    'ARE France Travail',
    'Retraite',
    'Pension',
    'Remboursements',
    'Aides',
    "Intérêts d'épargne",
    'Divers',
  ],
  depense_fixe: [
    'Loyer ou crédit immo',
    'Énergie',
    'Eau',
    'Assurances',
    'Mutuelle',
    'Téléphone et internet',
    'Abonnements',
    'Crédits',
  ],
  depense_variable: [
    'Courses',
    'Carburant',
    'Entretien véhicule',
    'Santé',
    'Animaux',
    'Maison et bricolage',
    'Restaurants et sorties',
    'Loisirs',
    'Shopping',
    'Formation',
    'Cadeaux',
  ],
  epargne: ['Livret A', 'LEP', 'LDDS', 'Placement à terme'],
  impot: ['Impôt sur le revenu', 'Taxe foncière'],
}
