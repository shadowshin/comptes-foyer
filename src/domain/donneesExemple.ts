// Génère 3 mois de données fictives pour un foyer de deux personnes.
// Aucun nom, montant ni libellé réel : ces données servent aux démonstrations et aux tests.

import { CATEGORIES_PAR_DEFAUT } from './categoriesParDefaut'
import { ajouterJours, ajouterMois, dateDuMois, depuisIso } from './dates'
import type {
  Budget,
  Categorie,
  Compte,
  CompteMembre,
  Membre,
  ModePaiement,
  Recurrence,
  Transaction,
  TypeTransaction,
} from './types'

export interface DonneesExemple {
  membres: Membre[]
  comptes: Compte[]
  comptesMembres: CompteMembre[]
  categories: Categorie[]
  recurrences: Recurrence[]
  transactions: Transaction[]
  budgets: Budget[]
}

interface Options {
  aujourdhui: string
  graine?: number
  genererId?: () => string
}

// Générateur pseudo-aléatoire reproductible (mulberry32) : même graine, mêmes données
function aleatoire(graine: number) {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function genererDonneesExemple({
  aujourdhui,
  graine = 42,
  genererId = () => crypto.randomUUID(),
}: Options): DonneesExemple {
  const hasard = aleatoire(graine)
  const entre = (min: number, max: number) => Math.round((min + hasard() * (max - min)) * 100) / 100
  const debut = dateDuMois(ajouterMois(aujourdhui, -3), 1)

  const membres: Membre[] = [
    { id: genererId(), nom: 'Alice', ordre: 0 },
    { id: genererId(), nom: 'Brigitte', ordre: 1 },
  ]
  const [alice, brigitte] = membres

  const compte = (
    nom: string,
    banque: string,
    nature: Compte['nature'],
    solde_initial: number,
    extra: Partial<Compte> = {},
  ): Compte => ({
    id: genererId(),
    nom,
    banque,
    nature,
    disponible: true,
    solde_initial,
    date_solde_initial: debut,
    plafond: null,
    date_echeance: null,
    cle_import: null,
    actif: true,
    ordre: 0,
    ...extra,
  })

  const courantAlice = compte('Compte courant Alice', 'Banque Exemple', 'courant', 620)
  const courantBrigitte = compte('Compte courant Brigitte', 'Banque Exemple', 'courant', 540)
  const joint = compte('Compte joint', 'Banque Exemple', 'courant', 300)
  const livretAlice = compte('Livret A Alice', 'Banque Démo', 'livret', 1800, { plafond: 22950 })
  const lepBrigitte = compte('LEP Brigitte', 'Banque Exemple', 'livret', 2400, { plafond: 10000 })
  const placementAlice = compte('Placement à terme Alice', 'Banque Exemple', 'placement', 3200, {
    disponible: false,
    date_echeance: ajouterMois(aujourdhui, 40),
  })
  const comptes = [courantAlice, courantBrigitte, joint, livretAlice, lepBrigitte, placementAlice].map(
    (c, ordre) => ({ ...c, ordre }),
  )

  const comptesMembres: CompteMembre[] = [
    { compte_id: courantAlice.id, membre_id: alice.id },
    { compte_id: courantBrigitte.id, membre_id: brigitte.id },
    { compte_id: joint.id, membre_id: alice.id },
    { compte_id: joint.id, membre_id: brigitte.id },
    { compte_id: livretAlice.id, membre_id: alice.id },
    { compte_id: lepBrigitte.id, membre_id: brigitte.id },
    { compte_id: placementAlice.id, membre_id: alice.id },
  ]

  const categories: Categorie[] = Object.entries(CATEGORIES_PAR_DEFAUT).flatMap(([type, noms]) =>
    noms.map((nom) => ({ id: genererId(), nom, type: type as Categorie['type'], archivee: false })),
  )
  const cat = (nom: string) => {
    const trouvee = categories.find((c) => c.nom === nom)
    if (!trouvee) throw new Error(`Catégorie inconnue : ${nom}`)
    return trouvee.id
  }

  const recurrences: Recurrence[] = []
  const transactions: Transaction[] = []

  const ajouterOperation = (
    o: Pick<Transaction, 'compte_id' | 'date_operation' | 'libelle' | 'type' | 'montant'> &
      Partial<Transaction>,
  ) => {
    transactions.push({
      id: genererId(),
      description: null,
      categorie_id: null,
      mode_paiement: null,
      notes: null,
      transfert_id: null,
      recurrence_id: null,
      source: 'exemple',
      empreinte_import: null,
      ...o,
    })
  }

  // Un virement interne crée deux opérations liées par le même transfert_id
  const ajouterVirement = (
    source: Compte,
    cible: Compte,
    date: string,
    montant: number,
    libelle: string,
    recurrence_id: string | null,
  ) => {
    const transfert_id = genererId()
    const commun = { date_operation: date, libelle, type: 'virement_interne' as const, transfert_id, recurrence_id }
    ajouterOperation({ ...commun, compte_id: source.id, montant: -montant, mode_paiement: 'virement' })
    ajouterOperation({ ...commun, compte_id: cible.id, montant })
  }

  const recurrenceMensuelle = (
    libelle: string,
    compteSource: Compte,
    jour: number,
    montant: number,
    type: TypeTransaction,
    options: { categorie?: string; cible?: Compte; mode?: ModePaiement } = {},
  ) => {
    const r: Recurrence = {
      id: genererId(),
      libelle,
      compte_id: compteSource.id,
      compte_cible_id: options.cible?.id ?? null,
      type,
      categorie_id: options.categorie ? cat(options.categorie) : null,
      montant,
      mode_paiement: options.mode ?? null,
      frequence: 'mensuelle',
      date_debut: dateDuMois(debut, jour),
      date_fin: null,
      actif: true,
    }
    recurrences.push(r)

    // Occurrences passées, jusqu'à aujourd'hui inclus
    for (let date = r.date_debut; date <= aujourdhui; date = dateDuMois(ajouterMois(date, 1), jour)) {
      if (options.cible) {
        ajouterVirement(compteSource, options.cible, date, Math.abs(montant), libelle, r.id)
      } else {
        ajouterOperation({
          compte_id: compteSource.id,
          date_operation: date,
          libelle,
          type,
          montant,
          categorie_id: r.categorie_id,
          mode_paiement: r.mode_paiement,
          recurrence_id: r.id,
        })
      }
    }
  }

  // Revenus
  recurrenceMensuelle('ARE France Travail', courantAlice, 3, 1420, 'revenu', {
    categorie: 'ARE France Travail',
    mode: 'virement',
  })
  recurrenceMensuelle('Retraite', courantBrigitte, 9, 1310, 'revenu', { categorie: 'Retraite', mode: 'virement' })

  // Alimentation du compte joint et épargne
  recurrenceMensuelle('Versement compte joint', courantAlice, 4, -420, 'virement_interne', { cible: joint })
  recurrenceMensuelle('Versement compte joint', courantBrigitte, 10, -420, 'virement_interne', { cible: joint })
  recurrenceMensuelle('Épargne mensuelle', courantAlice, 6, -100, 'virement_interne', { cible: livretAlice })
  recurrenceMensuelle('Versement placement', courantAlice, 9, -60, 'virement_interne', { cible: placementAlice })

  // Prélèvements fixes sur le compte joint
  recurrenceMensuelle('Loyer', joint, 5, -560, 'depense_fixe', { categorie: 'Loyer ou crédit immo', mode: 'prelevement' })
  recurrenceMensuelle('Fournisseur énergie', joint, 12, -96, 'depense_fixe', { categorie: 'Énergie', mode: 'prelevement' })
  recurrenceMensuelle("Régie de l'eau", joint, 14, -34, 'depense_fixe', { categorie: 'Eau', mode: 'prelevement' })
  recurrenceMensuelle('Assurance habitation', joint, 15, -28, 'depense_fixe', { categorie: 'Assurances', mode: 'prelevement' })
  recurrenceMensuelle('Assurance auto', joint, 15, -41, 'depense_fixe', { categorie: 'Assurances', mode: 'prelevement' })
  recurrenceMensuelle('Box internet', joint, 20, -32, 'depense_fixe', { categorie: 'Téléphone et internet', mode: 'prelevement' })

  // Charges fixes individuelles
  recurrenceMensuelle('Mutuelle', courantAlice, 8, -48, 'depense_fixe', { categorie: 'Mutuelle', mode: 'prelevement' })
  recurrenceMensuelle('Mutuelle', courantBrigitte, 8, -72, 'depense_fixe', { categorie: 'Mutuelle', mode: 'prelevement' })
  recurrenceMensuelle('Forfait mobile', courantAlice, 22, -12, 'depense_fixe', {
    categorie: 'Téléphone et internet',
    mode: 'prelevement',
  })
  recurrenceMensuelle('Streaming vidéo', courantAlice, 18, -9, 'depense_fixe', { categorie: 'Abonnements', mode: 'carte' })

  // Dépenses variables, réparties au hasard sur la période
  for (let date = debut; date <= aujourdhui; date = ajouterJours(date, 1)) {
    const jourSemaine = depuisIso(date).getDay()
    if (jourSemaine === 6) {
      ajouterOperation({
        compte_id: hasard() < 0.6 ? courantAlice.id : courantBrigitte.id,
        date_operation: date,
        libelle: 'Supermarché',
        type: 'depense_variable',
        montant: -entre(55, 120),
        categorie_id: cat('Courses'),
        mode_paiement: 'carte',
      })
    }
    if (jourSemaine === 3 && hasard() < 0.7) {
      ajouterOperation({
        compte_id: courantBrigitte.id,
        date_operation: date,
        libelle: 'Marché',
        type: 'depense_variable',
        montant: -entre(15, 35),
        categorie_id: cat('Courses'),
        mode_paiement: 'especes',
      })
    }
    if (hasard() < 0.07) {
      ajouterOperation({
        compte_id: courantAlice.id,
        date_operation: date,
        libelle: 'Station-service',
        type: 'depense_variable',
        montant: -entre(45, 70),
        categorie_id: cat('Carburant'),
        mode_paiement: 'carte',
      })
    }
    if (hasard() < 0.05) {
      ajouterOperation({
        compte_id: courantAlice.id,
        date_operation: date,
        libelle: 'Restaurant',
        type: 'depense_variable',
        montant: -entre(18, 45),
        categorie_id: cat('Restaurants et sorties'),
        mode_paiement: 'carte',
      })
    }
    if (hasard() < 0.04) {
      ajouterOperation({
        compte_id: courantAlice.id,
        date_operation: date,
        libelle: 'Magasin de bricolage',
        type: 'depense_variable',
        montant: -entre(12, 80),
        categorie_id: cat('Maison et bricolage'),
        mode_paiement: 'carte',
      })
    }
    if (hasard() < 0.03) {
      ajouterOperation({
        compte_id: courantBrigitte.id,
        date_operation: date,
        libelle: 'Pharmacie',
        type: 'depense_variable',
        montant: -entre(6, 30),
        categorie_id: cat('Santé'),
        mode_paiement: 'carte',
      })
    }
  }

  // Animaux : croquettes chaque mois, une visite chez le vétérinaire sur la période
  for (let date = dateDuMois(debut, 2); date <= aujourdhui; date = ajouterMois(date, 1)) {
    ajouterOperation({
      compte_id: courantAlice.id,
      date_operation: date,
      libelle: 'Animalerie',
      type: 'depense_variable',
      montant: -entre(32, 42),
      categorie_id: cat('Animaux'),
      mode_paiement: 'carte',
    })
  }
  ajouterOperation({
    compte_id: courantAlice.id,
    date_operation: dateDuMois(ajouterMois(debut, 1), 17),
    libelle: 'Clinique vétérinaire',
    type: 'depense_variable',
    montant: -86.5,
    categorie_id: cat('Animaux'),
    mode_paiement: 'carte',
  })

  // Remboursement santé et taxe foncière, pour varier les types
  ajouterOperation({
    compte_id: courantBrigitte.id,
    date_operation: dateDuMois(ajouterMois(debut, 1), 21),
    libelle: 'Remboursement assurance maladie',
    type: 'revenu',
    montant: 23.4,
    categorie_id: cat('Remboursements'),
    mode_paiement: 'virement',
  })
  ajouterOperation({
    compte_id: joint.id,
    date_operation: dateDuMois(ajouterMois(debut, 2), 15),
    libelle: 'Taxe foncière',
    type: 'impot',
    montant: -112,
    categorie_id: cat('Taxe foncière'),
    mode_paiement: 'prelevement',
  })

  const budget = (nom: string, montant_mensuel: number): Budget => ({
    id: genererId(),
    categorie_id: cat(nom),
    montant_mensuel,
  })
  const budgets = [
    budget('Courses', 420),
    budget('Carburant', 120),
    budget('Restaurants et sorties', 60),
    budget('Animaux', 50),
    budget('Maison et bricolage', 80),
    budget('Santé', 40),
  ]

  return { membres, comptes, comptesMembres, categories, recurrences, transactions, budgets }
}
