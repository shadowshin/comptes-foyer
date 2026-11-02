import { useEffect, useState } from 'react'

// État conservé dans le sessionStorage de l'onglet : il survit à un rafraîchissement
// et à un changement de page, et disparaît à la fermeture de l'onglet.
// Le stockage peut être indisponible (navigation privée, stockage bloqué) : l'état
// fonctionne alors normalement, sans être conservé.
export function useEtatSession<T>(cle: string, initial: T) {
  const [valeur, setValeur] = useState<T>(() => {
    try {
      const lu = sessionStorage.getItem(cle)
      return lu === null ? initial : (JSON.parse(lu) as T)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(cle, JSON.stringify(valeur))
    } catch {
      // stockage plein ou indisponible : on garde simplement l'état en mémoire
    }
  }, [cle, valeur])

  return [valeur, setValeur] as const
}
