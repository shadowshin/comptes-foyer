import { useState } from 'react'
import { depuisIso } from '../../domain/dates'
import { euroCompact, graduations } from '../../domain/echelles'
import { formaterEuros } from '../../domain/montants'
import type { BilanMois } from '../../domain/rapports'
import { cheminBarre } from './geometrie'
import { useLargeur } from './useLargeur'

const HAUTEUR = 240
const MARGE = { haut: 12, droite: 8, bas: 26, gauche: 56 }
// 2 px de surface entre la barre des revenus et celle des dépenses d'un même mois
const ECART = 2

export interface PointMensuel {
  debut: string
  bilan: BilanMois
  tauxEpargne: number | null
}

const nomMoisCourt = (iso: string) => depuisIso(iso).toLocaleDateString('fr-FR', { month: 'short' })
const pourcent = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)} %`)

// Revenus et dépenses de chaque mois, en barres groupées sur un seul axe en euros
export function GrapheMensuel({ points, titre }: { points: PointMensuel[]; titre: string }) {
  const { ref, largeur } = useLargeur<HTMLDivElement>()
  const [survol, setSurvol] = useState<number | null>(null)

  const ticks = graduations(0, Math.max(0, ...points.flatMap((p) => [p.bilan.revenus, p.bilan.depenses])))
  const yMax = ticks.at(-1)!
  const zoneL = largeur - MARGE.gauche - MARGE.droite
  const zoneH = HAUTEUR - MARGE.haut - MARGE.bas
  const y = (v: number) => MARGE.haut + ((yMax - Math.max(0, v)) / yMax) * zoneH
  const bande = zoneL / Math.max(1, points.length)
  const epaisseur = Math.max(4, Math.min(28, (bande * 0.6 - ECART) / 2))
  const point = survol !== null ? points[survol] : null

  return (
    <figure className="graphe" ref={ref}>
      <div className="legende" aria-hidden="true">
        <span>
          <span className="pastille pastille-positive" /> Revenus
        </span>
        <span>
          <span className="pastille pastille-negative" /> Dépenses
        </span>
      </div>
      <svg width={largeur} height={HAUTEUR} role="img" aria-label={titre}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(t)} y2={y(t)} className={t === 0 ? 'axe-zero' : 'grille'} />
            <text x={MARGE.gauche - 8} y={y(t)} className="graduation" textAnchor="end" dominantBaseline="middle">
              {euroCompact(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const centre = MARGE.gauche + i * bande + bande / 2
          const xRevenus = centre - ECART / 2 - epaisseur
          const xDepenses = centre + ECART / 2
          const classe = survol === i ? ' survolee' : ''
          return (
            <g key={p.debut}>
              {p.bilan.revenus > 0 && (
                <path d={cheminBarre(xRevenus, epaisseur, y(0), y(p.bilan.revenus))} className={`barre barre-positive${classe}`} />
              )}
              {p.bilan.depenses > 0 && (
                <path d={cheminBarre(xDepenses, epaisseur, y(0), y(p.bilan.depenses))} className={`barre barre-negative${classe}`} />
              )}
              <text x={centre} y={HAUTEUR - 8} className="graduation" textAnchor="middle">
                {nomMoisCourt(p.debut)}
              </text>
              <rect
                x={MARGE.gauche + i * bande}
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
        <div className="infobulle" style={{ left: Math.min(MARGE.gauche + survol * bande + bande / 2, largeur - 190), top: 36 }}>
          <strong>{depuisIso(point.debut).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</strong>
          <span>Revenus {formaterEuros(point.bilan.revenus)}</span>
          <span>Dépenses {formaterEuros(point.bilan.depenses)}</span>
          <span>
            Épargne nette {formaterEuros(point.bilan.epargneNette)} ({pourcent(point.tauxEpargne)})
          </span>
        </div>
      )}
    </figure>
  )
}
