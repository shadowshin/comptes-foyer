import { Navigate, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

const LIENS = [
  { vers: '/', libelle: 'Comptes' },
  { vers: '/transactions', libelle: 'Transactions' },
  { vers: '/tresorerie', libelle: 'Trésorerie' },
  { vers: '/budgets', libelle: 'Budgets' },
  { vers: '/alertes', libelle: 'Alertes' },
  { vers: '/rapports', libelle: 'Rapports' },
  { vers: '/parametres', libelle: 'Paramètres' },
]

export function Layout() {
  const { session, chargement } = useAuth()

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
