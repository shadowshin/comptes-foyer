import { CATEGORIES_PAR_DEFAUT } from '../domain/categoriesParDefaut'
import { LIBELLES_TYPE, type Categorie, type Compte } from '../domain/types'

// Un seul menu pour choisir une catégorie (le type en découle) ou un virement vers un compte.
// Encodage des valeurs : voir domain/import/valeurClassement.ts

interface Props {
  valeur: string
  categories: Categorie[]
  comptes: Compte[]
  // compte de l'opération, exclu des destinations de virement
  compteId?: string | null
  libelleVide?: string
  onChange: (valeur: string) => void
  'aria-label'?: string
}

export function SelectClassement({ valeur, categories, comptes, compteId, libelleVide = 'À catégoriser', onChange, ...aria }: Props) {
  return (
    <select value={valeur} onChange={(e) => onChange(e.target.value)} aria-label={aria['aria-label']}>
      <option value="">{libelleVide}</option>
      {(Object.keys(CATEGORIES_PAR_DEFAUT) as Categorie['type'][]).map((type) => (
        <optgroup key={type} label={LIBELLES_TYPE[type]}>
          {categories
            .filter((c) => c.type === type && (!c.archivee || `cat:${c.id}` === valeur))
            .map((c) => (
              <option key={c.id} value={`cat:${c.id}`}>
                {c.nom}
              </option>
            ))}
        </optgroup>
      ))}
      <optgroup label="Virement interne vers…">
        {comptes
          .filter((c) => c.id !== compteId && (c.actif || `vir:${c.id}` === valeur))
          .map((c) => (
            <option key={c.id} value={`vir:${c.id}`}>
              {c.nom}
            </option>
          ))}
      </optgroup>
    </select>
  )
}
