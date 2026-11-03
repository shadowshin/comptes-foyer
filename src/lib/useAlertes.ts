import { useMemo, useState } from 'react'
import { calculerAlertes } from '../domain/alertes'
import { versIso } from '../domain/dates'
import { lireBudgets, lireParametres, lireRecurrences, lireReferentiel, lireTransactions } from './donnees'
import { useChargement } from './useChargement'

async function lireTout() {
  const [referentiel, transactions, recurrences, budgets, parametres] = await Promise.all([
    lireReferentiel(),
    lireTransactions(),
    lireRecurrences(),
    lireBudgets(),
    lireParametres(),
  ])
  return { ...referentiel, transactions, recurrences, budgets, parametres }
}

// Charge tout ce qu'il faut et calcule les alertes du foyer (page Alertes et badge de navigation)
export function useAlertes() {
  const chargement = useChargement(lireTout)
  const [aujourdhui] = useState(() => versIso(new Date()))
  const alertes = useMemo(
    () => (chargement.donnee ? calculerAlertes({ ...chargement.donnee, aujourdhui }) : null),
    [chargement.donnee, aujourdhui],
  )
  return { alertes, donnees: chargement.donnee, erreur: chargement.erreur, recharger: chargement.recharger }
}
