# Plan de test de bout en bout (Playwright)

Les tests unitaires (Vitest, `src/**/*.test.ts`) couvrent les calculs. Ces tests-ci
vérifient les **parcours principaux dans un vrai navigateur**, de la connexion jusqu'à la base.

## Environnement

- Projet Supabase **dédié aux tests** (`comptes-foyer-test`), jamais celui des vraies données.
- Un compte de test. Les règles RLS l'isolent : il ne voit que ses propres lignes.
- Avant chaque test, la base du compte de test est vidée puis rechargée avec les
  **données d'exemple** (foyer fictif Alice et Brigitte, graine fixe). Les tests sont donc
  indépendants les uns des autres et peuvent lire ces données (`exemple`) pour calculer
  leurs résultats attendus plutôt que de coder des montants en dur.
- Tests en série (un seul compte, une seule base).

Lancer : `npm.cmd run e2e` (ou `npm.cmd run e2e:ui` pour le mode interactif).

## Scénarios

Priorité : **P1** = parcours critique, **P2** = important, **P3** = confort.

| ID | Parcours | Résultat attendu | Priorité | Fichier | Statut |
|---|---|---|---|---|---|
| E2E-01 | Connexion avec un mauvais mot de passe | Message « Adresse e-mail ou mot de passe incorrect. », on reste sur la page de connexion | P1 | `connexion.spec.ts` | Automatisé |
| E2E-02 | Accueil : groupes de comptes | Trois groupes (courants, livrets, placements), chacun avec son total ; « Total foyer » = disponible + épargne bloquée | P1 | `comptes.spec.ts` | Automatisé |
| E2E-03 | Saisie d'une dépense | La dépense apparaît dans le tableau des transactions et le solde du compte baisse du même montant | P1 | `transactions.spec.ts` | Automatisé |
| E2E-04 | Saisie d'un virement interne | Deux opérations liées (sortie et entrée), « Total foyer » inchangé | P1 | `transactions.spec.ts` | À faire |
| E2E-05 | Import d'un relevé CSV fictif | Aperçu des opérations, import, puis réimport du même fichier sans doublon | P1 | `import.spec.ts` | À faire |
| E2E-06 | Budget : modifier et enregistrer | Le champ modifié passe en jaune, « Enregistrer les budgets » l'enregistre, la valeur reste après rechargement | P2 | `budgets.spec.ts` | À faire |
| E2E-07 | Budget dépassé | Un budget fixé sous le réel du mois donne une barre rouge et une alerte « Budget … dépassé » | P2 | `budgets.spec.ts` | À faire |
| E2E-08 | Alerte critique et badge | Un compte courant qui passera sous 0 € déclenche une alerte critique et le badge de la navigation | P2 | `alertes.spec.ts` | À faire |
| E2E-09 | Rapports : navigation entre les mois | Dernier mois complet par défaut ; ‹ › changent le mois ; › désactivé sur le mois en cours | P3 | `rapports.spec.ts` | À faire |
| E2E-10 | Sections repliables | Une section repliée le reste après rechargement de la page | P3 | `repliable.spec.ts` | À faire |

## Règles d'écriture

- Importer `test` et `expect` depuis `./fixtures`, pas depuis `@playwright/test`.
- Localiser par le rôle et le nom accessible (`getByRole`, `getByLabel`) : c'est ce
  que voit un utilisateur, et cela vérifie l'accessibilité au passage.
- Un titre de test décrit le résultat attendu, pas l'action.
- Vérifier une valeur précise, pas seulement qu'un élément est visible (faux positif).
- Les parcours répétés vont dans un Page Object (`e2e/pages/`).
