import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { depuisIso } from '../domain/dates'
import { formaterEuros, somme } from '../domain/montants'
import type { NatureCompte } from '../domain/types'
import { lireComptes, type CompteAvecSolde } from '../lib/donnees'

const GROUPES: { nature: NatureCompte; titre: string }[] = [
  { nature: 'courant', titre: 'Comptes courants' },
  { nature: 'livret', titre: 'Livrets' },
  { nature: 'placement', titre: 'Placements' },
]

export function Comptes() {
  const [comptes, setComptes] = useState<CompteAvecSolde[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    lireComptes().then(setComptes, (e: Error) => setErreur(e.message))
  }, [])

  if (erreur) return <p className="message-erreur">Impossible de lire les comptes : {erreur}</p>
  if (!comptes) return <p className="chargement">Chargement…</p>
  if (comptes.length === 0) {
    return (
      <section className="carte vide">
        <h1>Aucun compte pour l'instant</h1>
        <p>
          Charge les données d'exemple depuis les <Link to="/parametres">Paramètres</Link> pour découvrir l'appli.
        </p>
      </section>
    )
  }

  const disponible = somme(comptes.filter((c) => c.disponible).map((c) => c.solde))
  const bloque = somme(comptes.filter((c) => !c.disponible).map((c) => c.solde))

  return (
    <>
      <h1>Comptes du foyer</h1>
      <div className="kpis">
        <div className="carte kpi">
          <span className="kpi-libelle">Total foyer</span>
          <span className="kpi-valeur">{formaterEuros(disponible + bloque)}</span>
        </div>
        <div className="carte kpi">
          <span className="kpi-libelle">Disponible</span>
          <span className="kpi-valeur">{formaterEuros(disponible)}</span>
        </div>
        <div className="carte kpi">
          <span className="kpi-libelle">Épargne bloquée</span>
          <span className="kpi-valeur">{formaterEuros(bloque)}</span>
        </div>
      </div>

      {GROUPES.map(({ nature, titre }) => {
        const liste = comptes.filter((c) => c.nature === nature)
        if (liste.length === 0) return null
        return (
          <section key={nature} className="groupe-comptes">
            <h2>{titre}</h2>
            <ul className="liste-comptes">
              {liste.map((c) => (
                <li key={c.id} className="carte compte">
                  <div>
                    <strong>{c.nom}</strong>
                    <span className="secondaire">
                      {c.banque} · {c.membres.join(' et ')}
                      {c.date_echeance && ` · échéance ${depuisIso(c.date_echeance).toLocaleDateString('fr-FR')}`}
                    </span>
                  </div>
                  <span className={c.solde < 0 ? 'montant negatif' : 'montant'}>{formaterEuros(c.solde)}</span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
