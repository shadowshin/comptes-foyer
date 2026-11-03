// Budgets mensuels par catégorie de dépense : réel du mois, comparaison au budget,
// et proposition de budget à partir de la moyenne des mois passés.
// Les budgets sont définis pour le foyer ; en vue membre, on n'affiche que le réel.

import { finDuMois, moisCompletsAvant } from './dates'
import { somme } from './montants'
import type { Budget, Categorie, Compte, Transaction, TypeTransaction } from './types'

export const TYPES_BUDGET: Categorie['type'][] = ['depense_fixe', 'depense_variable', 'impot']

export type EtatBudget = 'sans_budget' | 'ok' | 'proche' | 'depasse'

export interface LigneBudget {
  categorie: Categorie
  budget: Budget | null
  reel: number
  // part du budget consommée (1 = 100 %), null sans budget
  ratio: number | null
  etat: EtatBudget
}

const estBudgetable = (type: TypeTransaction) => (TYPES_BUDGET as TypeTransaction[]).includes(type)

// Dépenses de la période par catégorie, en valeur positive (un remboursement saisi
// dans la même catégorie les diminue). Clé null : dépenses sans catégorie.
export function depensesParCategorie(
  comptes: Compte[],
  transactions: Transaction[],
  du: string,
  au: string,
): Map<string | null, number> {
  const ids = new Set(comptes.map((c) => c.id))
  const groupes = Map.groupBy(
    transactions.filter((t) => ids.has(t.compte_id) && estBudgetable(t.type) && t.date_operation >= du && t.date_operation <= au),
    (t) => t.categorie_id,
  )
  return new Map([...groupes].map(([cle, ts]) => [cle, 0 - somme(ts.map((t) => t.montant))]))
}

// Moyenne mensuelle des dépenses par catégorie sur les n derniers mois complets avant `date`.
// Un historique plus court que n mois donne une moyenne sur les mois disponibles.
export function moyennesMensuelles(
  comptes: Compte[],
  transactions: Transaction[],
  date: string,
  n: number,
): { moyennes: Map<string | null, number>; nbMois: number } {
  const ids = new Set(comptes.map((c) => c.id))
  const debutHistorique = transactions
    .filter((t) => ids.has(t.compte_id))
    .map((t) => t.date_operation)
    .sort()[0]
  const mois = debutHistorique ? moisCompletsAvant(date, n, debutHistorique) : []
  if (mois.length === 0) return { moyennes: new Map(), nbMois: 0 }

  const totaux = new Map<string | null, number>()
  for (const debut of mois) {
    for (const [cle, montant] of depensesParCategorie(comptes, transactions, debut, finDuMois(debut))) {
      totaux.set(cle, somme([totaux.get(cle) ?? 0, montant]))
    }
  }
  return {
    moyennes: new Map([...totaux].map(([cle, total]) => [cle, Math.round((total / mois.length) * 100) / 100])),
    nbMois: mois.length,
  }
}

// Budget proposé : la moyenne arrondie à la dizaine supérieure, pour garder un peu de marge
export function budgetPropose(moyenne: number): number | null {
  return moyenne > 0 ? Math.ceil(moyenne / 10) * 10 : null
}

export function etatBudget(reel: number, montantBudget: number, seuilPct: number): EtatBudget {
  const ratio = reel / montantBudget
  if (ratio >= 1) return 'depasse'
  if (ratio >= seuilPct / 100) return 'proche'
  return 'ok'
}

// Une ligne par catégorie de dépense active, plus les catégories archivées qui ont un
// budget ou des dépenses sur la période
export function suiviBudgets(
  categories: Categorie[],
  budgets: Budget[],
  depenses: Map<string | null, number>,
  seuilPct: number,
): LigneBudget[] {
  const budgetParCategorie = new Map(budgets.map((b) => [b.categorie_id, b]))
  return categories
    .filter((c) => TYPES_BUDGET.includes(c.type))
    .filter((c) => !c.archivee || budgetParCategorie.has(c.id) || depenses.has(c.id))
    .map((categorie) => {
      const budget = budgetParCategorie.get(categorie.id) ?? null
      const reel = depenses.get(categorie.id) ?? 0
      return {
        categorie,
        budget,
        reel,
        ratio: budget ? reel / budget.montant_mensuel : null,
        etat: budget ? etatBudget(reel, budget.montant_mensuel, seuilPct) : 'sans_budget',
      }
    })
}
