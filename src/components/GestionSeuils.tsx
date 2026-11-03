import { useState, type FormEvent } from 'react'
import { PARAMETRES_PAR_DEFAUT, type Parametres } from '../domain/types'
import { enregistrerParametres } from '../lib/donnees'
import { CarteRepliable } from './CarteRepliable'

interface Props {
  parametres: Parametres
  onChange: () => Promise<void>
}

// Bornes identiques aux contraintes de la table parametres ; les champs bornés
// (pourcentages, nombres de jours) sont des entiers en base
const CHAMPS: { cle: keyof Parametres; libelle: string; unite: string; min: number; max?: number }[] = [
  { cle: 'seuil_critique', libelle: 'Alerte critique si un compte courant passe sous', unite: '€', min: -100000 },
  { cle: 'seuil_avertissement', libelle: 'Avertissement si un compte courant passe sous (coussin)', unite: '€', min: -100000 },
  { cle: 'alerte_budget_pct', libelle: "Avertissement quand une catégorie atteint", unite: '% du budget', min: 1, max: 100 },
  { cle: 'baisse_revenus_pct', libelle: 'Avertissement si les revenus du mois baissent de', unite: '% sur la moyenne', min: 1, max: 100 },
  { cle: 'delai_echeance_jours', libelle: 'Annoncer une sortie récurrente', unite: 'jours avant', min: 1, max: 60 },
  { cle: 'delai_placement_jours', libelle: "Annoncer l'échéance d'un placement", unite: 'jours avant', min: 1, max: 365 },
]

export function GestionSeuils({ parametres, onChange }: Props) {
  const [valeurs, setValeurs] = useState<Record<keyof Parametres, string>>(
    () => Object.fromEntries(CHAMPS.map((c) => [c.cle, String(parametres[c.cle])])) as Record<keyof Parametres, string>,
  )
  const [message, setMessage] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const lues: Parametres = { ...PARAMETRES_PAR_DEFAUT }
  for (const c of CHAMPS) lues[c.cle] = Number(valeurs[c.cle].replace(',', '.'))
  const erreurs = CHAMPS.filter(
    (c) =>
      valeurs[c.cle].trim() === '' ||
      Number.isNaN(lues[c.cle]) ||
      lues[c.cle] < c.min ||
      (c.max !== undefined && (lues[c.cle] > c.max || !Number.isInteger(lues[c.cle]))),
  ).map((c) => c.cle)
  const coussinIncoherent = lues.seuil_avertissement < lues.seuil_critique

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (erreurs.length > 0 || coussinIncoherent) return
    setEnCours(true)
    setMessage(null)
    try {
      await enregistrerParametres(lues)
      await onChange()
      setMessage('Seuils enregistrés.')
    } catch (err) {
      setMessage(`Erreur : ${(err as Error).message}`)
    }
    setEnCours(false)
  }

  return (
    <CarteRepliable id="parametres.seuils" titre="Seuils d'alerte" ouverteParDefaut={false}>
      <form className="formulaire" onSubmit={enregistrer} noValidate>
        <div className="grille-formulaire">
          {CHAMPS.map((c) => (
            <label key={c.cle}>
              {c.libelle} ({c.unite})
              <input
                type="number"
                inputMode="decimal"
                min={c.min}
                max={c.max}
                value={valeurs[c.cle]}
                aria-invalid={erreurs.includes(c.cle)}
                onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.value }))}
              />
              {erreurs.includes(c.cle) && (
                <span className="erreur-champ">
                  {c.max === undefined ? 'Nombre attendu' : `Nombre entier entre ${c.min} et ${c.max}`}
                </span>
              )}
            </label>
          ))}
        </div>
        {coussinIncoherent && (
          <p className="message-erreur" role="alert">
            Le coussin d'avertissement doit être au moins égal au seuil critique.
          </p>
        )}
        <div className="actions">
          <button type="submit" className="bouton-principal" disabled={enCours || erreurs.length > 0 || coussinIncoherent}>
            Enregistrer les seuils
          </button>
          <button
            type="button"
            className="bouton-discret"
            onClick={() =>
              setValeurs(
                Object.fromEntries(CHAMPS.map((c) => [c.cle, String(PARAMETRES_PAR_DEFAUT[c.cle])])) as Record<keyof Parametres, string>,
              )
            }
          >
            Revenir aux valeurs de départ
          </button>
        </div>
        {message && (
          <p className="message-statut" role="status">
            {message}
          </p>
        )}
      </form>
      <p className="secondaire">Une catégorie au-delà de 100 % de son budget est toujours signalée, barre rouge.</p>
    </CarteRepliable>
  )
}
