import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface EtatAuth {
  session: Session | null
  chargement: boolean
}

const AuthContext = createContext<EtatAuth>({ session: null, chargement: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatAuth>({ session: null, chargement: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEtat({ session: data.session, chargement: false })
    })
    const { data } = supabase.auth.onAuthStateChange((_evenement, session) => {
      setEtat({ session, chargement: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={etat}>{children}</AuthContext.Provider>
}

export function useAuth(): EtatAuth {
  return useContext(AuthContext)
}
