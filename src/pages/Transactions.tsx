import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { BarreFiltres } from '../components/BarreFiltres'
import { FormulaireTransaction } from '../components/FormulaireTransaction'
import { TableauTransactions } from '../components/TableauTransactions'
import { FILTRES_VIDES, filtrerTransactions, trierParDateDecroissante } from '../domain/filtres'
import { saisieDepuisOperations } from '../domain/saisie'
import type { Transaction } from '../domain/types'
import {
  creerSaisie,
  lireReferentiel,
  lireTransactions,
  modifierSaisie,
  supprimerTransactions,
} from '../lib/donnees'
import { useChargement } from '../lib/useChargement'

export function Transactions() {
  const referentiel = useChargement(lireReferentiel)
  const transactions = useChargement(lireTransactions)
  const [filtres, setFiltres] = useState(FILTRES_VIDES)
  const [enEdition, setEnEdition] = useState<Transaction[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const filtrees = useMemo(
    () =>
      transactions.donnee && referentiel.donnee
        ? trierParDateDecroissante(filtrerTransactions(transactions.donnee, filtres, referentiel.donnee.comptesMembres))
        : [],
    [transactions.donnee, referentiel.donnee, filtres],
  )

  const erreur = referentiel.erreur ?? transactions.erreur
  if (erreur) return <p className="message-erreur">Impossible de charger les transactions : {erreur}</p>
  if (!referentiel.donnee || !transactions.donnee) return <p className="chargement">Chargement…</p>

  const ref = referentiel.donnee
  if (ref.comptes.filter((c) => c.actif).length === 0) {
    return (
      <section className="carte vide">
        <h1>Transactions</h1>
        <p>
          Crée d'abord tes comptes dans les <Link to="/parametres">Paramètres</Link>.
        </p>
      </section>
    )
  }

  async function supprimer(operations: Transaction[]) {
    const quoi =
      operations.length > 1
        ? `ce virement interne (ses ${operations.length} opérations, une par compte)`
        : `« ${operations[0].libelle} »`
    if (!window.confirm(`Supprimer ${quoi} ?`)) return
    try {
      await supprimerTransactions(operations.map((o) => o.id))
      setMessage('Transaction supprimée.')
      if (enEdition?.some((e) => operations.some((o) => o.id === e.id))) setEnEdition(null)
      await transactions.recharger()
    } catch (e) {
      setMessage(`Erreur : ${(e as Error).message}`)
    }
  }

  return (
    <>
      <h1>Transactions</h1>

      {enEdition ? (
        <FormulaireTransaction
          key={enEdition.map((o) => o.id).join()}
          referentiel={ref}
          initiale={saisieDepuisOperations(enEdition)}
          onEnregistrer={async (saisie) => {
            await modifierSaisie(enEdition, saisie)
            setEnEdition(null)
            setMessage('Transaction modifiée.')
            await transactions.recharger()
          }}
          onAnnuler={() => setEnEdition(null)}
        />
      ) : (
        <FormulaireTransaction
          referentiel={ref}
          onEnregistrer={async (saisie) => {
            await creerSaisie(saisie)
            setMessage(saisie.recurrente ? 'Transaction et récurrence ajoutées.' : 'Transaction ajoutée.')
            await transactions.recharger()
          }}
        />
      )}

      {message && (
        <p className="message-statut" role="status">
          {message}
        </p>
      )}

      <BarreFiltres referentiel={ref} filtres={filtres} onChange={setFiltres} />
      <TableauTransactions
        referentiel={ref}
        transactions={filtrees}
        toutes={transactions.donnee}
        onModifier={(operations) => {
          setEnEdition(operations)
          setMessage(null)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        onSupprimer={supprimer}
      />
    </>
  )
}
