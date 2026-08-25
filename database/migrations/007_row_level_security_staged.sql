-- ====================================================================
-- MIGRATION 007: Row-Level Security — STAGED (policies only, INERT)
--
-- ⚠️  THIS MIGRATION IS SAFE TO APPLY AS-IS BUT DELIBERATELY DOES NOT
--     ENABLE ROW LEVEL SECURITY. Policies without ENABLE do nothing.
--
-- WHY STAGED?
--   Full RLS enforcement requires the backend to declare "which user is
--   making this request" via a per-transaction session variable:
--
--       BEGIN;
--       SET LOCAL app.current_user_id = '<uuid>';
--       ... queries ...
--       COMMIT;
--
--   The current data layer uses the Neon HTTP driver (@neondatabase/
--   serverless `neon()`), where every query() is an isolated auto-commit
--   HTTP request. There is no way to SET a config var and have it apply
--   to subsequent requests, so if ENABLE ROW LEVEL SECURITY were run
--   today, every policy would evaluate against a NULL/empty
--   app.current_user_id and the app would silently see zero rows.
--
-- WHAT THIS FILE DOES
--   Defines (idempotently) a tenant_isolation_<table> policy on every
--   tenant table so that activation becomes a pure DDL flip later.
--
-- ACTIVATION CHECKLIST (requires app-side session var support)
--   1. Switch the data layer to the WebSocket Pool driver
--      (`Pool` from @neondatabase/serverless) so BEGIN/COMMIT and
--      SET LOCAL span multiple queries on one connection.
--   2. Wrap every request in:
--          BEGIN;
--          SET LOCAL app.current_user_id = '<request-user-uuid>';
--          ...queries...
--          COMMIT;
--      (SET LOCAL scopes the var to the transaction; it cannot leak.)
--   3. Uncomment the "-- ACTIVATION" block at the bottom of this file
--      (ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY lines).
--   4. Verify with two different user ids that cross-tenant reads/writes fail.
--
-- NOTES
--   * current_setting('app.current_user_id', true) returns NULL when the
--     variable is unset; NULLIF(..., '') also treats '' as unset. An
--     unset variable therefore matches no rows (fail-closed).
--   * system_logs.user_id is nullable; once activated, rows written with
--     a NULL user_id will only be visible outside tenant context
--     (e.g. as table owner / superuser). Audit writes should set it.
-- ====================================================================

-- --------------------------------------------------------------------
-- Policies (inert until ENABLE ROW LEVEL SECURITY is executed)
-- --------------------------------------------------------------------

DROP POLICY IF EXISTS tenant_isolation_profiles ON profiles;
CREATE POLICY tenant_isolation_profiles ON profiles
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_accounts ON accounts;
CREATE POLICY tenant_isolation_accounts ON accounts
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_categories ON categories;
CREATE POLICY tenant_isolation_categories ON categories
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_transactions ON transactions;
CREATE POLICY tenant_isolation_transactions ON transactions
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_budgets ON budgets;
CREATE POLICY tenant_isolation_budgets ON budgets
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_goals ON goals;
CREATE POLICY tenant_isolation_goals ON goals
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_ai_insights ON ai_insights;
CREATE POLICY tenant_isolation_ai_insights ON ai_insights
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_debts ON debts;
CREATE POLICY tenant_isolation_debts ON debts
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_debt_payments ON debt_payments;
CREATE POLICY tenant_isolation_debt_payments ON debt_payments
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_ai_digests ON ai_digests;
CREATE POLICY tenant_isolation_ai_digests ON ai_digests
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_system_logs ON system_logs;
CREATE POLICY tenant_isolation_system_logs ON system_logs
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- --------------------------------------------------------------------
-- ACTIVATION (requires app-side session var support; see docs and the
-- checklist at the top of this file). Do NOT uncomment until the data
-- layer sets app.current_user_id inside every transaction:
--
-- ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE profiles        FORCE  ROW LEVEL SECURITY;
-- ALTER TABLE accounts        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE accounts        FORCE  ROW LEVEL SECURITY;
-- ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE categories      FORCE  ROW LEVEL SECURITY;
-- ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions    FORCE  ROW LEVEL SECURITY;
-- ALTER TABLE budgets         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE budgets         FORCE  ROW LEVEL SECURITY;
-- ALTER TABLE goals           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE goals           FORCE  ROW LEVEL SECURITY;
-- ALTER TABLE ai_insights     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_insights     FORCE  ROW LEVEL SECURITY;
-- ALTER TABLE debts           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE debts           FORCE  ROW LEVEL SECURITY;
-- ALTER TABLE debt_payments   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE debt_payments   FORCE  ROW LEVEL SECURITY;
-- ALTER TABLE ai_digests      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_digests      FORCE  ROW LEVEL SECURITY;
-- ALTER TABLE system_logs     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE system_logs     FORCE  ROW LEVEL SECURITY;
-- --------------------------------------------------------------------
