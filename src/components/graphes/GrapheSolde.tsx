import { useState, type PointerEvent } from 'react'
import { depuisIso } from '../../domain/dates'
import { euroCompact, graduations } from '../../domain/echelles'
import { formaterEuros } from '../../domain/montants'
import type { PointSolde } from '../../domain/tresorerie'
import { useLargeur } from './useLargeur'

const HAUTEUR = 260
const MARGE = { haut: 16, droite: 72, bas: 26, gauche: 56 }

interface Props {
  titre: string
  historique: PointSolde[]
  // commence au dernier point de l'historique (aujourd'hui)
  projection: PointSolde[]
}

// Une seule série : le solde, en trait plein pour le passé et en pointillé pour la projection
export function GrapheSolde({ titre, historique, projection }: Props) {
  const { ref, largeur } = useLargeur<HTMLDivElement>()
  const [survol, setSurvol] = useState<number | null>(null)

  const points = [...historique, ...projection.slice(1)]
  const indexAujourdhui = historique.length - 1
  const ticks = graduations(Math.min(0, ...points.map((p) => p.solde)), Math.max(0, ...points.map((p) => p.solde)))
  const [yMin, yMax] = [ticks[0], ticks.at(-1)!]
  const zoneL = largeur - MARGE.gauche - MARGE.droite
  const zoneH = HAUTEUR - MARGE.haut - MARGE.bas
  const x = (i: number) => MARGE.gauche + (i / Math.max(1, points.length - 1)) * zoneL
  const y = (v: number) => MARGE.haut + ((yMax - v) / (yMax - yMin)) * zoneH

  const trace = (debut: number, fin: number) =>
    points
      .slice(debut, fin + 1)
      .map((p, k) => `${k === 0 ? 'M' : 'L'}${x(debut + k).toFixed(1)},${y(p.solde).toFixed(1)}`)
      .join(' ')
  const aire = `${trace(0, points.length - 1)} L${x(points.length - 1)},${y(Math.max(yMin, 0))} L${x(0)},${y(Math.max(yMin, 0))} Z`

  // Repères de mois sur l'axe horizontal
  const debutsMois = points.flatMap((p, i) => (p.date.endsWith('-01') ? [i] : []))
  const fin = points.at(-1)
  const minimumProjete = projection.reduce((m, p) => (p.solde < m.solde ? p : m), projection[0])

  function suivre(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (points.length - 1))
    setSurvol(Math.max(0, Math.min(points.length - 1, i)))
  }
  const point = survol !== null ? points[survol] : null

  return (
    <figure className="graphe" ref={ref}>
      <svg width={largeur} height={HAUTEUR} role="img" aria-label={titre}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(t)} y2={y(t)} className={t === 0 ? 'axe-zero' : 'grille'} />
            <text x={MARGE.gauche - 8} y={y(t)} className="graduation" textAnchor="end" dominantBaseline="middle">
              {euroCompact(t)}
            </text>
          </g>
        ))}
        {debutsMois.map((i) => (
          <text key={i} x={x(i)} y={HAUTEUR - 8} className="graduation" textAnchor="middle">
            {depuisIso(points[i].date).toLocaleDateString('fr-FR', { month: 'short' })}
          </text>
        ))}

        <path d={aire} className="aire-solde" />
        <path d={trace(0, indexAujourdhui)} className="ligne-solde" />
        <path d={trace(indexAujourdhui, points.length - 1)} className="ligne-solde projetee" />

        {/* aujourd'hui */}
        <line x1={x(indexAujourdhui)} x2={x(indexAujourdhui)} y1={MARGE.haut} y2={HAUTEUR - MARGE.bas} className="repere" />
        <text x={x(indexAujourdhui) + 4} y={MARGE.haut + 4} className="graduation" dominantBaseline="hanging">
          aujourd'hui
        </text>

        {/* étiquette de fin : la valeur projetée à 90 jours */}
        {fin && (
          <>
            <circle cx={x(points.length - 1)} cy={y(fin.solde)} r={4} className="point-solde" />
            <text x={x(points.length - 1) + 8} y={y(fin.solde)} className="etiquette" dominantBaseline="middle">
              {euroCompact(fin.solde)}
            </text>
          </>
        )}
        {minimumProjete && minimumProjete.solde < (fin?.solde ?? 0) && (
          <circle
            cx={x(indexAujourdhui + projection.indexOf(minimumProjete))}
            cy={y(minimumProjete.solde)}
            r={4}
            className="point-solde"
          />
        )}

        {point && survol !== null && (
          <>
            <line x1={x(survol)} x2={x(survol)} y1={MARGE.haut} y2={HAUTEUR - MARGE.bas} className="viseur" />
            <circle cx={x(survol)} cy={y(point.solde)} r={4} className="point-solde" />
          </>
        )}
        <rect
          x={MARGE.gauche}
          y={MARGE.haut}
          width={zoneL}
          height={zoneH}
          fill="transparent"
          onPointerMove={suivre}
          onPointerLeave={() => setSurvol(null)}
        />
      </svg>
      {point && survol !== null && (
        <div className="infobulle" style={{ left: Math.min(x(survol) + 10, largeur - 190), top: 8 }}>
          <strong>{formaterEuros(point.solde)}</strong>
          <span>{depuisIso(point.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          {survol > indexAujourdhui && <span>Projection</span>}
        </div>
      )}
      <figcaption className="secondaire">
        Trait plein : solde passé. Pointillé : projection (récurrences et, si la case est cochée, dépenses courantes).
        {minimumProjete && ` Point le plus bas prévu : ${formaterEuros(minimumProjete.solde)} le ${depuisIso(minimumProjete.date).toLocaleDateString('fr-FR')}.`}
      </figcaption>
      <details className="donnees-graphe">
        <summary>Voir les données</summary>
        <table className="tableau">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col" className="droite">
                Solde
              </th>
              <th scope="col">Nature</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.date}>
                <td>{depuisIso(p.date).toLocaleDateString('fr-FR')}</td>
                <td className="droite">{formaterEuros(p.solde)}</td>
                <td>{i > indexAujourdhui ? 'Projection' : 'Réel'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
