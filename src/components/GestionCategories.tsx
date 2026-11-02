import { useState, type FormEvent } from 'react'
import { CATEGORIES_PAR_DEFAUT } from '../domain/categoriesParDefaut'
import { LIBELLES_TYPE, type Categorie } from '../domain/types'
import { creerCategorie, modifierCategorie } from '../lib/donnees'

interface Props {
  categories: Categorie[]
  onChange: () => Promise<void>
}

const TYPES = Object.keys(CATEGORIES_PAR_DEFAUT) as Categorie['type'][]

export function GestionCategories({ categories, onChange }: Props) {
  const [nouvelles, setNouvelles] = useState<Partial<Record<Categorie['type'], string>>>({})
  const [erreur, setErreur] = useState<string | null>(null)

  async function executer(action: () => Promise<void>) {
    setErreur(null)
    try {
      await action()
      await onChange()
    } catch (e) {
      setErreur((e as Error).message)
    }
  }

  function ajouter(e: FormEvent, type: Categorie['type']) {
    e.preventDefault()
    const nom = nouvelles[type]?.trim()
    if (!nom) return
    executer(async () => {
      await creerCategorie(nom, type)
      setNouvelles((n) => ({ ...n, [type]: '' }))
    })
  }

  async function installerParDefaut() {
    await executer(async () => {
      for (const type of TYPES) {
        for (const nom of CATEGORIES_PAR_DEFAUT[type]) {
          if (!categories.some((c) => c.type === type && c.nom === nom)) await creerCategorie(nom, type)
        }
      }
    })
  }

  return (
    <section className="carte" aria-labelledby="titre-categories">
      <h2 id="titre-categories">Catégories</h2>
      {categories.length === 0 && (
        <p>
          <button type="button" className="bouton-principal" onClick={installerParDefaut}>
            Installer les catégories de départ
          </button>
        </p>
      )}
      {erreur && (
        <p className="message-erreur" role="alert">
          {erreur}
        </p>
      )}
      <div className="grille-categories">
        {TYPES.map((type) => (
          <div key={type}>
            <h3>{LIBELLES_TYPE[type]}</h3>
            <ul className="liste-simple">
              {categories
                .filter((c) => c.type === type)
                .map((c) => (
                  <li key={c.id} className={c.archivee ? 'ligne-categorie archive' : 'ligne-categorie'}>
                    <input
                      type="text"
                      aria-label={`Nom de la catégorie ${c.nom}`}
                      defaultValue={c.nom}
                      onBlur={(e) => {
                        const nom = e.target.value.trim()
                        if (nom && nom !== c.nom) executer(() => modifierCategorie(c.id, { nom }))
                      }}
                    />
                    <button
                      type="button"
                      className="bouton-discret"
                      onClick={() => executer(() => modifierCategorie(c.id, { archivee: !c.archivee }))}
                    >
                      {c.archivee ? 'Restaurer' : 'Archiver'}
                    </button>
                  </li>
                ))}
            </ul>
            <form className="ligne-ajout" onSubmit={(e) => ajouter(e, type)}>
              <input
                type="text"
                aria-label={`Nouvelle catégorie ${LIBELLES_TYPE[type]}`}
                placeholder="Nouvelle catégorie"
                value={nouvelles[type] ?? ''}
                onChange={(e) => setNouvelles((n) => ({ ...n, [type]: e.target.value }))}
              />
              <button type="submit" className="bouton-discret">
                Ajouter
              </button>
            </form>
          </div>
        ))}
      </div>
      <p className="secondaire">
        Une catégorie archivée n'est plus proposée à la saisie, mais reste affichée sur les anciennes opérations.
      </p>
    </section>
  )
}
