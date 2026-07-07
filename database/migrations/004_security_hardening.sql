-- Security hardening: durable rate limits and tenant-consistency checks.

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_updated_at ON rate_limits(updated_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked_until ON rate_limits(blocked_until);

CREATE OR REPLACE FUNCTION ensure_transaction_refs_owned()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_transaction_refs_owned ON transactions;
CREATE TRIGGER trg_ensure_transaction_refs_owned
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION ensure_transaction_refs_owned();

CREATE OR REPLACE FUNCTION ensure_budget_refs_owned()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM categories WHERE id = NEW.category_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'budget category does not belong to user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_budget_refs_owned ON budgets;
CREATE TRIGGER trg_ensure_budget_refs_owned
BEFORE INSERT OR UPDATE ON budgets
FOR EACH ROW EXECUTE FUNCTION ensure_budget_refs_owned();

CREATE OR REPLACE FUNCTION ensure_category_parent_owned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM categories WHERE id = NEW.parent_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'parent category does not belong to user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_category_parent_owned ON categories;
CREATE TRIGGER trg_ensure_category_parent_owned
BEFORE INSERT OR UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION ensure_category_parent_owned();

CREATE OR REPLACE FUNCTION ensure_debt_payment_refs_owned()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM debts WHERE id = NEW.debt_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'debt payment debt does not belong to user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_debt_payment_refs_owned ON debt_payments;
CREATE TRIGGER trg_ensure_debt_payment_refs_owned
BEFORE INSERT OR UPDATE ON debt_payments
FOR EACH ROW EXECUTE FUNCTION ensure_debt_payment_refs_owned();
