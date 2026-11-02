import { useState, type FormEvent } from 'react'
import { versIso } from '../domain/dates'
import { LIBELLES_FREQUENCE, LIBELLES_MODE, lireMontant } from '../domain/libelles'
import { validerSaisie, type ErreursSaisie, type Saisie } from '../domain/saisie'
import { LIBELLES_TYPE, type Frequence, type ModePaiement, type TypeTransaction } from '../domain/types'
import type { Referentiel } from '../lib/donnees'

interface Props {
  referentiel: Referentiel
  initiale?: Saisie
  onEnregistrer: (saisie: Saisie) => Promise<void>
  onAnnuler?: () => void
}

function saisieVide(): Saisie {
  return {
    date: versIso(new Date()),
    libelle: '',
    type: 'depense_variable',
    montant: Number.NaN,
    compteId: '',
    compteCibleId: null,
    categorieId: null,
    modePaiement: 'carte',
    notes: '',
    recurrente: false,
    frequence: 'mensuelle',
  }
}

export function FormulaireTransaction({ referentiel, initiale, onEnregistrer, onAnnuler }: Props) {
  const edition = initiale !== undefined
  const [saisie, setSaisie] = useState<Saisie>(initiale ?? saisieVide())
  const [montantTexte, setMontantTexte] = useState(
    initiale ? String(initiale.montant).replace('.', ',') : '',
  )
  const [erreurs, setErreurs] = useState<ErreursSaisie>({})
  const [envoi, setEnvoi] = useState(false)
  const [messageErreur, setMessageErreur] = useState<string | null>(null)

  const virement = saisie.type === 'virement_interne'
  // Les comptes et catégories archivés restent proposés s'ils sont déjà utilisés par l'opération modifiée
  const comptes = referentiel.comptes.filter(
    (c) => c.actif || c.id === initiale?.compteId || c.id === initiale?.compteCibleId,
  )
  const categories = referentiel.categories.filter(
    (c) => c.type === saisie.type && (!c.archivee || c.id === initiale?.categorieId),
  )

  const modifier = <K extends keyof Saisie>(champ: K, valeur: Saisie[K]) =>
    setSaisie((s) => ({ ...s, [champ]: valeur }))

  function changerType(type: TypeTransaction) {
    setSaisie((s) => ({
      ...s,
      type,
      // une catégorie appartient à un type : on la retire si elle ne correspond plus
      categorieId: referentiel.categories.some((c) => c.id === s.categorieId && c.type === type) ? s.categorieId : null,
      compteCibleId: type === 'virement_interne' ? s.compteCibleId : null,
      modePaiement: type === 'virement_interne' && s.modePaiement === 'carte' ? 'virement' : s.modePaiement,
    }))
  }

  async function envoyer(e: FormEvent) {
    e.preventDefault()
    const complete = { ...saisie, montant: lireMontant(montantTexte) }
    const trouvees = validerSaisie(complete)
    setErreurs(trouvees)
    if (Object.keys(trouvees).length > 0) return

    setEnvoi(true)
    setMessageErreur(null)
    try {
      await onEnregistrer(complete)
      if (!edition) {
        // On garde date, type et mode pour enchaîner les saisies ; compte et catégorie sont
        // vidés pour ne pas classer l'opération suivante par erreur
        setSaisie((s) => ({
          ...s,
          libelle: '',
          notes: '',
          compteId: '',
          compteCibleId: null,
          categorieId: null,
          recurrente: false,
        }))
        setMontantTexte('')
      }
    } catch (err) {
      setMessageErreur((err as Error).message)
    }
    setEnvoi(false)
  }

  const erreur = (champ: keyof Saisie) =>
    erreurs[champ] && (
      <span className="erreur-champ" id={`erreur-${champ}`}>
        {erreurs[champ]}
      </span>
    )
  const aria = (champ: keyof Saisie) =>
    erreurs[champ] ? { 'aria-invalid': true, 'aria-describedby': `erreur-${champ}` } : {}

  return (
    <form className="carte formulaire" onSubmit={envoyer} noValidate aria-label={edition ? 'Modifier la transaction' : 'Nouvelle transaction'}>
      <h2>{edition ? 'Modifier la transaction' : 'Nouvelle transaction'}</h2>
      <div className="grille-formulaire">
        <label>
          Date
          <input type="date" value={saisie.date} onChange={(e) => modifier('date', e.target.value)} {...aria('date')} />
          {erreur('date')}
        </label>

        <label className="large">
          Description
          <input
            type="text"
            value={saisie.libelle}
            maxLength={200}
            onChange={(e) => modifier('libelle', e.target.value)}
            {...aria('libelle')}
          />
          {erreur('libelle')}
        </label>

        <label>
          Type
          <select value={saisie.type} onChange={(e) => changerType(e.target.value as TypeTransaction)}>
            {Object.entries(LIBELLES_TYPE).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </label>

        <label>
          Montant (€)
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={montantTexte}
            onChange={(e) => setMontantTexte(e.target.value)}
            {...aria('montant')}
          />
          {erreur('montant')}
        </label>

        <label>
          {virement ? 'Compte de départ' : 'Compte'}
          <select value={saisie.compteId} onChange={(e) => modifier('compteId', e.target.value)} {...aria('compteId')}>
            <option value="">Choisir…</option>
            {comptes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
          {erreur('compteId')}
        </label>

        {virement ? (
          <label>
            Compte de destination
            <select
              value={saisie.compteCibleId ?? ''}
              onChange={(e) => modifier('compteCibleId', e.target.value || null)}
              {...aria('compteCibleId')}
            >
              <option value="">Choisir…</option>
              {comptes
                .filter((c) => c.id !== saisie.compteId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
            </select>
            {erreur('compteCibleId')}
          </label>
        ) : (
          <label>
            Catégorie
            <select
              value={saisie.categorieId ?? ''}
              onChange={(e) => modifier('categorieId', e.target.value || null)}
              {...aria('categorieId')}
            >
              <option value="">Choisir…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
            {erreur('categorieId')}
          </label>
        )}

        <label>
          Mode de paiement
          <select
            value={saisie.modePaiement ?? ''}
            onChange={(e) => modifier('modePaiement', (e.target.value || null) as ModePaiement | null)}
          >
            <option value="">Non précisé</option>
            {Object.entries(LIBELLES_MODE).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </label>

        {!edition && (
          <div className="champ-recurrence">
            <label className="interrupteur">
              <input
                type="checkbox"
                role="switch"
                checked={saisie.recurrente}
                onChange={(e) => modifier('recurrente', e.target.checked)}
              />
              Récurrente
            </label>
            {saisie.recurrente && (
              <label>
                Fréquence
                <select value={saisie.frequence} onChange={(e) => modifier('frequence', e.target.value as Frequence)}>
                  {Object.entries(LIBELLES_FREQUENCE).map(([valeur, libelle]) => (
                    <option key={valeur} value={valeur}>
                      {libelle}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        <label className="pleine-largeur">
          Notes
          <textarea rows={2} maxLength={1000} value={saisie.notes} onChange={(e) => modifier('notes', e.target.value)} />
        </label>
      </div>

      {messageErreur && (
        <p className="message-erreur" role="alert">
          {messageErreur}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="bouton-principal" disabled={envoi}>
          {envoi ? 'Enregistrement…' : edition ? 'Enregistrer les modifications' : 'Ajouter la transaction'}
        </button>
        {onAnnuler && (
          <button type="button" className="bouton-discret" onClick={onAnnuler}>
            Annuler
          </button>
        )}
      </div>
    </form>
  )
}
