import { Link } from 'react-router'
import type { Alerte, NiveauAlerte, SujetAlerte } from '../domain/alertes'
import { useAlertes } from '../lib/useAlertes'

const NIVEAUX: { niveau: NiveauAlerte; titre: string; icone: string }[] = [
  { niveau: 'critique', titre: 'Critiques', icone: '⛔' },
  { niveau: 'avertissement', titre: 'Avertissements', icone: '⚠️' },
  { niveau: 'info', titre: 'Informations', icone: 'ℹ️' },
]

const PAGE_DU_SUJET: Record<SujetAlerte, { vers: string; libelle: string }> = {
  solde: { vers: '/tresorerie', libelle: 'Voir la trésorerie' },
  budget: { vers: '/budgets', libelle: 'Voir les budgets' },
  revenus: { vers: '/transactions', libelle: 'Voir les transactions' },
  echeance: { vers: '/tresorerie', libelle: 'Voir les échéances' },
  placement: { vers: '/parametres', libelle: 'Voir le compte' },
}

function CarteAlerte({ alerte, icone }: { alerte: Alerte; icone: string }) {
  const lien = PAGE_DU_SUJET[alerte.sujet]
  return (
    <li className={`carte alerte alerte-${alerte.niveau}`}>
      <span className="alerte-icone" aria-hidden="true">
        {icone}
      </span>
      <div>
        <h3>{alerte.titre}</h3>
        <p>{alerte.detail}</p>
        <p className="alerte-action">
          <strong>À faire :</strong> {alerte.action} <Link to={lien.vers}>{lien.libelle}</Link>
        </p>
      </div>
    </li>
  )
}

export function Alertes() {
  const { alertes, erreur } = useAlertes()

  if (erreur) return <p className="message-erreur">Impossible de calculer les alertes : {erreur}</p>
  if (!alertes) return <p className="chargement">Chargement…</p>

  return (
    <>
      <h1>Alertes</h1>
      <p className="secondaire">
        Calculées sur tout le foyer à chaque ouverture de la page. Une alerte disparaît d'elle-même quand sa cause est
        réglée. Les seuils se règlent dans Paramètres.
      </p>
      {alertes.length === 0 ? (
        <section className="carte vide">
          <p>Aucune alerte : soldes, budgets et revenus sont dans les clous.</p>
        </section>
      ) : (
        NIVEAUX.map(({ niveau, titre, icone }) => {
          const duNiveau = alertes.filter((a) => a.niveau === niveau)
          if (duNiveau.length === 0) return null
          return (
            <section key={niveau} className="groupe-alertes" aria-labelledby={`titre-${niveau}`}>
              <h2 id={`titre-${niveau}`}>
                {titre} ({duNiveau.length})
              </h2>
              <ul className="liste-alertes">
                {duNiveau.map((a) => (
                  <CarteAlerte key={a.id} alerte={a} icone={icone} />
                ))}
              </ul>
            </section>
          )
        })
      )}
    </>
  )
}
