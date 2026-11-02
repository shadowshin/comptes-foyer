import { useState } from 'react'
import { GestionCategories } from '../components/GestionCategories'
import { GestionComptes } from '../components/GestionComptes'
import { GestionMembres } from '../components/GestionMembres'
import { chargerDonneesExemple, compterTransactions, lireReferentiel, viderDonnees } from '../lib/donnees'
import { useChargement } from '../lib/useChargement'

export function Parametres() {
  const referentiel = useChargement(lireReferentiel)
  const nbTransactions = useChargement(compterTransactions)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const erreur = referentiel.erreur ?? nbTransactions.erreur
  if (erreur) return <p className="message-erreur">Impossible de charger les paramètres : {erreur}</p>
  if (!referentiel.donnee || nbTransactions.donnee === null) return <p className="chargement">Chargement…</p>

  const ref = referentiel.donnee
  const baseVide =
    nbTransactions.donnee === 0 && ref.membres.length === 0 && ref.comptes.length === 0 && ref.categories.length === 0

  async function executer(action: () => Promise<void>, succes: string) {
    setEnCours(true)
    setMessage(null)
    try {
      await action()
      setMessage(succes)
    } catch (e) {
      setMessage(`Erreur : ${(e as Error).message}`)
    }
    await Promise.all([referentiel.recharger(), nbTransactions.recharger()])
    setEnCours(false)
  }

  return (
    <>
      <h1>Paramètres</h1>
      <div className="pile">
        <GestionMembres membres={ref.membres} onChange={referentiel.recharger} />
        <GestionComptes referentiel={ref} onChange={referentiel.recharger} />
        <GestionCategories categories={ref.categories} onChange={referentiel.recharger} />

        <section className="carte" aria-labelledby="titre-donnees">
          <h2 id="titre-donnees">Données d'exemple</h2>
          <p>
            Trois mois de données fictives pour découvrir l'appli, chargeables uniquement sur une base vide. À vider
            avant de saisir ou d'importer tes vraies données.
          </p>
          <p className="secondaire">{nbTransactions.donnee} transaction(s) enregistrée(s).</p>
          <div className="actions">
            <button
              type="button"
              className="bouton-principal"
              disabled={enCours || !baseVide}
              onClick={() => executer(chargerDonneesExemple, 'Données d’exemple chargées.')}
            >
              Charger les données d'exemple
            </button>
            <button
              type="button"
              className="bouton-danger"
              disabled={enCours || baseVide}
              onClick={() => {
                if (window.confirm('Supprimer toutes les données (membres, comptes, transactions, catégories, budgets) ?')) {
                  executer(viderDonnees, 'Toutes les données ont été supprimées.')
                }
              }}
            >
              Vider toutes les données
            </button>
          </div>
          {message && <p role="status">{message}</p>}
        </section>
      </div>
    </>
  )
}
