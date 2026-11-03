// Alertes calculées à la volée à partir des données : rien n'est stocké, une alerte
// disparaît d'elle-même quand sa cause disparaît. Toujours sur le foyer entier.

import { depensesParCategorie, suiviBudgets } from './budgets'
import { ajouterJours, ajouterMois, dateDuMois, depuisIso, finDuMois, moisCompletsAvant } from './dates'
import { formaterEuros, somme } from './montants'
import { occurrences } from './recurrences'
import { depenseCouranteQuotidienne, projeter, revenusEtDepenses } from './tresorerie'
import type { Budget, Categorie, Compte, CompteMembre, Membre, Parametres, Recurrence, Transaction } from './types'

export type NiveauAlerte = 'critique' | 'avertissement' | 'info'
export type SujetAlerte = 'solde' | 'budget' | 'revenus' | 'echeance' | 'placement'

export interface Alerte {
  id: string
  niveau: NiveauAlerte
  sujet: SujetAlerte
  // date de l'événement concerné, pour trier les alertes d'un même niveau
  date: string
  titre: string
  detail: string
  action: string
}

export interface DonneesAlertes {
  membres: Membre[]
  comptes: Compte[]
  comptesMembres: CompteMembre[]
  categories: Categorie[]
  transactions: Transaction[]
  recurrences: Recurrence[]
  budgets: Budget[]
  parametres: Parametres
  aujourdhui: string
}

const ORDRE_NIVEAU: Record<NiveauAlerte, number> = { critique: 0, avertissement: 1, info: 2 }
const HORIZON_SOLDE = 30
const HISTORIQUE_DEPENSES = 90
const MOIS_REFERENCE_REVENUS = 6

const jourMois = (iso: string) => depuisIso(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
const nomMois = (iso: string) => depuisIso(iso).toLocaleDateString('fr-FR', { month: 'long' })
const arrondiDizaineSup = (montant: number) => Math.ceil(montant / 10) * 10

// « Compte de dépôt · CA (Sabrina) » : deux membres ont souvent un compte du même nom
export function libelleCompte(compte: Compte, membres: Membre[], comptesMembres: CompteMembre[]): string {
  const titulaires = comptesMembres
    .filter((cm) => cm.compte_id === compte.id)
    .map((cm) => membres.find((m) => m.id === cm.membre_id)?.nom)
    .filter(Boolean)
  return `${compte.nom} · ${compte.banque}${titulaires.length ? ` (${titulaires.join(' et ')})` : ''}`
}

// Point bas de chaque compte courant sur 30 jours, avec ses récurrences et ses dépenses
// courantes estimées (même calcul que la projection de la page Trésorerie)
function alertesSolde(d: DonneesAlertes): Alerte[] {
  const { seuil_critique, seuil_avertissement } = d.parametres
  return d.comptes
    .filter((c) => c.actif && c.nature === 'courant')
    .flatMap((compte): Alerte[] => {
      const debut = [ajouterJours(d.aujourdhui, -HISTORIQUE_DEPENSES), compte.date_solde_initial].sort().at(-1)!
      const depenseQuotidienne = depenseCouranteQuotidienne([compte], d.transactions, debut, d.aujourdhui)
      const { points } = projeter([compte], d.transactions, d.recurrences, d.aujourdhui, HORIZON_SOLDE, depenseQuotidienne)
      const pointBas = points.reduce((bas, p) => (p.solde < bas.solde ? p : bas))
      const critique = pointBas.solde < seuil_critique
      if (!critique && pointBas.solde >= seuil_avertissement) return []

      const nom = libelleCompte(compte, d.membres, d.comptesMembres)
      const manque = arrondiDizaineSup(somme([Math.max(seuil_avertissement, seuil_critique), -pointBas.solde]))
      return [
        {
          id: `solde-${compte.id}`,
          niveau: critique ? 'critique' : 'avertissement',
          sujet: 'solde',
          date: pointBas.date,
          titre: critique
            ? `${nom} : découvert prévu sous ${HORIZON_SOLDE} jours`
            : `${nom} : solde prévu sous le coussin de ${formaterEuros(seuil_avertissement)}`,
          detail:
            `Point bas prévu le ${jourMois(pointBas.date)} : ${formaterEuros(pointBas.solde)} ` +
            `(aujourd'hui : ${formaterEuros(points[0].solde)}). Projection avec les récurrences et ` +
            `${formaterEuros(depenseQuotidienne)} de dépenses courantes par jour.`,
          action: `Virer au moins ${formaterEuros(manque)} sur ce compte avant le ${jourMois(pointBas.date)}, ou décaler une dépense.`,
        },
      ]
    })
}

function alertesBudget(d: DonneesAlertes): Alerte[] {
  const debut = dateDuMois(d.aujourdhui, 1)
  const fin = finDuMois(d.aujourdhui)
  const joursRestants = Math.round((depuisIso(fin).getTime() - depuisIso(d.aujourdhui).getTime()) / 86_400_000)
  const depenses = depensesParCategorie(
    d.comptes.filter((c) => c.actif),
    d.transactions,
    debut,
    d.aujourdhui,
  )
  return suiviBudgets(d.categories, d.budgets, depenses, d.parametres.alerte_budget_pct)
    .filter((l) => l.etat === 'proche' || l.etat === 'depasse')
    .map((l): Alerte => {
      const budget = l.budget!.montant_mensuel
      const depasse = l.etat === 'depasse'
      return {
        id: `budget-${l.categorie.id}`,
        niveau: 'avertissement',
        sujet: 'budget',
        date: d.aujourdhui,
        titre: depasse
          ? `Budget ${l.categorie.nom} dépassé`
          : `Budget ${l.categorie.nom} à ${Math.floor(l.ratio! * 100)} %`,
        detail: `${formaterEuros(l.reel)} dépensés sur ${formaterEuros(budget)} en ${nomMois(debut)}, ${joursRestants} jour(s) avant la fin du mois.`,
        action: depasse
          ? `Dépassement de ${formaterEuros(somme([l.reel, -budget]))} : limiter cette catégorie jusqu'à la fin du mois, ou relever le budget s'il est trop bas.`
          : `Il reste ${formaterEuros(somme([budget, -l.reel]))} pour finir le mois.`,
      }
    })
}

// Revenus du dernier mois complet comparés à la moyenne des 6 mois complets précédents.
// Le mois en cours n'est pas jugé : en début de mois, il serait toujours en baisse.
function alertesRevenus(d: DonneesAlertes): Alerte[] {
  const comptes = d.comptes.filter((c) => c.actif)
  const ids = new Set(comptes.map((c) => c.id))
  const debutHistorique = d.transactions
    .filter((t) => ids.has(t.compte_id))
    .map((t) => t.date_operation)
    .sort()[0]
  const dernierMois = ajouterMois(dateDuMois(d.aujourdhui, 1), -1)
  if (!debutHistorique || dernierMois < debutHistorique) return []

  const reference = moisCompletsAvant(dernierMois, MOIS_REFERENCE_REVENUS, debutHistorique)
  if (reference.length === 0) return []
  const revenus = (debut: string) => revenusEtDepenses(comptes, d.transactions, debut, finDuMois(debut)).revenus
  const moyenne = Math.round((somme(reference.map(revenus)) / reference.length) * 100) / 100
  const constate = revenus(dernierMois)
  if (moyenne <= 0 || constate >= moyenne * (1 - d.parametres.baisse_revenus_pct / 100)) return []

  const baisse = Math.round((1 - constate / moyenne) * 100)
  return [
    {
      id: `revenus-${dernierMois}`,
      niveau: 'avertissement',
      sujet: 'revenus',
      date: dernierMois,
      titre: `Revenus de ${nomMois(dernierMois)} en baisse de ${baisse} %`,
      detail: `${formaterEuros(constate)} contre ${formaterEuros(moyenne)} en moyenne sur ${reference.length} mois précédent(s).`,
      action: `Vérifier qu'aucun versement n'a été oublié ou mal classé (salaire, ARE, remboursement), et revoir les budgets si la baisse dure.`,
    },
  ]
}

// Sorties récurrentes des prochains jours (prélèvements, versements vers l'épargne)
function alertesEcheances(d: DonneesAlertes): Alerte[] {
  const comptesActifs = new Map(d.comptes.filter((c) => c.actif).map((c) => [c.id, c]))
  const du = ajouterJours(d.aujourdhui, 1)
  const au = ajouterJours(d.aujourdhui, d.parametres.delai_echeance_jours)
  return d.recurrences
    .filter((r) => r.montant < 0 && comptesActifs.has(r.compte_id))
    .flatMap((r) =>
      occurrences(r, du, au).map(
        (date): Alerte => ({
          id: `echeance-${r.id}-${date}`,
          niveau: 'info',
          sujet: 'echeance',
          date,
          titre: `${r.libelle} le ${jourMois(date)}`,
          detail: `${formaterEuros(r.montant)} sur ${libelleCompte(comptesActifs.get(r.compte_id)!, d.membres, d.comptesMembres)}.`,
          action: 'Vérifier que le compte sera assez approvisionné ce jour-là.',
        }),
      ),
    )
}

function alertesPlacements(d: DonneesAlertes): Alerte[] {
  const limite = ajouterJours(d.aujourdhui, d.parametres.delai_placement_jours)
  return d.comptes
    .filter((c) => c.actif && c.date_echeance && c.date_echeance >= d.aujourdhui && c.date_echeance <= limite)
    .map((c): Alerte => ({
      id: `placement-${c.id}`,
      niveau: 'info',
      sujet: 'placement',
      date: c.date_echeance!,
      titre: `${libelleCompte(c, d.membres, d.comptesMembres)} arrive à échéance le ${jourMois(c.date_echeance!)}`,
      detail: 'Les fonds redeviennent disponibles à cette date.',
      action: 'Décider du réemploi (livret, nouveau placement) et mettre à jour le compte dans Paramètres.',
    }))
}

export function calculerAlertes(d: DonneesAlertes): Alerte[] {
  return [...alertesSolde(d), ...alertesBudget(d), ...alertesRevenus(d), ...alertesEcheances(d), ...alertesPlacements(d)].sort(
    (a, b) => ORDRE_NIVEAU[a.niveau] - ORDRE_NIVEAU[b.niveau] || a.date.localeCompare(b.date),
  )
}
