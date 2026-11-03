// Variables nécessaires aux tests, lues une fois avec un message clair si l'une manque

function lire(nom: string): string {
  const valeur = process.env[nom]
  if (!valeur) {
    throw new Error(
      `Variable ${nom} absente : copie .env.e2e.example en .env.e2e.local et renseigne le projet Supabase de test.`,
    )
  }
  return valeur
}

export const environnement = {
  get url() {
    return lire('VITE_SUPABASE_URL')
  },
  get cle() {
    return lire('VITE_SUPABASE_PUBLISHABLE_KEY')
  },
  get email() {
    return lire('E2E_EMAIL')
  },
  get motDePasse() {
    return lire('E2E_PASSWORD')
  },
}
