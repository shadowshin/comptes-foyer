import { useState } from 'react'
import { depuisIso } from '../domain/dates'
import { formaterEuros, somme } from '../domain/montants'
import { LIBELLES_TYPE, type Transaction } from '../domain/types'
import type { Referentiel } from '../lib/donnees'

const PAR_PAGE = 100

interface Props {
  referentiel: Referentiel
  transactions: Transaction[]
  // toutes les transactions, pour retrouver l'autre moitié d'un virement même si elle est filtrée
  toutes: Transaction[]
  onModifier: (operations: Transaction[]) => void
  onSupprimer: (operations: Transaction[]) => void
  onRendreRecurrente: (operations: Transaction[]) => void
}

export function TableauTransactions({
  referentiel,
  transactions,
  toutes,
  onModifier,
  onSupprimer,
  onRendreRecurrente,
}: Props) {
  const [affichees, setAffichees] = useState(PAR_PAGE)
  const nomCompte = new Map(referentiel.comptes.map((c) => [c.id, c.nom]))
  const nomCategorie = new Map(referentiel.categories.map((c) => [c.id, c.nom]))

  const operationsLiees = (t: Transaction) =>
    t.transfert_id ? toutes.filter((autre) => autre.transfert_id === t.transfert_id) : [t]

  // Les virements internes ne sont ni des entrées ni des sorties du foyer
  const horsVirements = transactions.filter((t) => t.type !== 'virement_interne')
  const entrees = somme(horsVirements.filter((t) => t.montant > 0).map((t) => t.montant))
  const sorties = somme(horsVirements.filter((t) => t.montant < 0).map((t) => t.montant))

  if (transactions.length === 0) {
    return <p className="carte vide">Aucune transaction ne correspond.</p>
  }

  return (
    <section className="carte">
      <p className="resume-tableau">
        <span>{transactions.length} transaction(s)</span>
        <span>
          Entrées <strong className="montant">{formaterEuros(entrees)}</strong>
        </span>
        <span>
          Sorties <strong className="montant negatif">{formaterEuros(sorties)}</strong>
        </span>
        <span className="secondaire">hors virements internes</span>
      </p>
      <div className="defilement-tableau">
        <table className="tableau">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Description</th>
              <th scope="col">Compte</th>
              <th scope="col">Catégorie</th>
              <th scope="col">Type</th>
              <th scope="col" className="droite">
                Montant
              </th>
              <th scope="col">
                <span className="visuellement-cache">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.slice(0, affichees).map((t) => {
              const liees = operationsLiees(t)
              const autre = liees.find((o) => o.id !== t.id)
              return (
                <tr key={t.id}>
                  <td className="nowrap">{depuisIso(t.date_operation).toLocaleDateString('fr-FR')}</td>
                  <td>
                    {t.libelle}
                    {t.notes && <span className="secondaire">{t.notes}</span>}
                  </td>
                  <td>{nomCompte.get(t.compte_id) ?? '?'}</td>
                  <td>
                    {t.type === 'virement_interne'
                      ? autre
                        ? `${t.montant < 0 ? 'vers' : 'depuis'} ${nomCompte.get(autre.compte_id) ?? '?'}`
                        : '—'
                      : (nomCategorie.get(t.categorie_id ?? '') ?? <span className="a-categoriser">À catégoriser</span>)}
                  </td>
                  <td>
                    <span className={`badge badge-${t.type}`}>{LIBELLES_TYPE[t.type]}</span>
                  </td>
                  <td className={`droite montant${t.montant < 0 ? ' negatif' : ''}`}>{formaterEuros(t.montant)}</td>
                  <td className="nowrap">
                    <button
                      type="button"
                      className="bouton-icone"
                      aria-label={`Rendre récurrente ${t.libelle}`}
                      title="Rendre récurrente (chaque mois)"
                      onClick={() => onRendreRecurrente(liees)}
                    >
                      ↻
                    </button>
                    <button
                      type="button"
                      className="bouton-icone"
                      aria-label={`Modifier ${t.libelle}`}
                      title="Modifier"
                      onClick={() => onModifier(liees)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="bouton-icone danger"
                      aria-label={`Supprimer ${t.libelle}`}
                      title="Supprimer"
                      onClick={() => onSupprimer(liees)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {transactions.length > affichees && (
        <button type="button" className="bouton-discret afficher-plus" onClick={() => setAffichees((n) => n + PAR_PAGE)}>
          Afficher {Math.min(PAR_PAGE, transactions.length - affichees)} de plus
        </button>
      )}
    </section>
  )
}
