-- ====================================================================
-- MIGRATION 002: Debts & Payments
-- Adds debts and debt_payments tables with triggers and indexes
-- ====================================================================

-- =====================================================
-- TABLE: debts
-- =====================================================
CREATE TABLE IF NOT EXISTS debts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mortgage', 'car_loan', 'student_loan', 'personal_loan', 'credit_card', 'medical', 'other')),
  original_amount DECIMAL(15, 2) NOT NULL CHECK (original_amount > 0),
  current_balance DECIMAL(15, 2) NOT NULL CHECK (current_balance >= 0),
  interest_rate DECIMAL(5, 2) NOT NULL CHECK (interest_rate >= 0),
  minimum_payment DECIMAL(15, 2) NOT NULL CHECK (minimum_payment >= 0),
  due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  lender TEXT,
  notes TEXT,
  color TEXT DEFAULT '#ef4444',
  icon TEXT DEFAULT 'credit-card',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_debt_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- =====================================================
-- TABLE: debt_payments
-- =====================================================
CREATE TABLE IF NOT EXISTS debt_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  principal_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  interest_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FUNCTION: Update debt balance on payment
-- =====================================================
CREATE OR REPLACE FUNCTION update_debt_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE debts
    SET current_balance = GREATEST(0, current_balance - NEW.principal_amount)
    WHERE id = NEW.debt_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE debts
    SET current_balance = current_balance + OLD.principal_amount
    WHERE id = OLD.debt_id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE debts
    SET current_balance = GREATEST(0, current_balance + OLD.principal_amount - NEW.principal_amount)
    WHERE id = NEW.debt_id;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_debt_balance
  AFTER INSERT OR UPDATE OR DELETE ON debt_payments
  FOR EACH ROW EXECUTE FUNCTION update_debt_balance_on_payment();

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_type ON debts(type);
CREATE INDEX IF NOT EXISTS idx_debts_is_active ON debts(is_active);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_user_id ON debt_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_date ON debt_payments(payment_date);
