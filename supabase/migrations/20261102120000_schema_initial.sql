-- =============================================================================
-- Schéma initial : membres, comptes, catégories, transactions, récurrences,
-- budgets, règles de catégorisation et paramètres.
--
-- Principes :
--   - chaque ligne appartient à un utilisateur (owner_id), rempli par défaut
--     avec auth.uid() ; les règles RLS limitent tout accès à ses propres lignes
--   - aucune table n'est exposée à anon ; seules les tables listées en fin de
--     fichier sont accessibles au rôle authenticated
--   - un montant est signé du point de vue du compte : négatif = sortie,
--     positif = entrée. Le solde d'un compte = solde initial + somme des montants
--   - un virement interne = deux transactions (une par compte) qui partagent
--     le même transfert_id
-- =============================================================================

create type public.type_transaction as enum (
  'revenu',
  'depense_fixe',
  'depense_variable',
  'epargne',
  'impot',
  'virement_interne'
);

create type public.mode_paiement as enum (
  'virement_instantane',
  'virement',
  'carte',
  'especes',
  'prelevement',
  'cheque'
);

create type public.frequence as enum (
  'quotidienne',
  'hebdomadaire',
  'mensuelle',
  'annuelle'
);

create type public.nature_compte as enum (
  'courant',
  'livret',
  'placement'
);

create type public.source_transaction as enum (
  'manuel',
  'recurrence',
  'import_ca',
  'import_ce',
  'exemple'
);

-- --- Membres du foyer --------------------------------------------------------

create table public.membres (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  ordre smallint not null default 0,
  created_at timestamptz not null default now()
);

-- --- Comptes -----------------------------------------------------------------

create table public.comptes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  banque text not null,
  nature public.nature_compte not null,
  -- false pour l'épargne bloquée jusqu'à échéance (dépôt à terme, contrat à terme)
  disponible boolean not null default true,
  solde_initial numeric(12, 2) not null default 0,
  date_solde_initial date not null default current_date,
  -- plafond réglementaire d'un livret (modifiable, il change par décret)
  plafond numeric(12, 2) check (plafond is null or plafond > 0),
  date_echeance date,
  -- clé de rapprochement avec les exports bancaires (numéro CE, titulaire + type CA)
  cle_import text,
  actif boolean not null default true,
  ordre smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, cle_import)
);

-- Titulaires d'un compte : un membre, ou deux pour un compte joint
create table public.comptes_membres (
  compte_id uuid not null references public.comptes (id) on delete cascade,
  membre_id uuid not null references public.membres (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (compte_id, membre_id)
);

-- --- Catégories --------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  type public.type_transaction not null check (type <> 'virement_interne'),
  archivee boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_id, type, nom)
);

-- --- Récurrences -------------------------------------------------------------

create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  libelle text not null check (length(trim(libelle)) > 0),
  compte_id uuid not null references public.comptes (id) on delete cascade,
  -- compte qui reçoit l'argent, pour une récurrence de type virement interne
  compte_cible_id uuid references public.comptes (id) on delete cascade,
  type public.type_transaction not null,
  categorie_id uuid references public.categories (id) on delete set null,
  montant numeric(12, 2) not null check (montant <> 0),
  mode_paiement public.mode_paiement,
  frequence public.frequence not null,
  date_debut date not null,
  date_fin date check (date_fin is null or date_fin >= date_debut),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  check ((type = 'virement_interne') = (compte_cible_id is not null)),
  check (compte_cible_id is null or compte_cible_id <> compte_id)
);

-- --- Transactions ------------------------------------------------------------

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  compte_id uuid not null references public.comptes (id) on delete cascade,
  date_operation date not null,
  libelle text not null,
  description text,
  type public.type_transaction not null,
  categorie_id uuid references public.categories (id) on delete set null,
  montant numeric(12, 2) not null check (montant <> 0),
  mode_paiement public.mode_paiement,
  notes text,
  transfert_id uuid,
  recurrence_id uuid references public.recurrences (id) on delete set null,
  source public.source_transaction not null default 'manuel',
  -- empreinte d'une opération importée, pour ne jamais l'importer deux fois
  empreinte_import text,
  created_at timestamptz not null default now(),
  unique (owner_id, empreinte_import)
);

create index transactions_owner_date_idx on public.transactions (owner_id, date_operation);
create index transactions_compte_idx on public.transactions (compte_id);
create index transactions_transfert_idx on public.transactions (transfert_id) where transfert_id is not null;

-- --- Budgets -----------------------------------------------------------------

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  categorie_id uuid not null references public.categories (id) on delete cascade,
  montant_mensuel numeric(12, 2) not null check (montant_mensuel > 0),
  unique (owner_id, categorie_id)
);

-- --- Règles de catégorisation automatique ------------------------------------

create table public.regles_categorisation (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- texte recherché dans le libellé, sans tenir compte de la casse
  motif text not null check (length(trim(motif)) > 0),
  type public.type_transaction not null,
  categorie_id uuid references public.categories (id) on delete cascade,
  -- pour une règle qui transforme l'opération en virement interne
  compte_cible_id uuid references public.comptes (id) on delete cascade,
  priorite smallint not null default 0,
  created_at timestamptz not null default now()
);

-- --- Paramètres (une ligne par utilisateur) ----------------------------------

create table public.parametres (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  seuil_critique numeric(12, 2) not null default 0,
  seuil_avertissement numeric(12, 2) not null default 150,
  alerte_budget_pct smallint not null default 80 check (alerte_budget_pct between 1 and 100),
  baisse_revenus_pct smallint not null default 20 check (baisse_revenus_pct between 1 and 100),
  delai_echeance_jours smallint not null default 7 check (delai_echeance_jours > 0),
  delai_placement_jours smallint not null default 30 check (delai_placement_jours > 0),
  couleur_accent text not null default '#059669' check (couleur_accent ~ '^#[0-9A-Fa-f]{6}$')
);

-- --- Solde par compte --------------------------------------------------------
-- security_invoker : la vue applique les règles RLS de l'utilisateur qui la lit

create view public.soldes_comptes with (security_invoker = true) as
select
  c.id as compte_id,
  c.owner_id,
  c.solde_initial + coalesce(sum(t.montant) filter (where t.date_operation >= c.date_solde_initial), 0) as solde
from public.comptes c
left join public.transactions t on t.compte_id = c.id
group by c.id;

-- --- Sécurité : RLS sur toutes les tables ------------------------------------

alter table public.membres enable row level security;
alter table public.comptes enable row level security;
alter table public.comptes_membres enable row level security;
alter table public.categories enable row level security;
alter table public.recurrences enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.regles_categorisation enable row level security;
alter table public.parametres enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'membres', 'comptes', 'comptes_membres', 'categories', 'recurrences',
    'transactions', 'budgets', 'regles_categorisation', 'parametres'
  ]
  loop
    execute format(
      'create policy "proprietaire uniquement" on public.%I
         for all to authenticated
         using (owner_id = (select auth.uid()))
         with check (owner_id = (select auth.uid()))',
      t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$$;

grant select on public.soldes_comptes to authenticated;
grant usage on type public.type_transaction, public.mode_paiement, public.frequence,
  public.nature_compte, public.source_transaction to authenticated;
