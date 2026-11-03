import { useState, type FormEvent } from 'react'
import { CarteRepliable } from './CarteRepliable'
import { ajouterJours, depuisIso, versIso } from '../domain/dates'
import { classementDepuisValeur, valeurClassement } from '../domain/import/valeurClassement'
import { LIBELLES_FREQUENCE, lireMontant } from '../domain/libelles'
import { formaterEuros } from '../domain/montants'
import { detecterRecurrences, occurrences, type SuggestionRecurrence } from '../domain/recurrences'
import { signeDuType } from '../domain/saisie'
import type { Frequence, Recurrence, Transaction } from '../domain/types'
import { enregistrerRecurrence, supprimerRecurrence, type DonneesRecurrence, type Referentiel } from '../lib/donnees'
import { SelectClassement } from './SelectClassement'

interface Props {
  referentiel: Referentiel
  recurrences: Recurrence[]
  transactions: Transaction[]
  onChange: () => Promise<void>
}

interface Brouillon {
  libelle: string
  compteId: string
  classement: string
  montant: string
  frequence: Frequence
  dateDebut: string
  dateFin: string
  actif: boolean
}

function brouillonDepuis(r: Recurrence | null): Brouillon {
  return {
    libelle: r?.libelle ?? '',
    compteId: r?.compte_id ?? '',
    classement: r
      ? valeurClassement({ type: r.type, categorieId: r.categorie_id, compteCibleId: r.compte_cible_id })
      : '',
    montant: r ? String(Math.abs(r.montant)).replace('.', ',') : '',
    frequence: r?.frequence ?? 'mensuelle',
    dateDebut: r?.date_debut ?? versIso(new Date()),
    dateFin: r?.date_fin ?? '',
    actif: r?.actif ?? true,
  }
}

export function GestionRecurrences({ referentiel, recurrences, transactions, onChange }: Props) {
  const [edition, setEdition] = useState<{ id: string | null; brouillon: Brouillon } | null>(null)
  const [ignorees, setIgnorees] = useState<string[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const nomCompte = new Map(referentiel.comptes.map((c) => [c.id, c.nom]))
  const nomCategorie = new Map(referentiel.categories.map((c) => [c.id, c.nom]))
  const [demain] = useState(() => ajouterJours(versIso(new Date()), 1))
  const prochaine = (r: Recurrence) => occurrences(r, demain, ajouterJours(demain, 400))[0]

  const cleSuggestion = (s: SuggestionRecurrence) => `${s.compte_id}|${s.libelle}`
  const suggestions = detecterRecurrences(transactions, recurrences).filter((s) => !ignorees.includes(cleSuggestion(s)))

  async function executer(action: () => Promise<void>) {
    setErreur(null)
    try {
      await action()
      await onChange()
    } catch (e) {
      setErreur((e as Error).message)
    }
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!edition) return
    const b = edition.brouillon
    const classement = classementDepuisValeur(b.classement, referentiel.categories)
    const montant = lireMontant(b.montant)
    if (!b.libelle.trim()) return setErreur('Libellé obligatoire.')
    if (!b.compteId) return setErreur('Compte obligatoire.')
    if (!classement) return setErreur('Choisis une catégorie ou un compte de destination.')
    if (!(montant > 0)) return setErreur('Montant supérieur à 0 obligatoire.')
    if (b.dateFin && b.dateFin < b.dateDebut) return setErreur('La date de fin doit suivre la date de début.')

    const donnees: DonneesRecurrence = {
      libelle: b.libelle.trim(),
      compte_id: b.compteId,
      compte_cible_id: classement.compteCibleId,
      type: classement.type,
      categorie_id: classement.categorieId,
      montant: signeDuType(classement.type) * montant,
      mode_paiement: null,
      frequence: b.frequence,
      date_debut: b.dateDebut,
      date_fin: b.dateFin || null,
      actif: b.actif,
    }
    await executer(async () => {
      await enregistrerRecurrence(donnees, edition.id ?? undefined)
      setEdition(null)
    })
  }

  const modifier = <K extends keyof Brouillon>(champ: K, valeur: Brouillon[K]) =>
    setEdition((e) => e && { ...e, brouillon: { ...e.brouillon, [champ]: valeur } })

  const destination = (r: Pick<Recurrence, 'type' | 'compte_cible_id' | 'categorie_id'>) =>
    r.type === 'virement_interne'
      ? `→ ${nomCompte.get(r.compte_cible_id ?? '') ?? '?'}`
      : (nomCategorie.get(r.categorie_id ?? '') ?? 'sans catégorie')

  return (
    <CarteRepliable id="tresorerie.recurrences" titre="Récurrences prévues">
      <p className="secondaire">
        Ce sont elles qui alimentent la projection. Une récurrence ne crée aucune opération : les opérations réelles
        arrivent par l'import ou la saisie.
      </p>

      {suggestions.length > 0 && (
        <div className="suggestions">
          <h3>Repérées dans ton historique</h3>
          <ul className="liste-simple">
            {suggestions.map((s) => (
              <li key={cleSuggestion(s)} className="ligne-compte">
                <span>
                  <strong>{s.libelle}</strong>
                  <span className="secondaire">
                    {nomCompte.get(s.compte_id)} · {destination(s)} · {formaterEuros(s.montant)} chaque mois · vue le{' '}
                    {s.vues.map((d) => depuisIso(d).toLocaleDateString('fr-FR')).join(', ')}
                  </span>
                </span>
                <span className="actions">
                  <button
                    type="button"
                    className="bouton-principal"
                    onClick={() => {
                      const { vues: _vues, ...recurrence } = s
                      executer(() => enregistrerRecurrence({ ...recurrence, date_fin: null, actif: true }))
                    }}
                  >
                    Ajouter
                  </button>
                  <button
                    type="button"
                    className="bouton-discret"
                    onClick={() => setIgnorees((i) => [...i, cleSuggestion(s)])}
                  >
                    Ignorer
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="liste-simple">
        {recurrences.map((r) => (
          <li key={r.id} className={r.actif ? 'ligne-compte' : 'ligne-compte archive'}>
            <span>
              <strong>{r.libelle}</strong>
              <span className="secondaire">
                {nomCompte.get(r.compte_id)} · {destination(r)} · {formaterEuros(r.montant)} ·{' '}
                {LIBELLES_FREQUENCE[r.frequence].toLowerCase()}
                {r.actif && prochaine(r)
                  ? ` · prochaine le ${depuisIso(prochaine(r)!).toLocaleDateString('fr-FR')}`
                  : !r.actif
                    ? ' · en pause'
                    : ' · terminée'}
              </span>
            </span>
            <span className="actions">
              <button
                type="button"
                className="bouton-discret"
                onClick={() => {
                  setErreur(null)
                  setEdition({ id: r.id, brouillon: brouillonDepuis(r) })
                }}
              >
                Modifier
              </button>
              <button
                type="button"
                className="bouton-discret"
                onClick={() => {
                  if (window.confirm(`Supprimer la récurrence « ${r.libelle} » ?`)) executer(() => supprimerRecurrence(r.id))
                }}
              >
                Supprimer
              </button>
            </span>
          </li>
        ))}
        {recurrences.length === 0 && <li className="secondaire">Aucune récurrence : la projection reste plate.</li>}
      </ul>

      {edition ? (
        <form className="formulaire sous-formulaire" onSubmit={enregistrer} aria-label="Récurrence">
          <h3>{edition.id ? 'Modifier la récurrence' : 'Nouvelle récurrence'}</h3>
          <div className="grille-formulaire">
            <label className="large">
              Libellé
              <input type="text" value={edition.brouillon.libelle} onChange={(e) => modifier('libelle', e.target.value)} />
            </label>
            <label>
              Compte
              <select value={edition.brouillon.compteId} onChange={(e) => modifier('compteId', e.target.value)}>
                <option value="">Choisir…</option>
                {referentiel.comptes
                  .filter((c) => c.actif || c.id === edition.brouillon.compteId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Classement
              <SelectClassement
                valeur={edition.brouillon.classement}
                categories={referentiel.categories}
                comptes={referentiel.comptes}
                compteId={edition.brouillon.compteId}
                libelleVide="Choisir…"
                onChange={(v) => modifier('classement', v)}
              />
            </label>
            <label>
              Montant (€)
              <input
                type="text"
                inputMode="decimal"
                value={edition.brouillon.montant}
                onChange={(e) => modifier('montant', e.target.value)}
              />
            </label>
            <label>
              Fréquence
              <select
                value={edition.brouillon.frequence}
                onChange={(e) => modifier('frequence', e.target.value as Frequence)}
              >
                {Object.entries(LIBELLES_FREQUENCE).map(([valeur, libelle]) => (
                  <option key={valeur} value={valeur}>
                    {libelle}
                  </option>
                ))}
              </select>
            </label>
            <label>
              À partir du
              <input type="date" value={edition.brouillon.dateDebut} onChange={(e) => modifier('dateDebut', e.target.value)} />
            </label>
            <label>
              Jusqu'au (facultatif)
              <input type="date" value={edition.brouillon.dateFin} onChange={(e) => modifier('dateFin', e.target.value)} />
            </label>
            <label className="case">
              <input type="checkbox" checked={edition.brouillon.actif} onChange={(e) => modifier('actif', e.target.checked)} />
              Active
            </label>
          </div>
          <p className="secondaire">
            Le montant est saisi en positif : une dépense, un impôt ou un virement sort du compte, un revenu y entre.
          </p>
          {erreur && (
            <p className="message-erreur" role="alert">
              {erreur}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="bouton-principal">
              Enregistrer
            </button>
            <button type="button" className="bouton-discret" onClick={() => setEdition(null)}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <>
          {erreur && (
            <p className="message-erreur" role="alert">
              {erreur}
            </p>
          )}
          <button
            type="button"
            className="bouton-principal"
            onClick={() => {
              setErreur(null)
              setEdition({ id: null, brouillon: brouillonDepuis(null) })
            }}
          >
            Ajouter une récurrence
          </button>
        </>
      )}
    </CarteRepliable>
  )
}
