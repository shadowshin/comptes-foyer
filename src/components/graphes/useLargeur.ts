import { useEffect, useRef, useState } from 'react'

// Largeur disponible d'un conteneur, mise à jour quand la fenêtre change de taille
export function useLargeur<T extends HTMLElement>(defaut = 640) {
  const ref = useRef<T>(null)
  const [largeur, setLargeur] = useState(defaut)
  useEffect(() => {
    if (!ref.current) return
    const observateur = new ResizeObserver(([entree]) => setLargeur(Math.max(280, entree.contentRect.width)))
    observateur.observe(ref.current)
    return () => observateur.disconnect()
  }, [])
  return { ref, largeur }
}
