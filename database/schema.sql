-- ====================================================================
-- LIVE DATABASE SCHEMA & STRUCTURE (NEON SERVERLESS POSTGRES)
-- Introspected from live database
-- Contains pure schema DDL (schemas, tables, constraints, indexes, triggers)
-- NO SENSITIVE USER DATA OR CREDENTIALS ARE STORED IN THIS FILE
-- ====================================================================

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS neon_auth;
CREATE SCHEMA IF NOT EXISTS pgrst;

-- --------------------------------------------------------------------
-- Table: neon_auth.account
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS neon_auth.account (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  accountId text NOT NULL,
  providerId text NOT NULL,
  userId uuid NOT NULL,
  accessToken text,
  refreshToken text,
  idToken text,
  accessTokenExpiresAt timestamp with time zone,
  refreshTokenExpiresAt timestamp with time zone,
  scope text,
  password text,
  createdAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp with time zone NOT NULL
);

-- --------------------------------------------------------------------
-- Table: neon_auth.invitation
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS neon_auth.invitation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organizationId uuid NOT NULL,
  email text NOT NULL,
  role text,
  status text NOT NULL,
  expiresAt timestamp with time zone NOT NULL,
  createdAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  inviterId uuid NOT NULL
);

-- --------------------------------------------------------------------
-- Table: neon_auth.jwks
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS neon_auth.jwks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  publicKey text NOT NULL,
  privateKey text NOT NULL,
  createdAt timestamp with time zone NOT NULL,
  expiresAt timestamp with time zone
);

-- --------------------------------------------------------------------
-- Table: neon_auth.member
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS neon_auth.member (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organizationId uuid NOT NULL,
  userId uuid NOT NULL,
  role text NOT NULL,
  createdAt timestamp with time zone NOT NULL
);

-- --------------------------------------------------------------------
-- Table: neon_auth.organization
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS neon_auth.organization (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  logo text,
  createdAt timestamp with time zone NOT NULL,
  metadata text
);

-- --------------------------------------------------------------------
-- Table: neon_auth.project_config
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS neon_auth.project_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  endpoint_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  trusted_origins jsonb NOT NULL,
  social_providers jsonb NOT NULL,
  email_provider jsonb,
  email_and_password jsonb,
  allow_localhost boolean NOT NULL,
  plugin_configs jsonb,
  webhook_config jsonb
);

-- --------------------------------------------------------------------
-- Table: neon_auth.session
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS neon_auth.session (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  expiresAt timestamp with time zone NOT NULL,
  token text NOT NULL,
  createdAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp with time zone NOT NULL,
  ipAddress text,
  userAgent text,
  userId uuid NOT NULL,
  impersonatedBy text,
  activeOrganizationId text
);

-- --------------------------------------------------------------------
-- Table: neon_auth.user
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS neon_auth.user (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  emailVerified boolean NOT NULL,
  image text,
  createdAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  role text,
  banned boolean,
  banReason text,
  banExpires timestamp with time zone
);

-- --------------------------------------------------------------------
-- Table: neon_auth.verification
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS neon_auth.verification (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  value text NOT NULL,
  expiresAt timestamp with time zone NOT NULL,
  createdAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- Table: public.accounts
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  balance numeric(15, 2) DEFAULT 0,
  currency text DEFAULT 'USD'::text,
  color text DEFAULT '#22c55e'::text,
  icon text DEFAULT 'wallet'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- --------------------------------------------------------------------
-- Table: public.ai_digests
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_digests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- --------------------------------------------------------------------
-- Table: public.ai_insights
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  amount numeric(15, 2),
  date date,
  is_dismissed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- --------------------------------------------------------------------
-- Table: public.budgets
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  amount numeric(15, 2) NOT NULL,
  period text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- --------------------------------------------------------------------
-- Table: public.categories
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  color text DEFAULT '#3b82f6'::text,
  icon text DEFAULT 'tag'::text,
  parent_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- --------------------------------------------------------------------
-- Table: public.debt_payments
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  debt_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric(15, 2) NOT NULL,
  principal_amount numeric(15, 2) NOT NULL DEFAULT 0,
  interest_amount numeric(15, 2) NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- --------------------------------------------------------------------
-- Table: public.debts
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  original_amount numeric(15, 2) NOT NULL,
  current_balance numeric(15, 2) NOT NULL,
  interest_rate numeric(5, 2) NOT NULL,
  minimum_payment numeric(15, 2) NOT NULL,
  due_day integer,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  lender text,
  notes text,
  color text DEFAULT '#ef4444'::text,
  icon text DEFAULT 'credit-card'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- --------------------------------------------------------------------
-- Table: public.goals
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  target_amount numeric(15, 2) NOT NULL,
  current_amount numeric(15, 2) DEFAULT 0,
  deadline date,
  color text DEFAULT '#22c55e'::text,
  icon text DEFAULT 'target'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- --------------------------------------------------------------------
-- Table: public.pg_stat_statements
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pg_stat_statements (
  userid oid,
  dbid oid,
  toplevel boolean,
  queryid bigint,
  query text,
  plans bigint,
  total_plan_time double precision,
  min_plan_time double precision,
  max_plan_time double precision,
  mean_plan_time double precision,
  stddev_plan_time double precision,
  calls bigint,
  total_exec_time double precision,
  min_exec_time double precision,
  max_exec_time double precision,
  mean_exec_time double precision,
  stddev_exec_time double precision,
  rows bigint,
  shared_blks_hit bigint,
  shared_blks_read bigint,
  shared_blks_dirtied bigint,
  shared_blks_written bigint,
  local_blks_hit bigint,
  local_blks_read bigint,
  local_blks_dirtied bigint,
  local_blks_written bigint,
  temp_blks_read bigint,
  temp_blks_written bigint,
  shared_blk_read_time double precision,
  shared_blk_write_time double precision,
  local_blk_read_time double precision,
  local_blk_write_time double precision,
  temp_blk_read_time double precision,
  temp_blk_write_time double precision,
  wal_records bigint,
  wal_fpi bigint,
  wal_bytes numeric,
  jit_functions bigint,
  jit_generation_time double precision,
  jit_inlining_count bigint,
  jit_inlining_time double precision,
  jit_optimization_count bigint,
  jit_optimization_time double precision,
  jit_emission_count bigint,
  jit_emission_time double precision,
  jit_deform_count bigint,
  jit_deform_time double precision,
  stats_since timestamp with time zone,
  minmax_stats_since timestamp with time zone
);

-- --------------------------------------------------------------------
-- Table: public.pg_stat_statements_info
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pg_stat_statements_info (
  dealloc bigint,
  stats_reset timestamp with time zone
);

-- --------------------------------------------------------------------
-- Table: public.profiles
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  full_name text,
  avatar_url text,
  currency text DEFAULT 'USD'::text,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- --------------------------------------------------------------------
-- Table: public.rate_limits
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  blocked_until timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------
-- Table: public.schema_migrations
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version text NOT NULL,
  applied_at timestamp with time zone NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------
-- Table: public.system_logs
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  action text NOT NULL,
  resource text NOT NULL,
  old_value text,
  new_value text,
  user_id uuid,
  user_email text,
  severity text NOT NULL DEFAULT 'info'::text,
  status text NOT NULL DEFAULT 'success'::text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- --------------------------------------------------------------------
-- Table: public.transactions
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  category_id uuid,
  to_account_id uuid,
  type text NOT NULL,
  amount numeric(15, 2) NOT NULL,
  description text,
  notes text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  is_recurring boolean DEFAULT false,
  recurring_frequency text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  recurring_end_date date,
  next_due_date date,
  recurring_parent_id uuid
);

-- --------------------------------------------------------------------
-- Table: public.users
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  encrypted_password text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_sign_in_at timestamp with time zone
);

-- --------------------------------------------------------------------
-- Indexes
-- --------------------------------------------------------------------
CREATE UNIQUE INDEX account_pkey ON neon_auth.account USING btree (id);
CREATE INDEX "account_userId_idx" ON neon_auth.account USING btree ("userId");
CREATE INDEX invitation_email_idx ON neon_auth.invitation USING btree (email);
CREATE INDEX "invitation_organizationId_idx" ON neon_auth.invitation USING btree ("organizationId");
CREATE UNIQUE INDEX invitation_pkey ON neon_auth.invitation USING btree (id);
CREATE UNIQUE INDEX jwks_pkey ON neon_auth.jwks USING btree (id);
CREATE INDEX "member_organizationId_idx" ON neon_auth.member USING btree ("organizationId");
CREATE UNIQUE INDEX member_pkey ON neon_auth.member USING btree (id);
CREATE INDEX "member_userId_idx" ON neon_auth.member USING btree ("userId");
CREATE UNIQUE INDEX organization_pkey ON neon_auth.organization USING btree (id);
CREATE UNIQUE INDEX organization_slug_key ON neon_auth.organization USING btree (slug);
CREATE UNIQUE INDEX organization_slug_uidx ON neon_auth.organization USING btree (slug);
CREATE UNIQUE INDEX project_config_endpoint_id_key ON neon_auth.project_config USING btree (endpoint_id);
CREATE UNIQUE INDEX project_config_pkey ON neon_auth.project_config USING btree (id);
CREATE UNIQUE INDEX session_pkey ON neon_auth.session USING btree (id);
CREATE UNIQUE INDEX session_token_key ON neon_auth.session USING btree (token);
CREATE INDEX "session_userId_idx" ON neon_auth.session USING btree ("userId");
CREATE UNIQUE INDEX user_email_key ON neon_auth."user" USING btree (email);
CREATE UNIQUE INDEX user_pkey ON neon_auth."user" USING btree (id);
CREATE INDEX verification_identifier_idx ON neon_auth.verification USING btree (identifier);
CREATE UNIQUE INDEX verification_pkey ON neon_auth.verification USING btree (id);
CREATE UNIQUE INDEX accounts_pkey ON public.accounts USING btree (id);
CREATE INDEX idx_accounts_user_id ON public.accounts USING btree (user_id);
CREATE UNIQUE INDEX ai_digests_pkey ON public.ai_digests USING btree (id);
CREATE UNIQUE INDEX ai_digests_user_id_week_start_key ON public.ai_digests USING btree (user_id, week_start);
CREATE UNIQUE INDEX ai_insights_pkey ON public.ai_insights USING btree (id);
CREATE INDEX idx_ai_insights_user_id ON public.ai_insights USING btree (user_id);
CREATE UNIQUE INDEX budgets_pkey ON public.budgets USING btree (id);
CREATE INDEX idx_budgets_category_id ON public.budgets USING btree (category_id);
CREATE INDEX idx_budgets_user_id ON public.budgets USING btree (user_id);
CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id);
CREATE INDEX idx_categories_user_id ON public.categories USING btree (user_id);
CREATE UNIQUE INDEX uq_categories_user_name ON public.categories USING btree (user_id, name);
CREATE UNIQUE INDEX debt_payments_pkey ON public.debt_payments USING btree (id);
CREATE INDEX idx_debt_payments_date ON public.debt_payments USING btree (payment_date);
CREATE INDEX idx_debt_payments_debt_date ON public.debt_payments USING btree (debt_id, payment_date DESC);
CREATE INDEX idx_debt_payments_debt_id ON public.debt_payments USING btree (debt_id);
CREATE INDEX idx_debt_payments_user_id ON public.debt_payments USING btree (user_id);
CREATE UNIQUE INDEX debts_pkey ON public.debts USING btree (id);
CREATE INDEX idx_debts_is_active ON public.debts USING btree (is_active);
CREATE INDEX idx_debts_type ON public.debts USING btree (type);
CREATE INDEX idx_debts_user_id ON public.debts USING btree (user_id);
CREATE UNIQUE INDEX goals_pkey ON public.goals USING btree (id);
CREATE INDEX idx_goals_user_id ON public.goals USING btree (user_id);
CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX profiles_user_id_key ON public.profiles USING btree (user_id);
CREATE INDEX idx_rate_limits_blocked_until ON public.rate_limits USING btree (blocked_until);
CREATE INDEX idx_rate_limits_updated_at ON public.rate_limits USING btree (updated_at);
CREATE UNIQUE INDEX rate_limits_pkey ON public.rate_limits USING btree (key);
CREATE UNIQUE INDEX schema_migrations_pkey ON public.schema_migrations USING btree (version);
CREATE INDEX idx_system_logs_action ON public.system_logs USING btree (action);
CREATE INDEX idx_system_logs_severity ON public.system_logs USING btree (severity);
CREATE INDEX idx_system_logs_timestamp ON public.system_logs USING btree ("timestamp" DESC);
CREATE INDEX idx_system_logs_user_timestamp ON public.system_logs USING btree (user_id, "timestamp" DESC);
CREATE UNIQUE INDEX system_logs_pkey ON public.system_logs USING btree (id);
CREATE INDEX idx_transactions_account_id ON public.transactions USING btree (account_id);
CREATE INDEX idx_transactions_category_id ON public.transactions USING btree (category_id);
CREATE INDEX idx_transactions_date ON public.transactions USING btree (date);
CREATE INDEX idx_transactions_recurring_due ON public.transactions USING btree (user_id, next_due_date) WHERE ((is_recurring = true) AND (next_due_date IS NOT NULL));
CREATE INDEX idx_transactions_to_account_id ON public.transactions USING btree (to_account_id);
CREATE INDEX idx_transactions_user_category_date ON public.transactions USING btree (user_id, category_id, date);
CREATE INDEX idx_transactions_user_date ON public.transactions USING btree (user_id, date DESC);
CREATE UNIQUE INDEX transactions_pkey ON public.transactions USING btree (id);
CREATE UNIQUE INDEX uq_recurring_occurrence ON public.transactions USING btree (user_id, recurring_parent_id, date) WHERE (recurring_parent_id IS NOT NULL);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

-- --------------------------------------------------------------------
-- Functions & Trigger Procedures
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth.init()
 RETURNS void
 LANGUAGE c
 STRICT
AS '$libdir/pg_session_jwt', $function$init_wrapper$function$
;

CREATE OR REPLACE FUNCTION auth.jwt()
 RETURNS jsonb
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_session_jwt', $function$jwt_wrapper$function$
;

CREATE OR REPLACE FUNCTION auth.jwt_session_init(jwt text)
 RETURNS void
 LANGUAGE c
 STRICT
AS '$libdir/pg_session_jwt', $function$jwt_session_init_wrapper$function$
;

CREATE OR REPLACE FUNCTION auth.session()
 RETURNS jsonb
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_session_jwt', $function$session_wrapper$function$
;

CREATE OR REPLACE FUNCTION auth.uid()
 RETURNS uuid
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_session_jwt', $function$uid_wrapper$function$
;

CREATE OR REPLACE FUNCTION auth.user_id()
 RETURNS text
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_session_jwt', $function$user_id_wrapper$function$
;

CREATE OR REPLACE FUNCTION pgrst.pre_config()
 RETURNS void
 LANGUAGE sql
AS $function$
  SELECT
      set_config('pgrst.db_schemas', 'public', true)
    , set_config('pgrst.db_aggregates_enabled', 'true', true)
    , set_config('pgrst.db_anon_role', 'anonymous', true)
    , set_config('pgrst.jwt_role_claim_key', '.role', true)
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_budget_refs_owned()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM categories WHERE id = NEW.category_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'budget category does not belong to user';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_category_parent_owned()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM categories WHERE id = NEW.parent_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'parent category does not belong to user';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_debt_payment_refs_owned()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM debts WHERE id = NEW.debt_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'debt payment debt does not belong to user';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_transaction_refs_owned()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accounts WHERE id = NEW.account_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'transaction account does not belong to user';
  END IF;

  IF NEW.to_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM accounts WHERE id = NEW.to_account_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'transaction destination account does not belong to user';
  END IF;

  IF NEW.category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM categories WHERE id = NEW.category_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'transaction category does not belong to user';
  END IF;

  IF NEW.type = 'transfer' AND (NEW.to_account_id IS NULL OR NEW.to_account_id = NEW.account_id) THEN
    RAISE EXCEPTION 'transfer requires a distinct destination account';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone)
 RETURNS SETOF record
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pg_stat_statements', $function$pg_stat_statements_1_11$function$
;

CREATE OR REPLACE FUNCTION public.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone)
 RETURNS record
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pg_stat_statements', $function$pg_stat_statements_info$function$
;

CREATE OR REPLACE FUNCTION public.pg_stat_statements_reset(userid oid DEFAULT 0, dbid oid DEFAULT 0, queryid bigint DEFAULT 0, minmax_only boolean DEFAULT false)
 RETURNS timestamp with time zone
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pg_stat_statements', $function$pg_stat_statements_reset_1_11$function$
;

CREATE OR REPLACE FUNCTION public.seed_my_data(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    acct_checking UUID;
    acct_savings UUID;
    acct_credit UUID;
    acct_invest UUID;
    cat_salary UUID;
    cat_freelance UUID;
    cat_invest_inc UUID;
    cat_food UUID;
    cat_transport UUID;
    cat_home UUID;
    cat_entertainment UUID;
    cat_shopping UUID;
    cat_health UUID;
    cat_subscriptions UUID;
    cnt INT;
BEGIN
    SELECT COUNT(*) INTO cnt FROM accounts WHERE user_id = p_user_id;
    IF cnt > 0 THEN
        RETURN 'Data already exists. Delete your data first or use the app as-is.';
    END IF;

    -- ACCOUNTS
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES 
    (p_user_id, 'Main Checking', 'checking', 8450.75, '#22c55e', 'wallet') RETURNING id INTO acct_checking;
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES 
    (p_user_id, 'Emergency Savings', 'savings', 25000.00, '#3b82f6', 'piggy-bank') RETURNING id INTO acct_savings;
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES 
    (p_user_id, 'Travel Rewards Card', 'credit', -1542.50, '#f43f5e', 'credit-card') RETURNING id INTO acct_credit;
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES 
    (p_user_id, 'Investment Portfolio', 'investment', 45000.00, '#8b5cf6', 'trending-up') RETURNING id INTO acct_invest;

    -- INCOME CATEGORIES
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (p_user_id, 'Salary', 'income', '#10b981', 'briefcase') RETURNING id INTO cat_salary;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (p_user_id, 'Freelance', 'income', '#34d399', 'laptop') RETURNING id INTO cat_freelance;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (p_user_id, 'Investments', 'income', '#8b5cf6', 'trending-up') RETURNING id INTO cat_invest_inc;

    -- EXPENSE CATEGORIES
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (p_user_id, 'Food & Dining', 'expense', '#f59e0b', 'utensils') RETURNING id INTO cat_food;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (p_user_id, 'Transportation', 'expense', '#3b82f6', 'car') RETURNING id INTO cat_transport;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (p_user_id, 'Rent & Utilities', 'expense', '#6366f1', 'home') RETURNING id INTO cat_home;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (p_user_id, 'Entertainment', 'expense', '#ec4899', 'film') RETURNING id INTO cat_entertainment;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (p_user_id, 'Shopping', 'expense', '#8b5cf6', 'shopping-bag') RETURNING id INTO cat_shopping;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (p_user_id, 'Health & Wellness', 'expense', '#ef4444', 'heart') RETURNING id INTO cat_health;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (p_user_id, 'Subscriptions', 'expense', '#06b6d4', 'repeat') RETURNING id INTO cat_subscriptions;

    -- TRANSACTIONS: Last Month
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_checking, cat_salary, 'income', 6500.00, 'Monthly Salary', CURRENT_DATE - INTERVAL '32 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (p_user_id, acct_checking, cat_home, 'expense', 2200.00, 'Monthly Rent', CURRENT_DATE - INTERVAL '30 days', true, 'monthly');

    -- TRANSACTIONS: This Month - Income
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_checking, cat_salary, 'income', 6500.00, 'Monthly Salary', CURRENT_DATE - INTERVAL '2 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_checking, cat_freelance, 'income', 1200.00, 'Website Redesign', CURRENT_DATE - INTERVAL '10 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_checking, cat_freelance, 'income', 450.00, 'Logo Design', CURRENT_DATE - INTERVAL '18 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_invest, cat_invest_inc, 'income', 125.50, 'Quarterly Dividend', CURRENT_DATE - INTERVAL '8 days');

    -- TRANSACTIONS: This Month - Expenses
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (p_user_id, acct_checking, cat_home, 'expense', 2200.00, 'Monthly Rent', CURRENT_DATE - INTERVAL '1 day', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_checking, cat_home, 'expense', 165.00, 'Electric & Gas', CURRENT_DATE - INTERVAL '5 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (p_user_id, acct_checking, cat_home, 'expense', 79.99, 'Internet', CURRENT_DATE - INTERVAL '12 days', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_food, 'expense', 215.80, 'Weekly Groceries', CURRENT_DATE - INTERVAL '3 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_food, 'expense', 45.20, 'Grocery Run', CURRENT_DATE - INTERVAL '7 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_food, 'expense', 132.50, 'Weekly Groceries', CURRENT_DATE - INTERVAL '14 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_food, 'expense', 95.00, 'Birthday Dinner', CURRENT_DATE - INTERVAL '4 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_food, 'expense', 32.50, 'Lunch', CURRENT_DATE - INTERVAL '9 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_food, 'expense', 18.75, 'Coffee', CURRENT_DATE - INTERVAL '1 day');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_transport, 'expense', 65.00, 'Gas', CURRENT_DATE - INTERVAL '6 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_transport, 'expense', 48.50, 'Gas', CURRENT_DATE - INTERVAL '16 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_transport, 'expense', 25.00, 'Uber', CURRENT_DATE - INTERVAL '11 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_shopping, 'expense', 189.00, 'Running Shoes', CURRENT_DATE - INTERVAL '7 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_shopping, 'expense', 59.99, 'Amazon Order', CURRENT_DATE - INTERVAL '13 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_shopping, 'expense', 245.00, 'Winter Jacket', CURRENT_DATE - INTERVAL '19 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (p_user_id, acct_checking, cat_health, 'expense', 75.00, 'Gym Membership', CURRENT_DATE - INTERVAL '5 days', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_health, 'expense', 35.00, 'Vitamins', CURRENT_DATE - INTERVAL '15 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (p_user_id, acct_credit, cat_subscriptions, 'expense', 15.99, 'Netflix', CURRENT_DATE - INTERVAL '8 days', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (p_user_id, acct_credit, cat_subscriptions, 'expense', 10.99, 'Spotify', CURRENT_DATE - INTERVAL '12 days', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (p_user_id, acct_credit, cat_subscriptions, 'expense', 14.99, 'YouTube Premium', CURRENT_DATE - INTERVAL '17 days', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (p_user_id, acct_credit, cat_subscriptions, 'expense', 9.99, 'Cloud Storage', CURRENT_DATE - INTERVAL '21 days', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_entertainment, 'expense', 45.00, 'Concert Tickets', CURRENT_DATE - INTERVAL '10 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (p_user_id, acct_credit, cat_entertainment, 'expense', 28.50, 'Movie Night', CURRENT_DATE - INTERVAL '6 days');

    -- BUDGETS
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (p_user_id, cat_food, 800.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (p_user_id, cat_entertainment, 200.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (p_user_id, cat_shopping, 400.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (p_user_id, cat_transport, 300.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (p_user_id, cat_subscriptions, 100.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));

    -- GOALS
    INSERT INTO goals (user_id, name, target_amount, current_amount, deadline, color, icon) VALUES
    (p_user_id, 'Emergency Fund', 30000.00, 25000.00, CURRENT_DATE + INTERVAL '6 months', '#22c55e', 'target');
    INSERT INTO goals (user_id, name, target_amount, current_amount, deadline, color, icon) VALUES
    (p_user_id, 'Dream Vacation', 5000.00, 1850.00, CURRENT_DATE + INTERVAL '8 months', '#3b82f6', 'sparkles');
    INSERT INTO goals (user_id, name, target_amount, current_amount, deadline, color, icon) VALUES
    (p_user_id, 'New Car Down Payment', 15000.00, 4200.00, CURRENT_DATE + INTERVAL '1 year', '#8b5cf6', 'trophy');
    INSERT INTO goals (user_id, name, target_amount, current_amount, deadline, color, icon) VALUES
    (p_user_id, 'Home Renovation', 20000.00, 8500.00, CURRENT_DATE + INTERVAL '18 months', '#f59e0b', 'trending-up');

    RETURN 'Success! Demo data created with 4 accounts, 10 categories, 30+ transactions, 5 budgets, and 4 goals.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.show_db_tree()
 RETURNS TABLE(tree_structure text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- First show all databases
    RETURN QUERY
    SELECT ':file_folder: ' || datname || ' (DATABASE)'
    FROM pg_database 
    WHERE datistemplate = false;

    -- Then show current database structure
    RETURN QUERY
    WITH RECURSIVE 
    -- Get schemas
    schemas AS (
        SELECT 
            n.nspname AS object_name,
            1 AS level,
            n.nspname AS path,
            'SCHEMA' AS object_type
        FROM pg_namespace n
        WHERE n.nspname NOT LIKE 'pg_%' 
        AND n.nspname != 'information_schema'
    ),

    -- Get all objects (tables, views, functions, etc.)
    objects AS (
        SELECT 
            c.relname AS object_name,
            2 AS level,
            s.path || ' → ' || c.relname AS path,
            CASE c.relkind
                WHEN 'r' THEN 'TABLE'
                WHEN 'v' THEN 'VIEW'
                WHEN 'm' THEN 'MATERIALIZED VIEW'
                WHEN 'i' THEN 'INDEX'
                WHEN 'S' THEN 'SEQUENCE'
                WHEN 'f' THEN 'FOREIGN TABLE'
            END AS object_type
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN schemas s ON n.nspname = s.object_name
        WHERE c.relkind IN ('r','v','m','i','S','f')

        UNION ALL

        SELECT 
            p.proname AS object_name,
            2 AS level,
            s.path || ' → ' || p.proname AS path,
            'FUNCTION' AS object_type
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN schemas s ON n.nspname = s.object_name
    ),

    -- Combine schemas and objects
    combined AS (
        SELECT * FROM schemas
        UNION ALL
        SELECT * FROM objects
    )

    -- Final output with tree-like formatting
    SELECT 
        REPEAT('    ', level) || 
        CASE 
            WHEN level = 1 THEN '└── :open_file_folder: '
            ELSE '    └── ' || 
                CASE object_type
                    WHEN 'TABLE' THEN ':bar_chart: '
                    WHEN 'VIEW' THEN ':eye: '
                    WHEN 'MATERIALIZED VIEW' THEN ':newspaper: '
                    WHEN 'FUNCTION' THEN ':zap: '
                    WHEN 'INDEX' THEN ':mag: '
                    WHEN 'SEQUENCE' THEN ':1234: '
                    WHEN 'FOREIGN TABLE' THEN ':globe_with_meridians: '
                    ELSE ''
                END
        END || object_name || ' (' || object_type || ')'
    FROM combined
    ORDER BY path;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_account_balance()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.type = 'income' THEN
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'transfer' THEN
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.to_account_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'income' THEN
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'transfer' THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.to_account_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.type = 'income' THEN
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'transfer' THEN
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.to_account_id;
    END IF;

    IF NEW.type = 'income' THEN
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'transfer' THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.to_account_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_debt_balance_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_debt_id UUID;
  v_original NUMERIC;
  v_total NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_debt_id := NEW.debt_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_debt_id := NEW.debt_id;
  ELSE
    v_debt_id := OLD.debt_id;
  END IF;

  SELECT original_amount INTO v_original FROM debts WHERE id = v_debt_id;

  -- The row change is already visible here (AFTER trigger), so a single
  -- recompute handles all three operations symmetrically.
  SELECT COALESCE(SUM(p.principal_amount), 0) INTO v_total
    FROM debt_payments p
   WHERE p.debt_id = v_debt_id;

  -- Refuse overpayments loudly rather than silently clamping to 0.
  IF v_total > v_original THEN
    RAISE EXCEPTION
      'debt payment would bring total principal % above original amount % on debt %',
      v_total, v_original, v_debt_id;
  END IF;

  UPDATE debts
     SET current_balance = LEAST(v_original, GREATEST(0, v_total))
   WHERE id = v_debt_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.uuid_generate_v1()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v1$function$
;

CREATE OR REPLACE FUNCTION public.uuid_generate_v1mc()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v1mc$function$
;

CREATE OR REPLACE FUNCTION public.uuid_generate_v3(namespace uuid, name text)
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v3$function$
;

CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v4$function$
;

CREATE OR REPLACE FUNCTION public.uuid_generate_v5(namespace uuid, name text)
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v5$function$
;

CREATE OR REPLACE FUNCTION public.uuid_nil()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_nil$function$
;

CREATE OR REPLACE FUNCTION public.uuid_ns_dns()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_dns$function$
;

CREATE OR REPLACE FUNCTION public.uuid_ns_oid()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_oid$function$
;

CREATE OR REPLACE FUNCTION public.uuid_ns_url()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_url$function$
;

CREATE OR REPLACE FUNCTION public.uuid_ns_x500()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_x500$function$
;

