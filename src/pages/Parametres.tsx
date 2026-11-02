import { useEffect, useState } from 'react'
import { chargerDonneesExemple, compterTransactions, viderDonnees } from '../lib/donnees'

export function Parametres() {
  const [nbTransactions, setNbTransactions] = useState<number | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const rafraichir = () => compterTransactions().then(setNbTransactions, (e: Error) => setMessage(e.message))

  useEffect(() => {
    rafraichir()
  }, [])

  async function executer(action: () => Promise<void>, succes: string) {
    setEnCours(true)
    setMessage(null)
    try {
      await action()
      setMessage(succes)
    } catch (e) {
      setMessage(`Erreur : ${(e as Error).message}`)
    }
    await rafraichir()
    setEnCours(false)
  }

  return (
    <>
      <h1>Paramètres</h1>
      <section className="carte">
        <h2>Données d'exemple</h2>
        <p>
          Trois mois de données fictives pour découvrir l'appli. À vider avant d'importer tes vrais relevés.
        </p>
        <p className="secondaire">
          {nbTransactions === null ? 'Comptage…' : `${nbTransactions} transaction(s) enregistrée(s).`}
        </p>
        <div className="actions">
          <button
            type="button"
            className="bouton-principal"
            disabled={enCours || nbTransactions !== 0}
            onClick={() => executer(chargerDonneesExemple, 'Données d’exemple chargées.')}
          >
            Charger les données d'exemple
          </button>
          <button
            type="button"
            className="bouton-danger"
            disabled={enCours || !nbTransactions}
            onClick={() => {
              if (window.confirm('Supprimer toutes les données (comptes, transactions, catégories, budgets) ?')) {
                executer(viderDonnees, 'Toutes les données ont été supprimées.')
              }
            }}
          >
            Vider toutes les données
          </button>
        </div>
        {message && <p role="status">{message}</p>}
      </section>
    </>
  )
}
