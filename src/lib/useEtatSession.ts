import { useEffect, useState } from 'react'

// État conservé dans un stockage du navigateur. Le stockage peut être indisponible
// (navigation privée, stockage bloqué) : l'état fonctionne alors normalement, sans être conservé.
function useEtatStocke<T>(stockage: () => Storage, cle: string, initial: T) {
  const [valeur, setValeur] = useState<T>(() => {
    try {
      const lu = stockage().getItem(cle)
      return lu === null ? initial : (JSON.parse(lu) as T)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      stockage().setItem(cle, JSON.stringify(valeur))
    } catch {
      // stockage plein ou indisponible : on garde simplement l'état en mémoire
    }
  }, [stockage, cle, valeur])

  return [valeur, setValeur] as const
}

const session = () => sessionStorage
const local = () => localStorage

// Conservé dans l'onglet : survit à un rafraîchissement et à un changement de page,
// disparaît à la fermeture de l'onglet (filtres, vue choisie)
export function useEtatSession<T>(cle: string, initial: T) {
  return useEtatStocke(session, cle, initial)
}

// Conservé d'une visite à l'autre sur ce navigateur (préférences d'affichage)
export function useEtatLocal<T>(cle: string, initial: T) {
  return useEtatStocke(local, cle, initial)
}
