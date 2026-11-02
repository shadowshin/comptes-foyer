import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { SelectClassement } from '../components/SelectClassement'
import { depuisIso } from '../domain/dates'
import { decoderFichier } from '../domain/import/csv'
import { lireReleve } from '../domain/import/lireReleve'
import { construireImport, preparerImport, type LignePreparee, type StatutLigne } from '../domain/import/preparation'
import { suggererMotif, type Classement, type Regle } from '../domain/import/regles'
import type { Releve } from '../domain/import/types'
import { classementDepuisValeur, valeurClassement } from '../domain/import/valeurClassement'
import { formaterEuros, somme } from '../domain/montants'
import { importerReleves, lireReferentiel, lireRegles, lireTransactions, modifierSoldeInitial } from '../lib/donnees'
import { useChargement } from '../lib/useChargement'
import { useEtatSession } from '../lib/useEtatSession'

type Vue = 'a_categoriser' | 'nouvelles' | 'ecartees'

const LIBELLES_ECARTEES: Partial<Record<StatutLigne, string>> = {
  doublon: 'Déjà importée',
  avant_solde: 'Antérieure au solde initial',
  bloc_ignore: 'Compte ignoré',
}

// Rattachement d'un bloc : le choix fait dans cet import, sinon celui mémorisé lors d'un
// import précédent ; undefined tant que rien n'est choisi
function rattachementDe(
  cleImport: string,
  choix: Record<string, string | null>,
  comptes: { id: string; cle_import: string | null }[],
): string | null | undefined {
  return cleImport in choix ? choix[cleImport] : comptes.find((c) => c.cle_import === cleImport)?.id
}

const aCategoriser = (l: LignePreparee) =>
  l.statut === 'nouvelle' &&
  (l.classement.type === 'virement_interne' ? !l.paire && !l.classement.compteCibleId : !l.classement.categorieId)

export function Import() {
  const referentiel = useChargement(lireReferentiel)
  const existantes = useChargement(lireTransactions)
  const regles = useChargement(lireRegles)

  // L'import en cours est conservé dans l'onglet : un rafraîchissement ou un passage
  // par une autre page ne fait pas perdre les fichiers et les choix déjà faits
  const [releves, setReleves] = useEtatSession<Releve[]>('import.releves', [])
  const [erreursFichiers, setErreursFichiers] = useState<string[]>([])
  // choix fait dans cet import ; absent = pas encore choisi
  const [rattachements, setRattachements] = useEtatSession<Record<string, string | null>>('import.rattachements', {})
  const [choixManuels, setChoixManuels] = useEtatSession<Record<string, Classement>>('import.choix', {})
  const [listeExclues, setListeExclues] = useEtatSession<string[]>('import.exclues', [])
  const exclues = useMemo(() => new Set(listeExclues), [listeExclues])
  const [nouvellesRegles, setNouvellesRegles] = useEtatSession<Regle[]>('import.regles', [])
  const [motifEnCours, setMotifEnCours] = useState<{ empreinte: string; motif: string } | null>(null)
  const [vue, setVue] = useEtatSession<Vue>('import.vue', 'nouvelles')
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Catégories, comptes ou règles créés dans un autre onglet pendant l'import :
  // on les relit au retour sur cet onglet, sans perdre les fichiers ni les choix en cours
  const rechargerReferentiel = referentiel.recharger
  const rechargerRegles = regles.recharger
  useEffect(() => {
    const auRetour = () => {
      if (document.visibilityState === 'visible') {
        rechargerReferentiel()
        rechargerRegles()
      }
    }
    document.addEventListener('visibilitychange', auRetour)
    return () => document.removeEventListener('visibilitychange', auRetour)
  }, [rechargerReferentiel, rechargerRegles])

  const comptes = referentiel.donnee?.comptes ?? []
  const blocs = releves.flatMap((r) => r.blocs)

  const rattachementEffectif = (cleImport: string) => rattachementDe(cleImport, rattachements, comptes)

  const preparation = useMemo(() => {
    if (!referentiel.donnee || !existantes.donnee || !regles.donnee) return null
    const { comptes } = referentiel.donnee
    return preparerImport({
      releves,
      rattachements: Object.fromEntries(
        releves.flatMap((r) => r.blocs).map((b) => [b.cleImport, rattachementDe(b.cleImport, rattachements, comptes) ?? null]),
      ),
      comptes,
      existantes: existantes.donnee,
      regles: [...regles.donnee, ...nouvellesRegles],
      choixManuels,
      exclues,
    })
  }, [releves, rattachements, referentiel.donnee, existantes.donnee, regles.donnee, nouvellesRegles, choixManuels, exclues])

  const erreur = referentiel.erreur ?? existantes.erreur ?? regles.erreur
  if (erreur) return <p className="message-erreur">Impossible de préparer l'import : {erreur}</p>
  if (!referentiel.donnee || !preparation) return <p className="chargement">Chargement…</p>
  const ref = referentiel.donnee

  async function ajouterFichiers(e: ChangeEvent<HTMLInputElement>) {
    const fichiers = [...(e.target.files ?? [])]
    e.target.value = ''
    const lus: Releve[] = []
    const erreurs: string[] = []
    for (const fichier of fichiers) {
      if (releves.some((r) => r.nomFichier === fichier.name)) continue
      try {
        lus.push(lireReleve(fichier.name, decoderFichier(await fichier.arrayBuffer())))
      } catch (err) {
        erreurs.push((err as Error).message)
      }
    }
    setReleves((r) => [...r, ...lus])
    setErreursFichiers(erreurs)
    setMessage(null)
  }

  function choisirClassement(ligne: LignePreparee, valeur: string) {
    const classement = classementDepuisValeur(valeur, ref.categories)
    setChoixManuels(({ [ligne.empreinte]: _ancien, ...autres }) =>
      classement ? { ...autres, [ligne.empreinte]: classement } : autres,
    )
  }

  function creerRegle(ligne: LignePreparee, motif: string) {
    const c = ligne.classement
    setNouvellesRegles((r) => [
      ...r,
      {
        id: `nouvelle-${r.length}`,
        motif: motif.trim(),
        type: c.type,
        categorie_id: c.categorieId,
        compte_cible_id: c.compteCibleId,
        priorite: 0,
      },
    ])
    // la règle s'applique désormais à cette ligne et aux suivantes
    setChoixManuels(({ [ligne.empreinte]: _ancien, ...autres }) => autres)
    setMotifEnCours(null)
  }

  function basculerExclusion(empreinte: string) {
    setListeExclues((ex) => (ex.includes(empreinte) ? ex.filter((x) => x !== empreinte) : [...ex, empreinte]))
  }

  function reinitialiser() {
    setReleves([])
    setRattachements({})
    setChoixManuels({})
    setListeExclues([])
    setNouvellesRegles([])
    setVue('nouvelles')
    setErreursFichiers([])
  }

  const lignes = preparation.lignes
  const nouvelles = lignes.filter((l) => l.statut === 'nouvelle')
  const compter = (statut: StatutLigne) => lignes.filter((l) => l.statut === statut).length
  const nonRattaches = blocs.filter((b) => rattachementEffectif(b.cleImport) === undefined)
  const nbACategoriser = lignes.filter(aCategoriser).length
  const nomCompte = new Map(comptes.map((c) => [c.id, c.nom]))

  const lignesVue = lignes
    .filter((l) =>
      vue === 'a_categoriser'
        ? aCategoriser(l)
        : vue === 'nouvelles'
          ? l.statut === 'nouvelle' || l.statut === 'exclue'
          : l.statut in LIBELLES_ECARTEES,
    )
    .sort((a, b) => b.operation.date.localeCompare(a.operation.date))

  // Le solde initial devient celui qui fait concorder l'appli avec la banque
  async function ajusterSoldeInitial(compteId: string, ecart: number) {
    const compte = comptes.find((c) => c.id === compteId)
    if (!compte) return
    const nouveau = somme([compte.solde_initial, ecart])
    const message = `Passer le solde initial de « ${compte.nom} » de ${formaterEuros(compte.solde_initial)} à ${formaterEuros(nouveau)} ?`
    if (!window.confirm(message)) return
    try {
      await modifierSoldeInitial(compteId, nouveau)
      await referentiel.recharger()
    } catch (err) {
      setMessage(`Erreur : ${(err as Error).message}`)
    }
  }

  async function importer() {
    const { insertions, misesAJour } = construireImport(lignes)
    const aMemoriser = Object.fromEntries(
      blocs.flatMap((b) => {
        const id = rattachementEffectif(b.cleImport)
        return id ? [[b.cleImport, id]] : []
      }),
    )
    setEnvoi(true)
    setMessage(null)
    try {
      await importerReleves({
        insertions,
        misesAJour,
        rattachements: aMemoriser,
        nouvellesRegles: nouvellesRegles.map(({ id: _id, ...r }) => r),
      })
      setMessage(`${insertions.length} opération(s) importée(s), ${misesAJour.length} virement(s) relié(s) à une opération existante.`)
      reinitialiser()
      await Promise.all([referentiel.recharger(), existantes.recharger(), regles.recharger()])
    } catch (err) {
      setMessage(`Erreur : ${(err as Error).message}`)
    }
    setEnvoi(false)
  }

  return (
    <>
      <h1>Importer des relevés</h1>

      <section className="carte">
        <h2>1. Fichiers</h2>
        <p className="secondaire">
          Exports CSV du Crédit Agricole (un fichier pour tous les comptes) ou de la Caisse d'Épargne (un fichier par
          compte). Les fichiers sont lus dans ton navigateur ; seules les opérations retenues sont enregistrées.
        </p>
        <label className="bouton-principal bouton-fichier">
          Choisir des fichiers CSV
          <input type="file" accept=".csv,text/csv" multiple onChange={ajouterFichiers} />
        </label>
        {erreursFichiers.map((e) => (
          <p key={e} className="message-erreur" role="alert">
            {e}
          </p>
        ))}
        {releves.length > 0 && (
          <ul className="liste-fichiers">
            {releves.map((r) => (
              <li key={r.nomFichier}>
                {r.banque === 'CA' ? 'Crédit Agricole' : "Caisse d'Épargne"} · {r.nomFichier} ·{' '}
                {r.blocs.reduce((n, b) => n + b.operations.length, 0)} opération(s)
                <button
                  type="button"
                  className="bouton-icone"
                  aria-label={`Retirer ${r.nomFichier}`}
                  onClick={() => setReleves((liste) => liste.filter((x) => x !== r))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {releves.length > 0 && (
          <p>
            <button
              type="button"
              className="bouton-discret"
              onClick={() => {
                if (window.confirm('Abandonner cet import ? Les fichiers et les choix faits seront oubliés.')) reinitialiser()
              }}
            >
              Abandonner cet import
            </button>
          </p>
        )}
        {message && (
          <p className="message-statut" role="status">
            {message} {!message.startsWith('Erreur') && <Link to="/transactions">Voir les transactions</Link>}
          </p>
        )}
      </section>

      {blocs.length > 0 && (
        <>
          <section className="carte">
            <h2>2. Comptes</h2>
            <p className="secondaire">
              Associe chaque compte du relevé à un compte de l'appli. Ce choix est mémorisé pour les prochains imports.
            </p>
            <ul className="liste-simple">
              {blocs.map((b) => {
                const choix = rattachementEffectif(b.cleImport)
                return (
                  <li key={b.cleImport} className="ligne-compte">
                    <span>
                      <strong>{b.titre}</strong>
                      <span className="secondaire">
                        {b.banque} · {b.operations.length} opération(s)
                        {b.solde && ` · solde banque ${formaterEuros(b.solde.montant)} au ${depuisIso(b.solde.date).toLocaleDateString('fr-FR')}`}
                      </span>
                    </span>
                    <select
                      aria-label={`Compte pour ${b.titre}`}
                      aria-invalid={choix === undefined}
                      value={choix === undefined ? '' : (choix ?? 'ignorer')}
                      onChange={(e) =>
                        setRattachements((r) => ({
                          ...r,
                          [b.cleImport]: e.target.value === 'ignorer' ? null : e.target.value,
                        }))
                      }
                    >
                      <option value="" disabled>
                        Choisir…
                      </option>
                      <option value="ignorer">Ignorer ce compte</option>
                      {comptes
                        .filter((c) => c.actif)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nom}
                          </option>
                        ))}
                    </select>
                  </li>
                )
              })}
            </ul>
          </section>

          {preparation.controles.length > 0 && (
            <section className="carte">
              <h2>3. Contrôle des soldes</h2>
              <p className="secondaire">Solde indiqué par la banque comparé au solde calculé par l'appli après cet import.</p>
              <ul className="liste-simple">
                {preparation.controles.map((c) => (
                  <li key={c.cleImport} className="ligne-compte">
                    <span>
                      <strong>{nomCompte.get(c.compteId)}</strong>
                      <span className="secondaire">
                        au {depuisIso(c.date).toLocaleDateString('fr-FR')} : banque {formaterEuros(c.soldeBanque)}, appli{' '}
                        {formaterEuros(c.soldeCalcule)}
                      </span>
                    </span>
                    {c.ecart === 0 ? (
                      <span className="montant">✓ Concordant</span>
                    ) : (
                      <span className="actions">
                        <span className="montant negatif">Écart de {formaterEuros(c.ecart)}</span>
                        <button type="button" className="bouton-discret" onClick={() => ajusterSoldeInitial(c.compteId, c.ecart)}>
                          Ajuster le solde initial
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {preparation.controles.some((c) => c.ecart !== 0) && (
                <p className="secondaire">
                  Un écart vient en général d'un solde initial ou d'une date de solde initial à corriger dans Paramètres,
                  ou d'une opération saisie à la main en double.
                </p>
              )}
            </section>
          )}

          <section className="carte">
            <h2>4. Opérations</h2>
            <p className="resume-tableau">
              <span>{nouvelles.length} à importer</span>
              <span>{compter('doublon')} déjà importée(s)</span>
              <span>{compter('avant_solde')} antérieure(s) au solde initial</span>
              <span>{nouvelles.filter((l) => l.paire).length} virement(s) apparié(s)</span>
              <span className={nbACategoriser > 0 ? 'a-categoriser' : ''}>{nbACategoriser} à catégoriser</span>
            </p>
            {compter('avant_solde') > 0 && (
              <p className="secondaire">
                {compter('avant_solde')} opération(s) sont antérieures à la date du solde initial de leur compte : ce
                solde les inclut déjà, elles ne sont donc pas importées. Pour garder l'historique, ramène la date du
                solde initial au début du relevé dans Paramètres, puis utilise « Ajuster le solde initial ».
              </p>
            )}
            <div className="onglets" role="tablist">
              {(
                [
                  ['nouvelles', 'À importer'],
                  ['a_categoriser', `À catégoriser (${nbACategoriser})`],
                  ['ecartees', 'Écartées'],
                ] as [Vue, string][]
              ).map(([valeur, libelle]) => (
                <button
                  key={valeur}
                  type="button"
                  role="tab"
                  aria-selected={vue === valeur}
                  className={vue === valeur ? 'onglet actif' : 'onglet'}
                  onClick={() => setVue(valeur)}
                >
                  {libelle}
                </button>
              ))}
            </div>

            {lignesVue.length === 0 ? (
              <p className="secondaire">Rien à afficher ici.</p>
            ) : (
              <div className="defilement-tableau">
                <table className="tableau">
                  <thead>
                    <tr>
                      {vue !== 'ecartees' && (
                        <th scope="col">
                          <span className="visuellement-cache">Importer</span>
                        </th>
                      )}
                      <th scope="col">Date</th>
                      <th scope="col">Compte</th>
                      <th scope="col">Libellé</th>
                      <th scope="col" className="droite">
                        Montant
                      </th>
                      <th scope="col">{vue === 'ecartees' ? 'Raison' : 'Classement'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesVue.map((l) => (
                      <tr key={l.empreinte} className={l.statut === 'exclue' ? 'archive' : undefined}>
                        {vue !== 'ecartees' && (
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Importer ${l.operation.libelle}`}
                              checked={l.statut === 'nouvelle'}
                              onChange={() => basculerExclusion(l.empreinte)}
                            />
                          </td>
                        )}
                        <td className="nowrap">{depuisIso(l.operation.date).toLocaleDateString('fr-FR')}</td>
                        <td>{l.compteId ? nomCompte.get(l.compteId) : '—'}</td>
                        <td title={l.operation.detail}>{l.operation.libelle}</td>
                        <td className={`droite montant${l.operation.montant < 0 ? ' negatif' : ''}`}>
                          {formaterEuros(l.operation.montant)}
                        </td>
                        <td>
                          {vue === 'ecartees' ? (
                            LIBELLES_ECARTEES[l.statut]
                          ) : (
                            <div className="classement">
                              <SelectClassement
                                aria-label={`Classement de ${l.operation.libelle}`}
                                valeur={valeurClassement(l.classement)}
                                categories={ref.categories}
                                comptes={comptes}
                                compteId={l.compteId}
                                onChange={(v) => choisirClassement(l, v)}
                              />
                              <span className="secondaire">
                                {l.paire
                                  ? 'Virement apparié automatiquement'
                                  : l.contrepartieCreee
                                    ? `Entrée créée sur ${nomCompte.get(l.classement.compteCibleId!)}`
                                    : l.origine === 'regle'
                                      ? `Règle « ${l.regle?.motif} »`
                                      : l.origine === 'manuel'
                                        ? 'Choix manuel'
                                        : ''}
                              </span>
                              {motifEnCours?.empreinte === l.empreinte ? (
                                <span className="ligne-ajout">
                                  <input
                                    type="text"
                                    aria-label="Motif de la règle"
                                    value={motifEnCours.motif}
                                    onChange={(e) => setMotifEnCours({ empreinte: l.empreinte, motif: e.target.value })}
                                  />
                                  <button
                                    type="button"
                                    className="bouton-discret"
                                    disabled={!motifEnCours.motif.trim()}
                                    onClick={() => creerRegle(l, motifEnCours.motif)}
                                  >
                                    Créer
                                  </button>
                                </span>
                              ) : (
                                l.origine === 'manuel' &&
                                !aCategoriser(l) && (
                                  <button
                                    type="button"
                                    className="lien"
                                    onClick={() => setMotifEnCours({ empreinte: l.empreinte, motif: suggererMotif(l.operation) })}
                                  >
                                    Retenir pour les libellés similaires
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="carte barre-import">
            {nonRattaches.length > 0 && (
              <p className="message-erreur">Associe d'abord {nonRattaches.length} compte(s) du relevé à l'étape 2.</p>
            )}
            {nouvellesRegles.length > 0 && (
              <p className="secondaire">{nouvellesRegles.length} nouvelle(s) règle(s) seront enregistrées.</p>
            )}
            <button
              type="button"
              className="bouton-principal"
              disabled={envoi || nonRattaches.length > 0 || nouvelles.length === 0}
              onClick={importer}
            >
              {envoi ? 'Import en cours…' : `Importer ${nouvelles.length} opération(s)`}
            </button>
          </section>
        </>
      )}
    </>
  )
}
