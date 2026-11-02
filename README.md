# Comptes du foyer

Application personnelle de gestion des comptes d'un foyer : saisie des transactions, import des relevés bancaires, trésorerie, budgets, alertes et rapports.

React + TypeScript (Vite), Supabase (Postgres, authentification, RLS), déploiement Vercel.

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

## Sécurité

- Toutes les tables sont protégées par RLS : chaque utilisateur ne voit que ses propres lignes.
- Aucune table n'est accessible sans connexion (rôle `anon` sans droits).
- Les inscriptions publiques sont désactivées côté Supabase : seul le compte créé depuis le tableau de bord peut se connecter.
- Aucune donnée bancaire réelle dans le dépôt : les données d'exemple et les fichiers de test sont fictifs.

## Organisation du code

| Dossier | Contenu |
|---|---|
| `src/domain/` | Logique métier pure (dates, montants, données d'exemple, bientôt projection, alertes, lecteurs CSV), testée avec Vitest |
| `src/lib/` | Accès à Supabase |
| `src/pages/`, `src/components/` | Interface |
| `supabase/migrations/` | Schéma SQL versionné |

## Tests

```bash
npm test        # tests unitaires (Vitest)
npm run lint
npm run build
```
