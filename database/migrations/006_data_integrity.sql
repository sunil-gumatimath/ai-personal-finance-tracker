-- ====================================================================
-- MIGRATION 006: Data Integrity Hardening
--
-- Idempotent DDL:
--   - debt_payments / debts CHECK constraints (guarded ADD CONSTRAINT)
--   - symmetric, exception-raising debt balance trigger
--   - relax goals.valid_goal_progress (over-contribution now allowed; UI caps it)
--   - pre-dedupe + unique backstops for recurring occurrences and categories
--   - budgets.category_id FK rebuilt as ON DELETE RESTRICT (preserve budget history)
--   - missing performance indexes; drop redundant idx_transactions_user_id
--
-- Safe to re-run: every statement is guarded (IF NOT EXISTS / IF EXISTS /
-- pg_constraint lookups) or inherently idempotent.
-- ====================================================================

-- --------------------------------------------------------------------
-- (a) debt_payments integrity: principal/interest must be non-negative
--     and must not sum beyond the recorded total amount.
--     Postgres lacks ADD CONSTRAINT IF NOT EXISTS, so guard each one via
--     a pg_constraint lookup keyed on our explicit constraint names.
-- --------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_debt_payments_principal_nonneg'
      AND conrelid = 'debt_payments'::regclass
  ) THEN
    ALTER TABLE debt_payments
      ADD CONSTRAINT ck_debt_payments_principal_nonneg CHECK (principal_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_debt_payments_interest_nonneg'
      AND conrelid = 'debt_payments'::regclass
  ) THEN
    ALTER TABLE debt_payments
      ADD CONSTRAINT ck_debt_payments_interest_nonneg CHECK (interest_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_debt_payments_parts_le_total'
      AND conrelid = 'debt_payments'::regclass
  ) THEN
    ALTER TABLE debt_payments
      ADD CONSTRAINT ck_debt_payments_parts_le_total
      CHECK (principal_amount + interest_amount <= amount);
  END IF;
END;
$$;

-- --------------------------------------------------------------------
-- (b) debts sanity: current_balance may never go negative.
--     (002 declares this inline as well; this named copy guarantees it
--     even on databases created before that declaration existed.)
-- --------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_debts_current_balance_nonneg'
      AND conrelid = 'debts'::regclass
  ) THEN
    ALTER TABLE debts
      ADD CONSTRAINT ck_debts_current_balance_nonneg CHECK (current_balance >= 0);
  END IF;
END;
$$;

-- --------------------------------------------------------------------
-- (c) Fix the asymmetric balance trigger from 002:
--       * INSERT used GREATEST(0, ...) to silently clamp negative
--         balances, but DELETE blindly added the principal back —
--         a clamped INSERT followed by its DELETE corrupted balances.
--       * Now ALL paths recompute current_balance from the payment
--         history (source of truth), making INSERT / UPDATE / DELETE
--         symmetric and order-independent: any replay of operations
--         converges to the same balance.
--       * Overpayments RAISE an exception. The guard compares the
--         running principal TOTAL against original_amount — NOT a
--         transient balance column — so it stays correct even when
--         other writes to the same debt happen inside one statement
--         (AFTER-trigger firing order is not guaranteed there).
--       * Ceiling semantics preserved: balance never exceeds
--         original_amount, floored at 0.
--
--     NOTE: once payments exist, current_balance becomes fully derived
--     from SUM(principal_amount). Any manually seeded opening balance
--     is superseded the first time this trigger touches the debt.
--     Operators should reconcile such rows before relying on deletes.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_debt_balance_on_payment()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_debt_balance ON debt_payments;
CREATE TRIGGER trigger_update_debt_balance
  AFTER INSERT OR UPDATE OR DELETE ON debt_payments
  FOR EACH ROW EXECUTE FUNCTION update_debt_balance_on_payment();

-- --------------------------------------------------------------------
-- (d) Relax goals.valid_goal_progress: it forbade current > target,
--     blocking legitimate over-contribution. Over-contribution is now
--     allowed (the UI caps input); keep only a non-negative floor.
--     (001 already carries an inline CHECK (current_amount >= 0); this
--     named copy guarantees the floor independently.)
-- --------------------------------------------------------------------
ALTER TABLE goals DROP CONSTRAINT IF EXISTS valid_goal_progress;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_goals_current_amount_nonneg'
      AND conrelid = 'goals'::regclass
  ) THEN
    ALTER TABLE goals
      ADD CONSTRAINT ck_goals_current_amount_nonneg CHECK (current_amount >= 0);
  END IF;
END;
$$;

-- --------------------------------------------------------------------
-- (e) budgets.category_id: CASCADE destroyed budget history whenever a
--     user deleted a category. Rebuild the FK as ON DELETE RESTRICT.
--     Constraint name comes from 001's inline column REFERENCES, which
--     Postgres auto-names budgets_category_id_fkey.
-- --------------------------------------------------------------------
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_category_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'budgets_category_id_fkey'
      AND conrelid = 'budgets'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE budgets
      ADD CONSTRAINT budgets_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

-- --------------------------------------------------------------------
-- (g/h) Pre-dedupe BEFORE creating the unique backstops below: existing
-- duplicate rows would make those indexes fail. These DELETEs are
-- no-ops on already-clean data.
--
-- NOTE for operators: deleting duplicate transaction occurrences fires
-- the account-balance trigger, correctly reversing the double-counted
-- balance effect. Deleting duplicate categories NULLs their
-- transactions' category_id (ON DELETE SET NULL) and removes their
-- budgets (legacy CASCADE — this runs before the RESTRICT rebuild).
-- --------------------------------------------------------------------

-- (g) Recurring occurrences: keep the earliest-created duplicate
-- (created_at, ctid tiebreak) per (user, parent, date).
DELETE FROM transactions dup
USING transactions keep
WHERE dup.recurring_parent_id IS NOT NULL
  AND keep.recurring_parent_id IS NOT NULL
  AND dup.user_id = keep.user_id
  AND dup.recurring_parent_id = keep.recurring_parent_id
  AND dup.date = keep.date
  AND (dup.created_at, dup.ctid) > (keep.created_at, keep.ctid);

-- Backstop against cron double-runs materializing the same occurrence twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_recurring_occurrence
  ON transactions(user_id, recurring_parent_id, date)
  WHERE recurring_parent_id IS NOT NULL;

-- (h) Categories: keep the lowest id per (user, name).
DELETE FROM categories dup
USING categories keep
WHERE dup.user_id = keep.user_id
  AND dup.name = keep.name
  AND dup.id > keep.id;

-- Default categories are seeded per user; enforce (user, name) uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_user_name
  ON categories(user_id, name);

-- --------------------------------------------------------------------
-- (f) Missing performance indexes + redundant index removal.
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_user_category_date
  ON transactions(user_id, category_id, date);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_date
  ON debt_payments(debt_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_system_logs_user_timestamp
  ON system_logs(user_id, timestamp DESC);

-- Redundant: fully prefix-covered by idx_transactions_user_date (user_id, date DESC).
DROP INDEX IF EXISTS idx_transactions_user_id;
