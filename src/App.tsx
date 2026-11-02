import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { configurationManquante } from './lib/supabase'
import { AVenir } from './pages/AVenir'
import { Comptes } from './pages/Comptes'
import { Connexion } from './pages/Connexion'
import { Parametres } from './pages/Parametres'
import { Transactions } from './pages/Transactions'

export default function App() {
  if (configurationManquante) {
    return (
      <main className="connexion">
        <section className="carte">
          <h1>Configuration manquante</h1>
          <p>
            Copie <code>.env.example</code> en <code>.env.local</code> et renseigne l'URL et la clé publishable du
            projet Supabase, puis relance <code>npm run dev</code>.
          </p>
        </section>
      </main>
    )
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />
          <Route element={<Layout />}>
            <Route index element={<Comptes />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="tresorerie" element={<AVenir titre="Trésorerie" etape={4} />} />
            <Route path="budgets" element={<AVenir titre="Budgets" etape={5} />} />
            <Route path="alertes" element={<AVenir titre="Alertes" etape={5} />} />
            <Route path="rapports" element={<AVenir titre="Rapports" etape={6} />} />
            <Route path="parametres" element={<Parametres />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
