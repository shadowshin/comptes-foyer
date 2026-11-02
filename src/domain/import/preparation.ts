// Prépare un import : rattache chaque opération lue à un compte, écarte les doublons
// et les opérations antérieures au solde initial, classe les opérations (choix manuel,
// sinon règle, sinon défaut), reconnaît les virements internes et contrôle les soldes.
// Tout est calculé ici sans accès à la base, pour être testé et pour l'aperçu avant import.

import { ajouterJours } from '../dates'
import { somme } from '../montants'
import type { Compte, Transaction } from '../types'
import { normaliserTexte } from './csv'
import {
  classementDeRegle,
  classementParDefaut,
  modeDepuisBanque,
  ressembleAUnVirement,
  trouverRegle,
  type Classement,
  type Regle,
} from './regles'
import type { Banque, OperationBancaire, Releve } from './types'

export type StatutLigne = 'nouvelle' | 'doublon' | 'avant_solde' | 'bloc_ignore' | 'exclue'

export interface LignePreparee {
  empreinte: string
  banque: Banque
  cleImport: string
  compteId: string | null
  operation: OperationBancaire
  statut: StatutLigne
  classement: Classement
  origine: 'manuel' | 'regle' | 'defaut' | 'virement'
  regle: Regle | null
  // l'autre moitié d'un virement interne : une ligne de cet import ou une opération déjà en base
  paire: { empreinte: string } | { transactionId: string } | null
  // virement vers un compte jamais importé (placement) : l'appli crée l'entrée sur ce compte
  contrepartieCreee: boolean
}

export interface ControleSolde {
  cleImport: string
  titre: string
  compteId: string
  date: string
  soldeBanque: number
  soldeCalcule: number
  ecart: number
}

export interface EntreePreparation {
  releves: Releve[]
  // cleImport → compte de l'appli, ou null pour ignorer le bloc
  rattachements: Record<string, string | null>
  comptes: Compte[]
  existantes: Transaction[]
  regles: Regle[]
  choixManuels: Record<string, Classement>
  exclues: ReadonlySet<string>
}

// Écart de dates toléré entre les deux moitiés d'un virement (week-end, banques différentes)
const DELAI_VIREMENT_JOURS = 3

export function calculerEmpreinte(cleImport: string, op: OperationBancaire, rang: number): string {
  return [cleImport, op.date, Math.round(op.montant * 100), normaliserTexte(op.detail), rang].join('|')
}

function ecartJours(a: string, b: string): number {
  if (a > b) [a, b] = [b, a]
  let jours = 0
  for (let d = a; d < b && jours <= DELAI_VIREMENT_JOURS; d = ajouterJours(d, 1)) jours++
  return jours
}

export function preparerImport(e: EntreePreparation): { lignes: LignePreparee[]; controles: ControleSolde[] } {
  const comptesParId = new Map(e.comptes.map((c) => [c.id, c]))
  const empreintesConnues = new Set(e.existantes.map((t) => t.empreinte_import).filter(Boolean))
  const vues = new Set<string>()
  const lignes: LignePreparee[] = []

  // 1. Lecture, rattachement, doublons et classement initial
  for (const releve of e.releves) {
    for (const bloc of releve.blocs) {
      const compteId = e.rattachements[bloc.cleImport] ?? null
      const compte = compteId ? comptesParId.get(compteId) : undefined
      const rangs = new Map<string, number>()

      for (const op of bloc.operations) {
        const base = calculerEmpreinte(bloc.cleImport, op, 0)
        const rang = rangs.get(base) ?? 0
        rangs.set(base, rang + 1)
        const empreinte = calculerEmpreinte(bloc.cleImport, op, rang)

        let statut: StatutLigne = 'nouvelle'
        if (!compte) statut = 'bloc_ignore'
        else if (empreintesConnues.has(empreinte) || vues.has(empreinte)) statut = 'doublon'
        else if (op.date < compte.date_solde_initial) statut = 'avant_solde'
        else if (e.exclues.has(empreinte)) statut = 'exclue'
        vues.add(empreinte)

        const manuel = e.choixManuels[empreinte]
        const regle = manuel ? null : trouverRegle(op, e.regles)
        lignes.push({
          empreinte,
          banque: bloc.banque,
          cleImport: bloc.cleImport,
          compteId: compte?.id ?? null,
          operation: op,
          statut,
          classement: manuel ?? (regle ? classementDeRegle(regle) : classementParDefaut(op)),
          origine: manuel ? 'manuel' : regle ? 'regle' : 'defaut',
          regle,
          paire: null,
          contrepartieCreee: false,
        })
      }
    }
  }

  // 2. Virements internes : deux opérations de montants opposés, sur deux comptes du
  //    foyer, à quelques jours d'écart, qui ressemblent à des virements
  const nouvelles = lignes.filter((l) => l.statut === 'nouvelle')
  const estCandidate = (l: LignePreparee) =>
    l.origine === 'manuel' ? l.classement.type === 'virement_interne' : l.classement.type === 'virement_interne' || ressembleAUnVirement(l.operation)
  type Candidat = { cle: string; compteId: string; date: string; centimes: number; ligne?: LignePreparee }
  const candidats: Candidat[] = [
    ...nouvelles.filter(estCandidate).map((l) => ({
      cle: l.empreinte,
      compteId: l.compteId!,
      date: l.operation.date,
      centimes: Math.round(l.operation.montant * 100),
      ligne: l,
    })),
    ...e.existantes
      .filter(
        (t) =>
          !t.transfert_id &&
          (t.type === 'virement_interne' || /\bVIR\b|VIREMENT/.test(normaliserTexte(`${t.libelle} ${t.description ?? ''}`))),
      )
      .map((t) => ({ cle: `db:${t.id}`, compteId: t.compte_id, date: t.date_operation, centimes: Math.round(t.montant * 100) })),
  ]

  const couples: { a: Candidat; b: Candidat; ecart: number }[] = []
  for (let i = 0; i < candidats.length; i++) {
    for (let j = i + 1; j < candidats.length; j++) {
      const [a, b] = [candidats[i], candidats[j]]
      if (!a.ligne && !b.ligne) continue
      if (a.compteId === b.compteId || a.centimes + b.centimes !== 0) continue
      const ecart = ecartJours(a.date, b.date)
      if (ecart <= DELAI_VIREMENT_JOURS) couples.push({ a, b, ecart })
    }
  }
  couples.sort((x, y) => x.ecart - y.ecart)
  const appariees = new Set<string>()
  for (const { a, b } of couples) {
    if (appariees.has(a.cle) || appariees.has(b.cle)) continue
    appariees.add(a.cle)
    appariees.add(b.cle)
    for (const [moi, autre] of [
      [a, b],
      [b, a],
    ]) {
      if (!moi.ligne) continue
      moi.ligne.paire = autre.ligne ? { empreinte: autre.cle } : { transactionId: autre.cle.slice(3) }
      moi.ligne.classement = { type: 'virement_interne', categorieId: null, compteCibleId: autre.compteId }
      if (moi.ligne.origine === 'defaut') moi.ligne.origine = 'virement'
    }
  }

  // 3. Virement vers un compte jamais importé (placement) : on crée l'autre moitié,
  //    sauf si le versement est antérieur au solde initial du placement, qui l'inclut déjà
  const comptesImportes = new Set(Object.values(e.rattachements).filter(Boolean))
  for (const l of nouvelles) {
    const cible = l.classement.compteCibleId ? comptesParId.get(l.classement.compteCibleId) : undefined
    l.contrepartieCreee =
      l.classement.type === 'virement_interne' &&
      !l.paire &&
      !!cible &&
      cible.id !== l.compteId &&
      !cible.cle_import &&
      !comptesImportes.has(cible.id) &&
      l.operation.date >= cible.date_solde_initial
  }

  // 4. Contrôle des soldes indiqués par la banque
  const controles: ControleSolde[] = []
  for (const releve of e.releves) {
    for (const bloc of releve.blocs) {
      const compte = comptesParId.get(e.rattachements[bloc.cleImport] ?? '')
      if (!bloc.solde || !compte || bloc.solde.date < compte.date_solde_initial) continue
      const dansPeriode = (date: string) => date >= compte.date_solde_initial && date <= bloc.solde!.date
      const soldeCalcule = somme([
        compte.solde_initial,
        ...e.existantes.filter((t) => t.compte_id === compte.id && dansPeriode(t.date_operation)).map((t) => t.montant),
        ...nouvelles
          .filter((l) => l.compteId === compte.id && dansPeriode(l.operation.date))
          .map((l) => l.operation.montant),
      ])
      controles.push({
        cleImport: bloc.cleImport,
        titre: bloc.titre,
        compteId: compte.id,
        date: bloc.solde.date,
        soldeBanque: bloc.solde.montant,
        soldeCalcule,
        ecart: somme([bloc.solde.montant, -soldeCalcule]),
      })
    }
  }

  return { lignes, controles }
}

export type LigneAInserer = Omit<Transaction, 'id' | 'recurrence_id'>
// Une opération déjà en base devient l'autre moitié d'un virement importé
export interface MiseAJourVirement {
  id: string
  transfert_id: string
  type: 'virement_interne'
  categorie_id: null
}

// Transforme les lignes retenues en opérations à enregistrer
export function construireImport(
  lignes: LignePreparee[],
  genererId: () => string = () => crypto.randomUUID(),
): { insertions: LigneAInserer[]; misesAJour: MiseAJourVirement[] } {
  const insertions: LigneAInserer[] = []
  const misesAJour: MiseAJourVirement[] = []
  const transfertParEmpreinte = new Map<string, string>()

  for (const l of lignes) {
    if (l.statut !== 'nouvelle') continue
    let transfertId: string | null = null
    if (l.paire && 'empreinte' in l.paire) {
      transfertId = transfertParEmpreinte.get(l.paire.empreinte) ?? genererId()
      transfertParEmpreinte.set(l.empreinte, transfertId)
    } else if (l.paire) {
      transfertId = genererId()
      misesAJour.push({ id: l.paire.transactionId, transfert_id: transfertId, type: 'virement_interne', categorie_id: null })
    } else if (l.contrepartieCreee) {
      transfertId = genererId()
    }

    const virement = l.classement.type === 'virement_interne'
    const ligne: LigneAInserer = {
      compte_id: l.compteId!,
      date_operation: l.operation.date,
      libelle: l.operation.libelle,
      description: l.operation.detail,
      type: l.classement.type,
      categorie_id: virement ? null : l.classement.categorieId,
      montant: l.operation.montant,
      mode_paiement: modeDepuisBanque(l.operation.typeBanque),
      notes: null,
      transfert_id: transfertId,
      source: l.banque === 'CA' ? 'import_ca' : 'import_ce',
      empreinte_import: l.empreinte,
    }
    insertions.push(ligne)

    if (l.contrepartieCreee) {
      insertions.push({
        ...ligne,
        compte_id: l.classement.compteCibleId!,
        montant: -l.operation.montant,
        mode_paiement: null,
        empreinte_import: `${l.empreinte}|contrepartie`,
      })
    }
  }
  return { insertions, misesAJour }
}
