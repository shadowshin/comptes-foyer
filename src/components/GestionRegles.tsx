import { useState, type FormEvent } from 'react'
import { classementDepuisValeur } from '../domain/import/valeurClassement'
import { creerRegle, lireRegles, supprimerRegle, type Referentiel } from '../lib/donnees'
import { useChargement } from '../lib/useChargement'
import { SelectClassement } from './SelectClassement'

interface Props {
  referentiel: Referentiel
}

export function GestionRegles({ referentiel }: Props) {
  const regles = useChargement(lireRegles)
  const [motif, setMotif] = useState('')
  const [valeur, setValeur] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const nomCompte = new Map(referentiel.comptes.map((c) => [c.id, c.nom]))
  const nomCategorie = new Map(referentiel.categories.map((c) => [c.id, c.nom]))

  async function executer(action: () => Promise<void>) {
    setErreur(null)
    try {
      await action()
      await regles.recharger()
    } catch (e) {
      setErreur((e as Error).message)
    }
  }

  function ajouter(e: FormEvent) {
    e.preventDefault()
    const classement = classementDepuisValeur(valeur, referentiel.categories)
    if (!motif.trim()) return setErreur('Indique le texte à rechercher dans le libellé.')
    if (!classement) return setErreur('Choisis une catégorie ou un compte de destination.')
    executer(async () => {
      await creerRegle({
        motif,
        type: classement.type,
        categorie_id: classement.categorieId,
        compte_cible_id: classement.compteCibleId,
        priorite: 0,
      })
      setMotif('')
      setValeur('')
    })
  }

  return (
    <section className="carte" aria-labelledby="titre-regles">
      <h2 id="titre-regles">Règles d'import</h2>
      <p className="secondaire">
        À l'import, une opération dont le libellé contient le texte indiqué (sans tenir compte des majuscules ni des
        accents) est classée automatiquement. Un virement vers un placement jamais importé crée aussi l'entrée sur ce
        placement.
      </p>
      {regles.erreur && <p className="message-erreur">{regles.erreur}</p>}
      <ul className="liste-simple">
        {regles.donnee?.map((r) => (
          <li key={r.id} className="ligne-compte">
            <span>
              « <strong>{r.motif}</strong> » →{' '}
              {r.type === 'virement_interne'
                ? `virement vers ${nomCompte.get(r.compte_cible_id ?? '') ?? '?'}`
                : (nomCategorie.get(r.categorie_id ?? '') ?? '?')}
            </span>
            <button
              type="button"
              className="bouton-discret"
              onClick={() => {
                if (window.confirm(`Supprimer la règle « ${r.motif} » ?`)) executer(() => supprimerRegle(r.id))
              }}
            >
              Supprimer
            </button>
          </li>
        ))}
        {regles.donnee?.length === 0 && <li className="secondaire">Aucune règle pour l'instant.</li>}
      </ul>
      <form className="ligne-ajout" onSubmit={ajouter}>
        <input
          type="text"
          aria-label="Texte à rechercher"
          placeholder="Le libellé contient…"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
        />
        <SelectClassement
          aria-label="Classement de la règle"
          valeur={valeur}
          categories={referentiel.categories}
          comptes={referentiel.comptes}
          libelleVide="Classer en…"
          onChange={setValeur}
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
