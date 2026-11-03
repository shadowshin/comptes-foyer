import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { useAlertes } from '../lib/useAlertes'

const LIENS = [
  { vers: '/', libelle: 'Comptes' },
  { vers: '/transactions', libelle: 'Transactions' },
  { vers: '/import', libelle: 'Import' },
  { vers: '/tresorerie', libelle: 'Trésorerie' },
  { vers: '/budgets', libelle: 'Budgets' },
  { vers: '/alertes', libelle: 'Alertes' },
  { vers: '/rapports', libelle: 'Rapports' },
  { vers: '/parametres', libelle: 'Paramètres' },
]

// Nombre d'alertes critiques, recalculé à chaque changement de page (le composant
// est remonté) pour tenir compte d'une saisie ou d'un import qui vient d'avoir lieu
function BadgeAlertes() {
  const { alertes } = useAlertes()
  const critiques = alertes?.filter((a) => a.niveau === 'critique').length ?? 0
  if (critiques === 0) return null
  return (
    <span className="badge-alertes">
      {critiques}
      <span className="visuellement-cache"> alerte(s) critique(s)</span>
    </span>
  )
}

export function Layout() {
  const { session, chargement } = useAuth()
  const { pathname } = useLocation()

  if (chargement) return <p className="chargement">Chargement…</p>
  if (!session) return <Navigate to="/connexion" replace />

  return (
    <>
      <header className="entete">
        <span className="marque">Comptes du foyer</span>
        <nav className="navigation" aria-label="Navigation principale">
          {LIENS.map((l) => (
            <NavLink key={l.vers} to={l.vers} end={l.vers === '/'}>
              {l.libelle}
              {l.vers === '/alertes' && <BadgeAlertes key={pathname} />}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="bouton-discret" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </button>
      </header>
      <main className="contenu">
        <Outlet />
      </main>
    </>
  )
}
