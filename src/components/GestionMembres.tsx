import { useState, type FormEvent } from 'react'
import type { Membre } from '../domain/types'
import { creerMembre, renommerMembre, supprimerMembre } from '../lib/donnees'

interface Props {
  membres: Membre[]
  onChange: () => Promise<void>
}

export function GestionMembres({ membres, onChange }: Props) {
  const [nouveau, setNouveau] = useState('')
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

  function ajouter(e: FormEvent) {
    e.preventDefault()
    if (!nouveau.trim()) return
    executer(async () => {
      await creerMembre(nouveau, membres.length)
      setNouveau('')
    })
  }

  return (
    <section className="carte" aria-labelledby="titre-membres">
      <h2 id="titre-membres">Membres du foyer</h2>
      <ul className="liste-simple">
        {membres.map((m) => (
          <li key={m.id} className="ligne-categorie">
            <input
              type="text"
              aria-label={`Nom du membre ${m.nom}`}
              defaultValue={m.nom}
              onBlur={(e) => {
                const nom = e.target.value.trim()
                if (nom && nom !== m.nom) executer(() => renommerMembre(m.id, nom))
              }}
            />
            <button
              type="button"
              className="bouton-discret"
              onClick={() => {
                if (window.confirm(`Supprimer le membre « ${m.nom} » ?`)) executer(() => supprimerMembre(m.id))
              }}
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>
      <form className="ligne-ajout" onSubmit={ajouter}>
        <input
          type="text"
          aria-label="Nouveau membre"
          placeholder="Nouveau membre"
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
        />
        <button type="submit" className="bouton-principal">
          Ajouter
        </button>
      </form>
      {erreur && (
        <p className="message-erreur" role="alert">
          {erreur}
        </p>
      )}
    </section>
  )
}
