import { useMemo, useState } from 'react'
import { CarteRepliable } from '../components/CarteRepliable'
import { GrapheMensuel } from '../components/graphes/GrapheMensuel'
import { ajouterMois, dateDuMois, depuisIso, finDuMois, moisCompletsAvant, versIso } from '../domain/dates'
import { formaterEuros, somme } from '../domain/montants'
import {
  bilanMois,
  evolutionParCategorie,
  indicateursBilan,
  moisAffiches,
  moisDeSecurite,
  moyenneBilans,
  type BilanMois,
} from '../domain/rapports'
import { comptesDuPerimetre } from '../domain/tresorerie'
import { lireReferentiel, lireTransactions } from '../lib/donnees'
import { useChargement } from '../lib/useChargement'
import { useEtatSession } from '../lib/useEtatSession'

const NB_MOIS = 6

const pourcent = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)} %`)
const nomMois = (iso: string, format: 'long' | 'short' = 'long') =>
  depuisIso(iso).toLocaleDateString('fr-FR', format === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' })

// Écart d'un mois sur l'autre : flèche et signe en plus de la couleur
function Variation({ avant, apres }: { avant: number; apres: number }) {
  const ecart = somme([apres, -avant])
  if (ecart === 0) return <span className="secondaire-cellule">=</span>
  const pct = avant !== 0 ? ` (${ecart > 0 ? '+' : ''}${Math.round((ecart / avant) * 100)} %)` : ''
  return (
    <span className={ecart > 0 ? 'variation hausse' : 'variation baisse'}>
      <span aria-hidden="true">{ecart > 0 ? '▲' : '▼'}</span> {ecart > 0 ? '+' : ''}
      {formaterEuros(ecart)}
      {pct}
    </span>
  )
}

const LIGNES_REPARTITION: { cle: 'fixes' | 'variables' | 'impots'; part: 'partFixes' | 'partVariables' | 'partImpots'; libelle: string }[] = [
  { cle: 'fixes', part: 'partFixes', libelle: 'Dépenses fixes' },
  { cle: 'variables', part: 'partVariables', libelle: 'Dépenses variables' },
  { cle: 'impots', part: 'partImpots', libelle: 'Impôts et taxes' },
]

export function Rapports() {
  const referentiel = useChargement(lireReferentiel)
  const transactions = useChargement(lireTransactions)
  const [membreId, setMembreId] = useEtatSession<string>('rapports.membre', '')
  // par défaut le dernier mois complet
  const [decalageMois, setDecalageMois] = useState(-1)
  const [aujourdhui] = useState(() => versIso(new Date()))

  const calculs = useMemo(() => {
    if (!referentiel.donnee || !transactions.donnee) return null
    const ref = referentiel.donnee
    const comptes = comptesDuPerimetre(ref.comptes, ref.comptesMembres, 'tout', membreId || null)
    const ids = new Set(comptes.map((c) => c.id))
    const tx = transactions.donnee
    const debutHistorique = tx
      .filter((t) => ids.has(t.compte_id))
      .map((t) => t.date_operation)
      .sort()[0]
    if (!debutHistorique) return { vide: true as const }

    // le mois en cours s'arrête à aujourd'hui
    const periode = (debut: string): [string, string] => [debut, [finDuMois(debut), aujourdhui].sort()[0]]
    const bilanDe = (debut: string) => bilanMois(comptes, tx, ...periode(debut))
    const moisChoisi = dateDuMois(ajouterMois(aujourdhui, decalageMois), 1)
    const reference = moisCompletsAvant(aujourdhui, NB_MOIS, debutHistorique)
    const moyenne = moyenneBilans(reference.map(bilanDe))
    const mois = moisAffiches(moisChoisi, NB_MOIS, debutHistorique)

    return {
      vide: false as const,
      moisChoisi,
      premierMois: dateDuMois(debutHistorique, 1),
      bilan: bilanDe(moisChoisi),
      moyenne,
      nbMoisReference: reference.length,
      mois,
      bilans: mois.map(bilanDe),
      evolution: evolutionParCategorie(comptes, tx, mois.map(periode)),
      reserve: moisDeSecurite(comptes, tx, aujourdhui, moyenne?.depenses ?? 0),
    }
  }, [referentiel.donnee, transactions.donnee, membreId, decalageMois, aujourdhui])

  const erreur = referentiel.erreur ?? transactions.erreur
  if (erreur) return <p className="message-erreur">Impossible de calculer les rapports : {erreur}</p>
  if (!calculs || !referentiel.donnee) return <p className="chargement">Chargement…</p>

  const selecteurMembre = (
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
  )

  if (calculs.vide) {
    return (
      <>
        <h1>Rapports</h1>
        <div className="filtres-ligne">{selecteurMembre}</div>
        <section className="carte vide">
          <p>Aucune opération sur ces comptes pour l'instant : importe un relevé pour voir les rapports.</p>
        </section>
      </>
    )
  }

  const { moisChoisi, premierMois, bilan, moyenne, nbMoisReference, mois, bilans, evolution, reserve } = calculs
  const ind = indicateursBilan(bilan)
  const indMoyen = moyenne ? indicateursBilan(moyenne) : null
  const moisEnCours = dateDuMois(aujourdhui, 1)
  const libelleMois = (debut: string) => `${nomMois(debut, 'short')}${debut === moisEnCours ? ' (en cours)' : ''}`
  const nomCategorie = new Map(referentiel.donnee.categories.map((c) => [c.id, c.nom]))
  const libelleMoyenne = indMoyen ? `moyenne ${nbMoisReference} mois` : 'pas encore de mois complet pour la moyenne'

  const lignesMensuelles: { libelle: string; valeur: (b: BilanMois) => string }[] = [
    { libelle: 'Revenus', valeur: (b) => formaterEuros(b.revenus) },
    { libelle: 'Dépenses', valeur: (b) => formaterEuros(b.depenses) },
    { libelle: 'Épargne nette', valeur: (b) => formaterEuros(b.epargneNette) },
    { libelle: "Taux d'épargne", valeur: (b) => pourcent(indicateursBilan(b).tauxEpargne) },
    { libelle: 'Reste à vivre', valeur: (b) => formaterEuros(indicateursBilan(b).resteAVivre) },
  ]

  return (
    <>
      <h1>Rapports</h1>

      <div className="filtres-ligne">
        {selecteurMembre}
        <span className="actions mois">
          <button
            type="button"
            className="bouton-discret"
            aria-label="Mois précédent"
            disabled={moisChoisi <= premierMois}
            onClick={() => setDecalageMois((d) => d - 1)}
          >
            ‹
          </button>
          <strong>
            {nomMois(moisChoisi)}
            {moisChoisi === moisEnCours && ' (en cours)'}
          </strong>
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
        <div className="carte kpi">
          <span className="kpi-libelle">Taux d'épargne</span>
          <span className="kpi-valeur">{pourcent(ind.tauxEpargne)}</span>
          <span className={bilan.epargneNette < 0 ? 'kpi-delta negatif' : 'kpi-delta'}>
            Épargne nette {formaterEuros(bilan.epargneNette)}
          </span>
          <span className="kpi-delta">
            {indMoyen ? `${pourcent(indMoyen.tauxEpargne)} en ${libelleMoyenne}` : libelleMoyenne}
          </span>
        </div>
        <div className="carte kpi">
          <span className="kpi-libelle">Reste à vivre</span>
          <span className="kpi-valeur">{formaterEuros(ind.resteAVivre)}</span>
          <span className="kpi-delta">Revenus moins dépenses fixes et impôts</span>
          {indMoyen && (
            <span className="kpi-delta">
              {formaterEuros(indMoyen.resteAVivre)} en {libelleMoyenne}
            </span>
          )}
        </div>
        <div className="carte kpi">
          <span className="kpi-libelle">Dépenses du mois</span>
          <span className="kpi-valeur">{formaterEuros(bilan.depenses)}</span>
          <span className="kpi-delta">Revenus {formaterEuros(bilan.revenus)}</span>
          {moyenne && (
            <span className="kpi-delta">
              {formaterEuros(moyenne.depenses)} en {libelleMoyenne}
            </span>
          )}
        </div>
        <div className="carte kpi">
          <span className="kpi-libelle">Mois de sécurité (aujourd'hui)</span>
          <span className="kpi-valeur">{reserve.mois === null ? '–' : `${reserve.mois.toLocaleString('fr-FR')} mois`}</span>
          <span className="kpi-delta">Livrets disponibles {formaterEuros(reserve.disponible)}</span>
          <span className="kpi-delta">Épargne bloquée à part : {formaterEuros(reserve.bloquee)}</span>
        </div>
      </div>

      <CarteRepliable id="rapports.repartition" titre={`Répartition des dépenses · ${nomMois(moisChoisi)}`}>
        {bilan.depenses <= 0 ? (
          <p className="secondaire">Aucune dépense ce mois-ci.</p>
        ) : (
          <div className="defilement-tableau">
            <table className="tableau tableau-budgets">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col" className="droite">
                    Montant
                  </th>
                  <th scope="col">Part des dépenses</th>
                  <th scope="col" className="droite">
                    Part en {libelleMoyenne}
                  </th>
                </tr>
              </thead>
              <tbody>
                {LIGNES_REPARTITION.map(({ cle, part, libelle }) => (
                  <tr key={cle}>
                    <th scope="row">{libelle}</th>
                    <td className="droite nowrap">{formaterEuros(bilan[cle])}</td>
                    <td className="cellule-barre">
                      <div className="barre-budget" aria-hidden="true">
                        <span className="barre-budget-remplissage" style={{ width: `${Math.max(0, Math.round((ind[part] ?? 0) * 100))}%` }} />
                        <span className="barre-budget-texte">{pourcent(ind[part])}</span>
                      </div>
                      <span className="visuellement-cache">{pourcent(ind[part])}</span>
                    </td>
                    <td className="droite nowrap secondaire-cellule">{indMoyen ? pourcent(indMoyen[part]) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CarteRepliable>

      <CarteRepliable id="rapports.evolution" titre={`Évolution sur ${mois.length} mois`}>
        <GrapheMensuel
          titre={`Revenus et dépenses par mois, de ${nomMois(mois[0])} à ${nomMois(mois.at(-1)!)}`}
          points={mois.map((debut, i) => ({ debut, bilan: bilans[i], tauxEpargne: indicateursBilan(bilans[i]).tauxEpargne }))}
        />
        <div className="defilement-tableau">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col">
                  <span className="visuellement-cache">Indicateur</span>
                </th>
                {mois.map((debut) => (
                  <th key={debut} scope="col" className="droite nowrap">
                    {libelleMois(debut)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignesMensuelles.map((l) => (
                <tr key={l.libelle}>
                  <th scope="row">{l.libelle}</th>
                  {bilans.map((b, i) => (
                    <td key={mois[i]} className="droite nowrap">
                      {l.valeur(b)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CarteRepliable>

      <CarteRepliable id="rapports.categories" titre="Dépenses par catégorie">
        {evolution.length === 0 ? (
          <p className="secondaire">Aucune dépense sur la période.</p>
        ) : (
          <div className="defilement-tableau">
            <table className="tableau">
              <thead>
                <tr>
                  <th scope="col">Catégorie</th>
                  {mois.map((debut) => (
                    <th key={debut} scope="col" className="droite nowrap">
                      {libelleMois(debut)}
                    </th>
                  ))}
                  {mois.length > 1 && (
                    <th scope="col" className="droite nowrap">
                      Sur un mois
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {evolution.map((l) => (
                  <tr key={l.categorieId ?? 'sans'}>
                    <th scope="row">
                      {l.categorieId === null ? 'Sans catégorie' : (nomCategorie.get(l.categorieId) ?? 'Catégorie supprimée')}
                    </th>
                    {l.montants.map((m, i) => (
                      <td key={mois[i]} className="droite nowrap">
                        {m === 0 ? <span className="secondaire-cellule">–</span> : formaterEuros(m)}
                      </td>
                    ))}
                    {mois.length > 1 && (
                      <td className="droite nowrap">
                        <Variation avant={l.montants.at(-2)!} apres={l.montants.at(-1)!} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="secondaire">
          « Sur un mois » compare {libelleMois(mois.at(-1)!)} au mois précédent. Une hausse de dépense est en rouge ▲, une
          baisse en vert ▼.
        </p>
      </CarteRepliable>
    </>
  )
}
