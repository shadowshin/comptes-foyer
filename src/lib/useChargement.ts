import { useCallback, useEffect, useState } from 'react'

// Charge une donnée asynchrone et expose de quoi la recharger après une modification
export function useChargement<T>(charger: () => Promise<T>) {
  const [donnee, setDonnee] = useState<T | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const recharger = useCallback(async () => {
    try {
      setDonnee(await charger())
      setErreur(null)
    } catch (e) {
      setErreur((e as Error).message)
    }
  }, [charger])

  useEffect(() => {
    recharger()
  }, [recharger])

  return { donnee, erreur, recharger }
}
