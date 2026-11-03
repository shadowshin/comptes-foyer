import { useMemo, useState, type FormEvent } from 'react'
import { CarteRepliable } from '../components/CarteRepliable'
import {
  budgetPropose,
  depensesParCategorie,
  moyennesMensuelles,
  suiviBudgets,
  TYPES_BUDGET,
  type LigneBudget,
} from '../domain/budgets'
import { ajouterMois, dateDuMois, depuisIso, finDuMois, versIso } from '../domain/dates'
import { formaterEuros, somme } from '../domain/montants'
import { comptesDuPerimetre } from '../domain/tresorerie'
import { LIBELLES_TYPE } from '../domain/types'
import {
  enregistrerBudget,
  lireBudgets,
  lireParametres,
  lireReferentiel,
  lireTransactions,
  supprimerBudget,
} from '../lib/donnees'
import { useChargement } from '../lib/useChargement'
import { useEtatSession } from '../lib/useEtatSession'

const MOIS_MOYENNE = 3

function BarreBudget({ ligne }: { ligne: LigneBudget }) {
  if (ligne.ratio === null) return <span className="secondaire">Pas de budget</span>
  const pct = Math.round(ligne.ratio * 100)
  return (
    <div
      className={`barre-budget etat-${ligne.etat}`}
      role="progressbar"
      aria-label={`Budget ${ligne.categorie.nom}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(pct, 100)}
      aria-valuetext={`${pct} % du budget`}
    >
      <span className="barre-budget-remplissage" style={{ width: `${Math.min(pct, 100)}%` }} />
      <span className="barre-budget-texte">{pct} %</span>
    </div>
  )
}

export function Budgets() {
  const referentiel = useChargement(lireReferentiel)
  const transactions = useChargement(lireTransactions)
  const budgets = useChargement(lireBudgets)
  const parametres = useChargement(lireParametres)
  const [membreId, setMembreId] = useEtatSession<string>('budgets.membre', '')
  const [decalageMois, setDecalageMois] = useState(0)
  const [aujourdhui] = useState(() => versIso(new Date()))
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // saisies pas encore enregistrées, par catégorie
  const [brouillons, setBrouillons] = useState<Record<string, string>>({})

  const vueFoyer = membreId === ''
  const debutMois = dateDuMois(ajouterMois(aujourdhui, decalageMois), 1)
  const finMois = [finDuMois(debutMois), aujourdhui].sort()[0]

  const calculs = useMemo(() => {
    if (!referentiel.donnee || !transactions.donnee || !budgets.donnee || !parametres.donnee) return null
    const ref = referentiel.donnee
    const comptes = comptesDuPerimetre(ref.comptes, ref.comptesMembres, 'tout', membreId || null)
    const depenses = depensesParCategorie(comptes, transactions.donnee, debutMois, finMois)
    // en vue membre, pas de budget à comparer : les budgets sont ceux du foyer
    const lignes = suiviBudgets(ref.categories, vueFoyer ? budgets.donnee : [], depenses, parametres.donnee.alerte_budget_pct)
    const { moyennes, nbMois } = moyennesMensuelles(comptes, transactions.donnee, aujourdhui, MOIS_MOYENNE)
    return { lignes, sansCategorie: depenses.get(null) ?? 0, moyennes, nbMois }
  }, [referentiel.donnee, transactions.donnee, budgets.donnee, parametres.donnee, membreId, vueFoyer, debutMois, finMois, aujourdhui])

  const erreur = referentiel.erreur ?? transactions.erreur ?? budgets.erreur ?? parametres.erreur
  if (erreur) return <p className="message-erreur">Impossible de charger les budgets : {erreur}</p>
  if (!calculs || !referentiel.donnee) return <p className="chargement">Chargement…</p>

  const { lignes, sansCategorie, moyennes, nbMois } = calculs
  const avecBudget = lignes.filter((l) => l.budget)
  const totalBudget = somme(avecBudget.map((l) => l.budget!.montant_mensuel))
  const totalBudgete = somme(avecBudget.map((l) => l.reel))
  const totalReel = somme([...lignes.map((l) => l.reel), sansCategorie])
  const nomMois = depuisIso(debutMois).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const propositions = lignes.flatMap((l) => {
    const montant = l.budget ? null : budgetPropose(moyennes.get(l.categorie.id) ?? 0)
    return montant ? [{ categorieId: l.categorie.id, montant }] : []
  })

  async function executer(action: () => Promise<void>, succes?: string) {
    setEnCours(true)
    setMessage(null)
    try {
      await action()
      if (succes) setMessage(succes)
    } catch (e) {
      setMessage(`Erreur : ${(e as Error).message}`)
    }
    await budgets.recharger()
    setEnCours(false)
  }

  // Montant saisi : null si invalide, 0 pour un champ vide (budget à supprimer)
  const lireMontant = (saisie: string) => {
    const montant = saisie.trim() === '' ? 0 : Math.round(Number(saisie.replace(',', '.')) * 100) / 100
    return Number.isNaN(montant) || montant < 0 ? null : montant
  }
  const modifiees = lignes.filter(
    (l) => l.categorie.id in brouillons && lireMontant(brouillons[l.categorie.id]) !== (l.budget?.montant_mensuel ?? 0),
  )
  const invalides = modifiees.filter((l) => lireMontant(brouillons[l.categorie.id]) === null)

  function enregistrerModifications(e: FormEvent) {
    e.preventDefault()
    if (modifiees.length === 0 || invalides.length > 0) return
    executer(async () => {
      for (const l of modifiees) {
        const montant = lireMontant(brouillons[l.categorie.id])!
        // un budget vidé ou à zéro est supprimé
        if (montant === 0) {
          if (l.budget) await supprimerBudget(l.budget.id)
        } else {
          await enregistrerBudget(l.categorie.id, montant, l.budget ?? undefined)
        }
      }
      setBrouillons({})
    }, `${modifiees.length} budget(s) enregistré(s).`)
  }

  function appliquerPropositions() {
    executer(async () => {
      for (const p of propositions) await enregistrerBudget(p.categorieId, p.montant)
    }, `${propositions.length} budget(s) créé(s) à partir de la moyenne. Ajuste-les si besoin.`)
  }

  return (
    <>
      <h1>Budgets</h1>

      <div className="filtres-ligne">
        <label>
          Membre
          <select value={membreId} onChange={(e) => setMembreId(e.target.value)}>
            <option value="">Foyer</option>
            {referentiel.donnee.membres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
        </label>
        <span className="actions mois">
          <button type="button" className="bouton-discret" aria-label="Mois précédent" onClick={() => setDecalageMois((d) => d - 1)}>
            ‹
          </button>
          <strong>{nomMois}</strong>
          <button
            type="button"
            className="bouton-discret"
            aria-label="Mois suivant"
            disabled={decalageMois >= 0}
            onClick={() => setDecalageMois((d) => d + 1)}
          >
            ›
          </button>
        </span>
      </div>

      <div className="kpis">
        {vueFoyer && (
          <>
            <div className="carte kpi">
              <span className="kpi-libelle">Total budgété</span>
              <span className="kpi-valeur">{formaterEuros(totalBudget)}</span>
              <span className="kpi-delta">{avecBudget.length} catégorie(s) avec un budget</span>
            </div>
            <div className="carte kpi">
              <span className="kpi-libelle">Dépensé sur ces catégories</span>
              <span className="kpi-valeur">{formaterEuros(totalBudgete)}</span>
              <span className={totalBudgete > totalBudget ? 'kpi-delta negatif' : 'kpi-delta'}>
                Reste {formaterEuros(somme([totalBudget, -totalBudgete]))}
              </span>
            </div>
          </>
        )}
        <div className="carte kpi">
          <span className="kpi-libelle">Toutes dépenses du mois</span>
          <span className="kpi-valeur">{formaterEuros(totalReel)}</span>
          <span className="kpi-delta">Fixes, variables et impôts, hors épargne et virements internes</span>
        </div>
      </div>

      {vueFoyer ? (
        <CarteRepliable id="budgets.proposer" titre="Proposer des budgets">
          {nbMois === 0 ? (
            <p className="secondaire">Pas encore de mois complet dans l'historique : la moyenne n'est pas disponible.</p>
          ) : (
            <>
              <p className="secondaire">
                Remplit chaque catégorie sans budget avec sa moyenne des {nbMois} dernier(s) mois complet(s), arrondie à la
                dizaine supérieure. Les budgets déjà saisis ne sont pas touchés.
              </p>
              <button
                type="button"
                className="bouton-principal"
                disabled={enCours || propositions.length === 0}
                onClick={appliquerPropositions}
              >
                {propositions.length === 0 ? 'Rien à proposer' : `Proposer ${propositions.length} budget(s)`}
              </button>
            </>
          )}
        </CarteRepliable>
      ) : (
        <p className="secondaire">
          Les budgets sont fixés pour le foyer. En vue membre, la page montre seulement ce qui a été dépensé sur ses
          comptes (le compte joint compte pour chacune).
        </p>
      )}
      {message && (
        <p className="message-statut" role="status">
          {message}
        </p>
      )}

      {TYPES_BUDGET.map((type) => {
        const duType = lignes.filter((l) => l.categorie.type === type)
        if (duType.length === 0) return null
        return (
          <CarteRepliable key={type} id={`budgets.${type}`} titre={LIBELLES_TYPE[type]}>
            <div className="defilement-tableau">
              <table className="tableau tableau-budgets">
                <thead>
                  <tr>
                    <th scope="col">Catégorie</th>
                    <th scope="col" className="droite">
                      Dépensé
                    </th>
                    {vueFoyer && (
                      <>
                        <th scope="col">Budget mensuel</th>
                        <th scope="col">Progression</th>
                      </>
                    )}
                    <th scope="col" className="droite">
                      Moyenne {nbMois || MOIS_MOYENNE} mois
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {duType.map((l) => (
                    <tr key={l.categorie.id} className={l.categorie.archivee ? 'archive' : undefined}>
                      <th scope="row">{l.categorie.nom}</th>
                      <td className="droite nowrap">{formaterEuros(l.reel)}</td>
                      {vueFoyer && (
                        <>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              form="form-budgets"
                              className={modifiees.includes(l) ? 'champ-budget modifie' : 'champ-budget'}
                              aria-label={`Budget mensuel ${l.categorie.nom}`}
                              aria-invalid={invalides.includes(l)}
                              placeholder="Aucun"
                              value={brouillons[l.categorie.id] ?? String(l.budget?.montant_mensuel ?? '')}
                              disabled={enCours}
                              onChange={(e) => setBrouillons((b) => ({ ...b, [l.categorie.id]: e.target.value }))}
                            />
                          </td>
                          <td className="cellule-barre">
                            <BarreBudget ligne={l} />
                          </td>
                        </>
                      )}
                      <td className="droite nowrap secondaire-cellule">
                        {nbMois > 0 ? formaterEuros(moyennes.get(l.categorie.id) ?? 0) : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CarteRepliable>
        )
      })}

      {vueFoyer && (
        <form id="form-budgets" className="barre-import barre-enregistrer" onSubmit={enregistrerModifications}>
          <p className={invalides.length > 0 ? 'message-erreur' : 'secondaire'}>
            {invalides.length > 0
              ? `Montant invalide : ${invalides.map((l) => l.categorie.nom).join(', ')}`
              : modifiees.length > 0
                ? `${modifiees.length} modification(s) non enregistrée(s). Un champ vidé supprime le budget.`
                : 'Aucune modification en attente.'}
          </p>
          <button type="button" className="bouton-discret" disabled={enCours || modifiees.length === 0} onClick={() => setBrouillons({})}>
            Annuler
          </button>
          <button type="submit" className="bouton-principal" disabled={enCours || modifiees.length === 0 || invalides.length > 0}>
            Enregistrer les budgets
          </button>
        </form>
      )}

      {sansCategorie !== 0 && (
        <section className="carte">
          <h2>Sans catégorie</h2>
          <p>
            {formaterEuros(sansCategorie)} de dépenses en {nomMois} n'ont pas de catégorie et échappent aux budgets. Classe-les
            dans Transactions.
          </p>
        </section>
      )}
    </>
  )
}
