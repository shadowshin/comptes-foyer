import { useState, type FormEvent } from 'react'
import { versIso } from '../domain/dates'
import { lireMontant } from '../domain/libelles'
import { formaterEuros } from '../domain/montants'
import { LIBELLES_NATURE, type Compte, type NatureCompte } from '../domain/types'
import { enregistrerCompte, supprimerCompte, type DonneesCompte, type Referentiel } from '../lib/donnees'

interface Props {
  referentiel: Referentiel
  onChange: () => Promise<void>
}

interface Brouillon {
  nom: string
  banque: string
  nature: NatureCompte
  disponible: boolean
  soldeInitial: string
  dateSoldeInitial: string
  plafond: string
  dateEcheance: string
  actif: boolean
  membreIds: string[]
}

function brouillonDepuis(compte: Compte | null, membreIds: string[]): Brouillon {
  return {
    nom: compte?.nom ?? '',
    banque: compte?.banque ?? '',
    nature: compte?.nature ?? 'courant',
    disponible: compte?.disponible ?? true,
    soldeInitial: compte ? String(compte.solde_initial).replace('.', ',') : '0',
    dateSoldeInitial: compte?.date_solde_initial ?? versIso(new Date()),
    plafond: compte?.plafond ? String(compte.plafond).replace('.', ',') : '',
    dateEcheance: compte?.date_echeance ?? '',
    actif: compte?.actif ?? true,
    membreIds,
  }
}

// Le solde initial peut être négatif (compte à découvert) : on lit le signe à part
function lireSolde(texte: string): number {
  const negatif = texte.trim().startsWith('-')
  const valeur = lireMontant(texte.trim().replace(/^-/, ''))
  return negatif ? -valeur : valeur
}

export function GestionComptes({ referentiel, onChange }: Props) {
  const [enEdition, setEnEdition] = useState<{ compte: Compte | null; brouillon: Brouillon } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const nomMembre = new Map(referentiel.membres.map((m) => [m.id, m.nom]))
  const titulaires = (compteId: string) =>
    referentiel.comptesMembres.filter((cm) => cm.compte_id === compteId).map((cm) => cm.membre_id)

  function ouvrir(compte: Compte | null) {
    setErreur(null)
    setEnEdition({ compte, brouillon: brouillonDepuis(compte, compte ? titulaires(compte.id) : []) })
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!enEdition) return
    const b = enEdition.brouillon
    const soldeInitial = lireSolde(b.soldeInitial)
    const plafond = b.plafond.trim() ? lireMontant(b.plafond) : null
    if (!b.nom.trim()) return setErreur('Nom du compte obligatoire.')
    if (!b.banque.trim()) return setErreur('Banque obligatoire.')
    if (b.membreIds.length === 0) return setErreur('Choisis au moins un titulaire.')
    if (!Number.isFinite(soldeInitial)) return setErreur('Solde initial invalide.')
    if (plafond !== null && !(plafond > 0)) return setErreur('Plafond invalide.')

    const donnees: DonneesCompte = {
      nom: b.nom.trim(),
      banque: b.banque.trim(),
      nature: b.nature,
      disponible: b.disponible,
      solde_initial: soldeInitial,
      date_solde_initial: b.dateSoldeInitial,
      plafond,
      date_echeance: b.dateEcheance || null,
      actif: b.actif,
      ordre: enEdition.compte?.ordre ?? referentiel.comptes.length,
    }
    try {
      await enregistrerCompte(donnees, b.membreIds, enEdition.compte?.id)
      setEnEdition(null)
      await onChange()
    } catch (err) {
      setErreur((err as Error).message)
    }
  }

  async function supprimer(compte: Compte) {
    if (!window.confirm(`Supprimer définitivement le compte « ${compte.nom} » ?`)) return
    setErreur(null)
    try {
      await supprimerCompte(compte.id)
      setEnEdition(null)
      await onChange()
    } catch (err) {
      setErreur((err as Error).message)
    }
  }

  const modifier = <K extends keyof Brouillon>(champ: K, valeur: Brouillon[K]) =>
    setEnEdition((e) => e && { ...e, brouillon: { ...e.brouillon, [champ]: valeur } })

  return (
    <section className="carte" aria-labelledby="titre-comptes">
      <h2 id="titre-comptes">Comptes</h2>
      {referentiel.comptes.length === 0 && <p className="secondaire">Aucun compte.</p>}
      <ul className="liste-simple">
        {referentiel.comptes.map((c) => (
          <li key={c.id} className={c.actif ? 'ligne-compte' : 'ligne-compte archive'}>
            <span>
              <strong>{c.nom}</strong>
              <span className="secondaire">
                {c.banque} · {LIBELLES_NATURE[c.nature]} · {titulaires(c.id).map((id) => nomMembre.get(id)).join(' et ')}
                {!c.disponible && ' · bloqué'} · solde initial {formaterEuros(c.solde_initial)}
                {!c.actif && ' · archivé'}
              </span>
            </span>
            <button type="button" className="bouton-discret" onClick={() => ouvrir(c)}>
              Modifier
            </button>
          </li>
        ))}
      </ul>

      {enEdition ? (
        <form className="formulaire sous-formulaire" onSubmit={enregistrer} aria-label="Compte">
          <h3>{enEdition.compte ? `Modifier ${enEdition.compte.nom}` : 'Nouveau compte'}</h3>
          <div className="grille-formulaire">
            <label className="large">
              Nom
              <input type="text" value={enEdition.brouillon.nom} onChange={(e) => modifier('nom', e.target.value)} />
            </label>
            <label>
              Banque
              <input
                type="text"
                list="banques-connues"
                value={enEdition.brouillon.banque}
                onChange={(e) => modifier('banque', e.target.value)}
              />
              <datalist id="banques-connues">
                <option value="Crédit Agricole" />
                <option value="Caisse d'Épargne" />
              </datalist>
            </label>
            <label>
              Nature
              <select
                value={enEdition.brouillon.nature}
                onChange={(e) => {
                  const nature = e.target.value as NatureCompte
                  modifier('nature', nature)
                  modifier('disponible', nature !== 'placement')
                }}
              >
                {Object.entries(LIBELLES_NATURE).map(([valeur, libelle]) => (
                  <option key={valeur} value={valeur}>
                    {libelle}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="pleine-largeur">
              <legend>Titulaires</legend>
              {referentiel.membres.length === 0 && <span className="secondaire">Ajoute d'abord les membres du foyer.</span>}
              {referentiel.membres.map((m) => (
                <label key={m.id} className="case">
                  <input
                    type="checkbox"
                    checked={enEdition.brouillon.membreIds.includes(m.id)}
                    onChange={(e) =>
                      modifier(
                        'membreIds',
                        e.target.checked
                          ? [...enEdition.brouillon.membreIds, m.id]
                          : enEdition.brouillon.membreIds.filter((id) => id !== m.id),
                      )
                    }
                  />
                  {m.nom}
                </label>
              ))}
            </fieldset>
            <label>
              Solde initial (€)
              <input
                type="text"
                inputMode="decimal"
                value={enEdition.brouillon.soldeInitial}
                onChange={(e) => modifier('soldeInitial', e.target.value)}
              />
            </label>
            <label>
              Solde à la date du
              <input
                type="date"
                value={enEdition.brouillon.dateSoldeInitial}
                onChange={(e) => modifier('dateSoldeInitial', e.target.value)}
              />
            </label>
            <label className="case">
              <input
                type="checkbox"
                checked={enEdition.brouillon.disponible}
                onChange={(e) => modifier('disponible', e.target.checked)}
              />
              Argent disponible à tout moment
            </label>
            {enEdition.brouillon.nature === 'livret' && (
              <label>
                Plafond (€)
                <input
                  type="text"
                  inputMode="decimal"
                  value={enEdition.brouillon.plafond}
                  onChange={(e) => modifier('plafond', e.target.value)}
                />
              </label>
            )}
            {enEdition.brouillon.nature === 'placement' && (
              <label>
                Date d'échéance
                <input
                  type="date"
                  value={enEdition.brouillon.dateEcheance}
                  onChange={(e) => modifier('dateEcheance', e.target.value)}
                />
              </label>
            )}
            {enEdition.compte && (
              <label className="case">
                <input type="checkbox" checked={enEdition.brouillon.actif} onChange={(e) => modifier('actif', e.target.checked)} />
                Compte actif (décocher pour l'archiver)
              </label>
            )}
          </div>
          <p className="secondaire">
            Le solde initial est celui du compte à la date indiquée : mets la date à laquelle tu as lu ce montant.
            Seules les opérations à partir de cette date s'ajoutent au solde (une opération du même jour déjà comprise
            dans le montant serait comptée deux fois : dans le doute, prends le lendemain).
          </p>
          {erreur && (
            <p className="message-erreur" role="alert">
              {erreur}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="bouton-principal">
              Enregistrer le compte
            </button>
            <button type="button" className="bouton-discret" onClick={() => setEnEdition(null)}>
              Annuler
            </button>
            {enEdition.compte && (
              <button
                type="button"
                className="bouton-danger pousser-droite"
                onClick={() => supprimer(enEdition.compte!)}
              >
                Supprimer le compte
              </button>
            )}
          </div>
        </form>
      ) : (
        <button type="button" className="bouton-principal" onClick={() => ouvrir(null)}>
          Ajouter un compte
        </button>
      )}
    </section>
  )
}
