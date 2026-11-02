import { FILTRES_VIDES, type Filtres } from '../domain/filtres'
import { LIBELLES_TYPE, type TypeTransaction } from '../domain/types'
import type { Referentiel } from '../lib/donnees'

interface Props {
  referentiel: Referentiel
  filtres: Filtres
  onChange: (filtres: Filtres) => void
}

export function BarreFiltres({ referentiel, filtres, onChange }: Props) {
  const modifier = <K extends keyof Filtres>(champ: K, valeur: Filtres[K]) => onChange({ ...filtres, [champ]: valeur })
  const categories = referentiel.categories.filter((c) => !filtres.type || c.type === filtres.type)
  const actifs = Object.entries(filtres).some(([cle, valeur]) => valeur !== FILTRES_VIDES[cle as keyof Filtres])

  return (
    <section className="carte filtres" aria-label="Filtres">
      <label>
        Recherche
        <input
          type="search"
          placeholder="Libellé ou notes"
          value={filtres.recherche}
          onChange={(e) => modifier('recherche', e.target.value)}
        />
      </label>
      <label>
        Type
        <select
          value={filtres.type}
          onChange={(e) => onChange({ ...filtres, type: e.target.value as TypeTransaction | '', categorieId: '' })}
        >
          <option value="">Tous</option>
          {Object.entries(LIBELLES_TYPE).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
      </label>
      <label>
        Catégorie
        <select value={filtres.categorieId} onChange={(e) => modifier('categorieId', e.target.value)}>
          <option value="">Toutes</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
              {c.archivee ? ' (archivée)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        Membre
        <select value={filtres.membreId} onChange={(e) => modifier('membreId', e.target.value)}>
          <option value="">Foyer</option>
          {referentiel.membres.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
      </label>
      <label>
        Compte
        <select value={filtres.compteId} onChange={(e) => modifier('compteId', e.target.value)}>
          <option value="">Tous</option>
          {referentiel.comptes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </label>
      <label>
        Du
        <input type="date" value={filtres.du} onChange={(e) => modifier('du', e.target.value)} />
      </label>
      <label>
        Au
        <input type="date" value={filtres.au} onChange={(e) => modifier('au', e.target.value)} />
      </label>
      {actifs && (
        <button type="button" className="bouton-discret" onClick={() => onChange(FILTRES_VIDES)}>
          Effacer les filtres
        </button>
      )}
    </section>
  )
}
