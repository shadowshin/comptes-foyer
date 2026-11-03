import type { ReactNode } from 'react'
import { useEtatLocal } from '../lib/useEtatSession'

interface Props {
  // identifiant stable : sert à retenir si la carte est ouverte ou repliée
  id: string
  titre: ReactNode
  ouverteParDefaut?: boolean
  children: ReactNode
}

// Carte dont on peut replier le contenu en cliquant sur son titre (élément natif
// details / summary, utilisable au clavier). L'état est retenu d'une visite à l'autre.
export function CarteRepliable({ id, titre, ouverteParDefaut = true, children }: Props) {
  const [ouverte, setOuverte] = useEtatLocal(`repliable.${id}`, ouverteParDefaut)
  return (
    <details className="carte repliable" open={ouverte} onToggle={(e) => setOuverte(e.currentTarget.open)}>
      <summary>
        <h2>{titre}</h2>
      </summary>
      <div className="repliable-contenu">{children}</div>
    </details>
  )
}
