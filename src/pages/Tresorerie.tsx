import { useMemo, useState } from 'react'
import { CarteRepliable } from '../components/CarteRepliable'
import { GestionRecurrences } from '../components/GestionRecurrences'
import { GrapheFlux } from '../components/graphes/GrapheFlux'
import { GrapheSolde } from '../components/graphes/GrapheSolde'
import { ajouterJours, ajouterMois, dateDuMois, depuisIso, versIso } from '../domain/dates'
import { formaterEuros, somme } from '../domain/montants'
import {
  comptesDuPerimetre,
  depenseCouranteQuotidienne,
  fluxQuotidiens,
  historiqueSoldes,
  indicateurs,
  projeter,
  type Perimetre,
} from '../domain/tresorerie'
import { lireRecurrences, lireReferentiel, lireTransactions } from '../lib/donnees'
import { useChargement } from '../lib/useChargement'
import { useEtatSession } from '../lib/useEtatSession'

const HORIZON_JOURS = 90

const LIBELLES_PERIMETRE: Record<Perimetre, string> = {
  courants: 'Comptes courants',
  disponible: 'Courants et épargne disponible',
  tout: 'Tous les comptes',
}

export function Tresorerie() {
  const referentiel = useChargement(lireReferentiel)
  const transactions = useChargement(lireTransactions)
  const recurrences = useChargement(lireRecurrences)
  const [membreId, setMembreId] = useEtatSession<string>('tresorerie.membre', '')
  const [perimetre, setPerimetre] = useEtatSession<Perimetre>('tresorerie.perimetre', 'courants')
  const [avecDepensesCourantes, setAvecDepensesCourantes] = useEtatSession('tresorerie.depensesCourantes', true)
  const [decalageMois, setDecalageMois] = useState(0)
  // figée à l'ouverture de la page, pour que tous les calculs portent sur le même jour
  const [aujourdhui] = useState(() => versIso(new Date()))

  const calculs = useMemo(() => {
    if (!referentiel.donnee || !transactions.donnee || !recurrences.donnee) return null
    const comptes = comptesDuPerimetre(
      referentiel.donnee.comptes,
      referentiel.donnee.comptesMembres,
      perimetre,
      membreId || null,
    )
    // l'historique commence au plus tôt à la date du solde initial la plus ancienne
    const plusAncien = comptes.map((c) => c.date_solde_initial).sort()[0] ?? aujourdhui
    const debutHisto = [ajouterJours(aujourdhui, -HORIZON_JOURS), plusAncien].sort().at(-1)!
    const depenseEstimee = depenseCouranteQuotidienne(comptes, transactions.donnee, debutHisto, aujourdhui)
    const { points, evenements } = projeter(
      comptes,
      transactions.donnee,
      recurrences.donnee,
      aujourdhui,
      HORIZON_JOURS,
      avecDepensesCourantes ? depenseEstimee : 0,
    )
    return {
      comptes,
      depenseEstimee,
      debutHisto,
      projection: points,
      evenements,
      historique: historiqueSoldes(comptes, transactions.donnee, debutHisto, aujourdhui),
      kpi: indicateurs(comptes, transactions.donnee, points, aujourdhui),
    }
  }, [referentiel.donnee, transactions.donnee, recurrences.donnee, perimetre, membreId, aujourdhui, avecDepensesCourantes])

  const erreur = referentiel.erreur ?? transactions.erreur ?? recurrences.erreur
  if (erreur) return <p className="message-erreur">Impossible de calculer la trésorerie : {erreur}</p>
  if (!calculs || !referentiel.donnee || !transactions.donnee || !recurrences.donnee) {
    return <p className="chargement">Chargement…</p>
  }

  const { comptes, projection, evenements, historique, kpi, depenseEstimee, debutHisto } = calculs
  const debutMois = dateDuMois(ajouterMois(aujourdhui, decalageMois), 1)
  const finMois = [ajouterJours(ajouterMois(debutMois, 1), -1), aujourdhui].sort()[0]
  const flux = fluxQuotidiens(comptes, transactions.donnee, debutMois, finMois)
  const nomMois = depuisIso(debutMois).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const ecart30 = somme([kpi.soldeProjete30, -kpi.soldeActuel])
  const nomMoisPrecedent = depuisIso(ajouterMois(dateDuMois(aujourdhui, 1), -1)).toLocaleDateString('fr-FR', {
    month: 'long',
  })
  const prochaines = evenements.filter((e) => e.date <= ajouterJours(aujourdhui, 30))

  return (
    <>
      <h1>Trésorerie</h1>

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
        <label>
          Périmètre
          <select value={perimetre} onChange={(e) => setPerimetre(e.target.value as Perimetre)}>
            {Object.entries(LIBELLES_PERIMETRE).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
        <span className="secondaire">{comptes.length} compte(s) pris en compte</span>
      </div>

      <div className="kpis">
        <div className="carte kpi">
          <span className="kpi-libelle">Solde actuel</span>
          <span className="kpi-valeur">{formaterEuros(kpi.soldeActuel)}</span>
        </div>
        <div className="carte kpi">
          <span className="kpi-libelle">Revenus du mois</span>
          <span className="kpi-valeur">{formaterEuros(kpi.revenus)}</span>
          <span className="kpi-delta">
            {nomMoisPrecedent} : {formaterEuros(kpi.revenusMoisPrecedent)}
          </span>
        </div>
        <div className="carte kpi">
          <span className="kpi-libelle">Dépenses du mois</span>
          <span className="kpi-valeur">{formaterEuros(kpi.depenses)}</span>
          <span className="kpi-delta">
            {nomMoisPrecedent} : {formaterEuros(kpi.depensesMoisPrecedent)}
          </span>
        </div>
        <div className="carte kpi">
          <span className="kpi-libelle">Solde projeté à 30 jours</span>
          <span className="kpi-valeur">{formaterEuros(kpi.soldeProjete30)}</span>
          <span className={ecart30 < 0 ? 'kpi-delta negatif' : 'kpi-delta'}>
            {ecart30 >= 0 ? '+' : ''}
            {formaterEuros(ecart30)} par rapport à aujourd'hui
          </span>
        </div>
      </div>

      <CarteRepliable id="tresorerie.flux" titre={`Flux quotidiens · ${nomMois}`}>
        <div className="entete-carte">
          <p className="secondaire">Entrées moins sorties de chaque jour. Barre verte vers le haut : jour positif ; rouge vers le bas : jour négatif.</p>
          <span className="actions">
            <button type="button" className="bouton-discret" aria-label="Mois précédent" onClick={() => setDecalageMois((d) => d - 1)}>
              ‹
            </button>
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
        <GrapheFlux flux={flux} titre={`Flux quotidiens de ${nomMois}`} />
      </CarteRepliable>

      <CarteRepliable id="tresorerie.projection" titre={`Solde et projection à ${HORIZON_JOURS} jours`}>
        <label className="case case-seule">
          <input
            type="checkbox"
            checked={avecDepensesCourantes}
            onChange={(e) => setAvecDepensesCourantes(e.target.checked)}
          />
          Inclure les dépenses courantes estimées : {formaterEuros(depenseEstimee)} par jour (moyenne des dépenses
          variables depuis le {depuisIso(debutHisto).toLocaleDateString('fr-FR')})
        </label>
        <GrapheSolde titre="Solde passé et projeté" historique={historique} projection={projection} />
      </CarteRepliable>

      <CarteRepliable id="tresorerie.echeances" titre="Prochaines échéances (30 jours)">
        {prochaines.length === 0 ? (
          <p className="secondaire">Aucune récurrence prévue sur ce périmètre dans les 30 prochains jours.</p>
        ) : (
          <ul className="liste-simple">
            {prochaines.map((e) => (
              <li key={`${e.recurrence.id}-${e.date}`} className="ligne-compte">
                <span>
                  <strong>{e.recurrence.libelle}</strong>
                  <span className="secondaire">{depuisIso(e.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </span>
                <span className={e.effet < 0 ? 'montant negatif' : 'montant'}>{formaterEuros(e.effet)}</span>
              </li>
            ))}
          </ul>
        )}
      </CarteRepliable>

      <GestionRecurrences
        referentiel={referentiel.donnee}
        recurrences={recurrences.donnee}
        transactions={transactions.donnee}
        onChange={recurrences.recharger}
      />
    </>
  )
}
