import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

export function Connexion() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function seConnecter(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
    if (error) setErreur('Adresse e-mail ou mot de passe incorrect.')
    setEnvoi(false)
  }

  return (
    <main className="connexion">
      <form className="carte connexion-formulaire" onSubmit={seConnecter}>
        <h1>Comptes du foyer</h1>
        <label>
          Adresse e-mail
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            autoComplete="current-password"
            required
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
        </label>
        {erreur && (
          <p className="message-erreur" role="alert">
            {erreur}
          </p>
        )}
        <button type="submit" className="bouton-principal" disabled={envoi}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </main>
  )
}
