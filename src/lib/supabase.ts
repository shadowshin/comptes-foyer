import { createClient } from '@supabase/supabase-js'

// La clé publishable est publique par conception : la protection des données
// repose sur la connexion et les règles RLS, pas sur le secret de cette clé.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const cle = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const configurationManquante = !url || !cle

export const supabase = createClient(url ?? 'http://localhost', cle ?? 'absente')
