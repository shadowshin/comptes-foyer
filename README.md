# Comptes du foyer

Application personnelle de gestion des comptes d'un foyer : saisie des transactions, import des relevés bancaires (Crédit Agricole, Caisse d'Épargne), trésorerie et projection à 90 jours, budgets, alertes et rapports.

React + TypeScript (Vite), Supabase (Postgres, authentification, RLS), déploiement Vercel.

Je suis ingénieure QA. Ce projet me sert aussi de vitrine : il montre comment je teste une application de bout en bout, de la logique métier jusqu'au navigateur.

## Stratégie de test

| Niveau | Outil | Ce qui est couvert | Volume |
|---|---|---|---|
| Unitaire | Vitest | Calculs métier purs : montants, dates, lecteurs CSV, déduplication à l'import, projection de trésorerie, alertes | 139 tests |
| Bout en bout | Playwright | Parcours principaux dans un vrai navigateur, de la connexion jusqu'à la base | 10 scénarios |

Le plan de test de bout en bout, avec ses priorités et ses résultats attendus, est dans [`docs/plan-de-test-e2e.md`](docs/plan-de-test-e2e.md).

Principes appliqués :

- **Données de test maîtrisées** : un projet Supabase dédié aux tests, rechargé avec un foyer fictif avant chaque test. Les tests sont indépendants et calculent leurs résultats attendus à partir de ces données, sans montant codé en dur.
- **Localisation par rôle accessible** (`getByRole`, `getByLabel`) : le test voit la page comme un utilisateur, et l'accessibilité est vérifiée au passage.
- **Pas de faux positif** : l'état « avant » est vérifié quand il compte, on vérifie une valeur précise plutôt qu'une simple visibilité, et chaque test a été mis en échec volontairement (contre-test) pour s'assurer qu'il échoue pour la bonne raison.
- **Pas d'attente fixe** : on attend l'effet réel d'une action (réponse, valeur enregistrée), jamais un délai arbitraire.
- **Page Objects** pour les parcours répétés (`e2e/pages/`).

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigner l'URL et la clé publishable Supabase
npm run dev
```

## Base de données

Le schéma est versionné dans `supabase/migrations/`. Pour l'appliquer au projet Supabase :

```bash
npx supabase login
npx supabase link --project-ref <référence du projet>
npm run db:push
```

## Lancer les tests

```bash
npm test          # tests unitaires (Vitest)
npm run e2e       # tests de bout en bout (Playwright), voir .env.e2e.example
npm run e2e:ui    # mode interactif
npm run lint
npm run build
```

## Sécurité

- Toutes les tables sont protégées par RLS : chaque utilisateur ne voit que ses propres lignes.
- Aucune table n'est accessible sans connexion (rôle `anon` sans droits).
- Les inscriptions publiques sont désactivées côté Supabase : seul le compte créé depuis le tableau de bord peut se connecter.
- Aucune donnée bancaire réelle dans le dépôt : les données d'exemple et les fichiers de test sont fictifs.
- Les rapports et traces Playwright ne sont pas versionnés : ils contiennent les saisies du compte de test.

## Organisation du code

| Dossier | Contenu |
|---|---|
| `src/domain/` | Logique métier pure (dates, montants, import CSV, trésorerie, alertes, données d'exemple), testée avec Vitest |
| `src/lib/` | Accès à Supabase |
| `src/pages/`, `src/components/` | Interface |
| `supabase/migrations/` | Schéma SQL versionné |
| `e2e/` | Tests Playwright, fixtures, Page Objects et outils (relevé CSV fictif) |
| `docs/` | Plan de test de bout en bout |
