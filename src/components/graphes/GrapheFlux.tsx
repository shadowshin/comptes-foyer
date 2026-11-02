import { useState } from 'react'
import { depuisIso } from '../../domain/dates'
import { euroCompact, graduations } from '../../domain/echelles'
import { formaterEuros } from '../../domain/montants'
import type { FluxJour } from '../../domain/tresorerie'
import { useLargeur } from './useLargeur'

const HAUTEUR = 240
const MARGE = { haut: 12, droite: 8, bas: 26, gauche: 56 }
const RAYON = 4

// Barre arrondie du côté de la valeur, carrée sur la ligne du zéro
function cheminBarre(x: number, largeur: number, yZero: number, yValeur: number): string {
  const h = Math.abs(yValeur - yZero)
  const r = Math.min(RAYON, h, largeur / 2)
  if (yValeur < yZero) {
    return `M${x},${yZero} V${yValeur + r} Q${x},${yValeur} ${x + r},${yValeur} H${x + largeur - r} Q${x + largeur},${yValeur} ${x + largeur},${yValeur + r} V${yZero} Z`
  }
  return `M${x},${yZero} V${yValeur - r} Q${x},${yValeur} ${x + r},${yValeur} H${x + largeur - r} Q${x + largeur},${yValeur} ${x + largeur},${yValeur - r} V${yZero} Z`
}

export function GrapheFlux({ flux, titre }: { flux: FluxJour[]; titre: string }) {
  const { ref, largeur } = useLargeur<HTMLDivElement>()
  const [survol, setSurvol] = useState<number | null>(null)

  const ticks = graduations(Math.min(0, ...flux.map((f) => f.net)), Math.max(0, ...flux.map((f) => f.net)))
  const [yMin, yMax] = [ticks[0], ticks.at(-1)!]
  const zoneL = largeur - MARGE.gauche - MARGE.droite
  const zoneH = HAUTEUR - MARGE.haut - MARGE.bas
  const y = (v: number) => MARGE.haut + ((yMax - v) / (yMax - yMin)) * zoneH
  const bande = zoneL / Math.max(1, flux.length)
  // Barres fines (24 px au plus) séparées d'au moins 2 px
  const epaisseur = Math.max(2, Math.min(24, bande - 2))
  const pasEtiquette = Math.ceil(flux.length / Math.max(1, Math.floor(zoneL / 44)))
  const point = survol !== null ? flux[survol] : null

  return (
    <figure className="graphe" ref={ref}>
      <svg width={largeur} height={HAUTEUR} role="img" aria-label={titre}>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={MARGE.gauche}
              x2={largeur - MARGE.droite}
              y1={y(t)}
              y2={y(t)}
              className={t === 0 ? 'axe-zero' : 'grille'}
            />
            <text x={MARGE.gauche - 8} y={y(t)} className="graduation" textAnchor="end" dominantBaseline="middle">
              {euroCompact(t)}
            </text>
          </g>
        ))}
        {flux.map((f, i) => {
          const x = MARGE.gauche + i * bande
          return (
            <g key={f.date}>
              {f.net !== 0 && (
                <path
                  d={cheminBarre(x + (bande - epaisseur) / 2, epaisseur, y(0), y(f.net))}
                  className={`barre ${f.net > 0 ? 'barre-positive' : 'barre-negative'}${survol === i ? ' survolee' : ''}`}
                />
              )}
              {i % pasEtiquette === 0 && (
                <text x={x + bande / 2} y={HAUTEUR - 8} className="graduation" textAnchor="middle">
                  {depuisIso(f.date).getDate()}
                </text>
              )}
              {/* zone de survol : toute la hauteur de la colonne, plus large que la barre */}
              <rect
                x={x}
                y={MARGE.haut}
                width={bande}
                height={zoneH}
                fill="transparent"
                onPointerEnter={() => setSurvol(i)}
                onPointerLeave={() => setSurvol(null)}
              />
            </g>
          )
        })}
      </svg>
      {point && survol !== null && (
        <div
          className="infobulle"
          style={{ left: Math.min(MARGE.gauche + survol * bande + bande / 2, largeur - 170), top: 8 }}
        >
          <strong>{formaterEuros(point.net)}</strong>
          <span>{depuisIso(point.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <span>
            Entrées {formaterEuros(point.entrees)} · Sorties {formaterEuros(point.sorties)}
          </span>
        </div>
      )}
      <details className="donnees-graphe">
        <summary>Voir les données</summary>
        <table className="tableau">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col" className="droite">
                Entrées
              </th>
              <th scope="col" className="droite">
                Sorties
              </th>
              <th scope="col" className="droite">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {flux
              .filter((f) => f.entrees || f.sorties)
              .map((f) => (
                <tr key={f.date}>
                  <td>{depuisIso(f.date).toLocaleDateString('fr-FR')}</td>
                  <td className="droite">{formaterEuros(f.entrees)}</td>
                  <td className="droite">{formaterEuros(f.sorties)}</td>
                  <td className="droite">{formaterEuros(f.net)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
