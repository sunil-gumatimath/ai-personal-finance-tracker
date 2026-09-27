-- ---------------------------------------------------------------------------
-- 008: data integrity round two
--
-- Closes the gaps left after 006, and adds the constraints that make several
-- previously-implicit application invariants impossible to violate from any
-- write path (API, psql, import script, or a future service).
--
-- All statements are idempotent so a partial run can be safely re-run — the
-- same contract every migration in this project follows.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- (a) accounts.balance must never be NULL.
--
-- It has no NOT NULL and no CHECK, so `balance = NULL` silently poisons every
-- aggregate that sums it: the Dashboard total, the accounts page split into
-- assets/liabilities, the Reports PDF, and the AI chat's balance answers all
-- coerce NULL to 0 and quietly under-report.
--
-- The column is also trigger-maintained (migration 001), which is the reason
-- it is safe to tighten now: `DEFAULT 0` covers the insert path, and the
-- `update_account_balance` trigger writes a number on every transaction.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_accounts_balance_not_null'
  ) THEN
    -- Backfill before constraining: any existing NULL becomes 0 rather than
    -- aborting the migration on real data.
    UPDATE accounts SET balance = 0 WHERE balance IS NULL;
    ALTER TABLE accounts
      ALTER COLUMN balance SET DEFAULT 0,
      ALTER COLUMN balance SET NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- (b) debts.current_balance can never exceed original_amount.
--
-- 006 only guaranteed the floor (`>= 0`). A balance above the original was
-- directly writable, and then EVERY subsequent payment write failed: the
-- `update_debt_balance_on_payment` trigger raises whenever the running
-- principal total exceeds `original_amount`, so one bad row could permanently
-- block payments on that debt with a raw 500.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_debts_balance_le_original'
  ) THEN
    -- Clamp first, then constrain. Both steps are idempotent, and clamping to
    -- the original amount is the most generous value that satisfies the
    -- invariant, so no real balance is understated.
    --
    -- NOTE: deliberately NOT a nested DO/EXCEPTION block. The migration runner
    -- splits files with a dollar-quote-aware scanner, and a `$$` inside a `$$`
    -- body defeats it — it would split one block into five fragments and send
    -- each to the driver separately. Flattening this keeps the file safe to run.
    UPDATE debts SET current_balance = original_amount
     WHERE current_balance > original_amount;
    ALTER TABLE debts
      ADD CONSTRAINT ck_debts_balance_le_original
      CHECK (current_balance <= original_amount);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- (c) debts.interest_rate: document the unit and bound it.
--
-- `DECIMAL(5,2)` with only a `>= 0` guard allowed 999.99% and could not
-- represent a rate like 5.125%. The app stores a PERCENTAGE (see
-- `debt-calculations.ts`, which divides by 100/12), so cap it at a value no
-- real product uses while still allowing sub-0.01% promotional rates.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_debts_interest_rate_range'
  ) THEN
    ALTER TABLE debts
      ADD CONSTRAINT ck_debts_interest_rate_range
      CHECK (interest_rate >= 0 AND interest_rate <= 100);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- (d) ai_digests.week_start — deliberately NO day-of-week constraint.
--
-- Migration 005 documented "One row per user per week (Monday-based)" but
-- enforced nothing, and the route stored a rolling `today - N days` date, so
-- regenerating the same period on a different day inserted a duplicate row
-- instead of replacing it. `getPeriodStartDate` in `ai-digest.routes.ts` now
-- normalises the key to the period's own start: Monday for a week, the 1st for
-- a month, Jan 1 for a year.
--
-- An earlier draft of this migration added
-- `CHECK (EXTRACT(ISODOW FROM week_start) = 1)`. That was wrong, and checking
-- the live data is what caught it: 3 of the 4 existing rows are not Mondays
-- (Thu 2025-08-28, Wed 2026-07-29, Fri 2026-08-21 — the rolling starts the bug
-- produced), so the constraint would have aborted the migration. Worse, it
-- would have rejected every future monthly and yearly digest, because the 1st
-- of a month is not a Monday. The column is really a *period start* key, not a
-- week start; only the application can know which period a given key means, so
-- there is no check that is both correct and enforceable here.
--
-- What IS enforced is the uniqueness that actually mattered: one row per user
-- per period key (migration 005's UNIQUE constraint).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- (e) transactions.created_at must not be NULL.
--
-- 006's duplicate-occurrence dedupe compares `(dup.created_at, dup.ctid) >
-- (keep.created_at, keep.ctid)`. With a NULL `created_at` that comparison is
-- NULL, so the duplicate is NOT deleted — and the `uq_recurring_occurrence`
-- index created immediately afterwards then aborted the migration with a
-- unique violation. The column had a DEFAULT but no NOT NULL.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_transactions_created_at_not_null'
  ) THEN
    UPDATE transactions SET created_at = NOW() WHERE created_at IS NULL;
    ALTER TABLE transactions
      ALTER COLUMN created_at SET DEFAULT NOW(),
      ALTER COLUMN created_at SET NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- (f) Index the two FK columns that had none.
--
-- Both carry `ON DELETE SET NULL`, so deleting a parent row forces Postgres to
-- find referencing children. Without an index that is a sequential scan of the
-- child table on every such delete.
--
-- `transactions.recurring_parent_id` matters most: the partial unique index
-- `uq_recurring_occurrence` leads with `user_id`, so it cannot serve a
-- `WHERE recurring_parent_id = $1` lookup at all.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_categories_parent_id
  ON categories (parent_id)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_recurring_parent_id
  ON transactions (recurring_parent_id)
  WHERE recurring_parent_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- (g) Index the cross-user recurring cron query.
--
-- `listUsersWithDueRecurring` filters on `is_recurring` / `next_due_date`
-- with NO `user_id` predicate, but `idx_transactions_recurring_due` leads with
-- `user_id`, so it is unusable here and the cron degrades to a scan that grows
-- with the total number of recurring rows across every tenant.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_due_scan
  ON transactions (next_due_date)
  WHERE is_recurring = true AND next_due_date IS NOT NULL;

-- ---------------------------------------------------------------------------
-- (h) Drop the index that duplicates the UNIQUE constraint on profiles.user_id.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_profiles_user_id;

-- ---------------------------------------------------------------------------
-- (i) drop the two low-cardinality indexes on debts.
--
-- Single-column boolean/enum indexes on a per-user table: every repository
-- query filters `WHERE user_id = $1`, which `idx_debts_user_id` already
-- serves. These only add write amplification.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_debts_type;
DROP INDEX IF EXISTS idx_debts_is_active;

-- ---------------------------------------------------------------------------
-- (j) rate_limits.updated_at had no maintenance trigger, unlike every other
-- updated_at column. The app happens to write it explicitly, so this is
-- consistency rather than a live bug.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_rate_limits_updated_at ON rate_limits;
CREATE TRIGGER update_rate_limits_updated_at
  BEFORE UPDATE ON rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- (k) Harden the staged RLS policies, and record what enabling them actually
-- requires.
--
-- RLS is still disabled (every ENABLE line in migration 007 is commented out),
-- so none of this is live today.
--
-- Verified against the live database on 2026-09-27. Two corrections to what an
-- earlier draft of this comment asserted, both of which testing disproved:
--
--  * WRONG: "a NULL user_id insert is REJECTED by the old WITH CHECK". It is
--    not. `user_id = NULLIF(...)` with a NULL user_id evaluates to NULL, and
--    PostgreSQL treats a NULL check result as SATISFIED — only FALSE violates.
--    Probed with RLS enabled: the old policy accepted a NULL-user_id audit row
--    without complaint. So the predicted loss of cron/audit rows does not
--    happen.
--
--  * NOT VERIFIABLE HERE: "the ::uuid cast RAISES on a non-UUID session
--    variable". That is true SQL semantics, but it could not be exercised,
--    because the app connects as `neondb_owner`, which has rolbypassrls = true
--    — so RLS (and therefore the policy expression) is skipped entirely for
--    this connection. See the BYPASSRLS note added to migration 007: enabling
--    RLS on its own would change nothing at all.
--
-- What this section does change, and why it is still worth doing:
--
--  1. The `::uuid` cast is removed in favour of comparing `user_id::text`
--     against the session variable. That removes a latent 500-instead-of-fail-
--     closed path for the day a non-BYPASSRLS role is introduced.
--
--  2. `system_logs` gains an explicit `user_id IS NULL OR ...`. Under the old
--     USING clause a NULL-user_id row evaluates to NULL, which for a SELECT
--     means FALSE — the row is filtered OUT. So a tenant could never read back
--     its own NULL-scoped audit rows even though it could write them.
--
--  3. `public.users` still has no policy, while `auth.routes.ts` and
--     `audit-log.service.ts` read from it. Once a non-BYPASSRLS role exists,
--     enabling RLS as written turns authentication into a deny-all outage.
--     `users` is deliberately left out of the isolation set: it is the identity
--     table the session lookup reads through, keyed by the very id the app has
--     already verified.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation_system_logs ON system_logs;
CREATE POLICY tenant_isolation_system_logs ON system_logs
  FOR ALL
  USING (
    user_id IS NULL
    OR user_id::text = NULLIF(current_setting('app.current_user_id', true), '')
  )
  WITH CHECK (
    -- A NULL user_id is a legitimate system-level audit row (cron, startup,
    -- unhandled error). Allow the insert; reads still require either the
    -- matching tenant or a NULL row, which only the owning role can see.
    user_id IS NULL
    OR user_id::text = NULLIF(current_setting('app.current_user_id', true), '')
  );

-- Rebuild the tenant policies without the uuid cast, for every table.
-- Idempotent: DROP ... IF EXISTS then CREATE.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'accounts', 'categories', 'transactions', 'budgets',
    'goals', 'ai_insights', 'debts', 'debt_payments', 'ai_digests'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%s ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_%1$s ON %1$I
         FOR ALL
         USING (user_id::text = NULLIF(current_setting(''app.current_user_id'', true), ''''))
         WITH CHECK (user_id::text = NULLIF(current_setting(''app.current_user_id'', true), ''''))',
      t
    );
  END LOOP;
END $$;
