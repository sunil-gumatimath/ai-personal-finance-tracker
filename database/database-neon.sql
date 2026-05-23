-- ====================================================================
-- PERSONAL FINANCE TRACKER - NEON DATABASE SETUP
-- ====================================================================
--
-- A clean database schema for Personal Finance Tracker using Neon.
--
-- HOW TO USE:
--   1. Copy this entire file into Neon SQL Editor
--   2. Click "Run" to create tables, functions, and triggers
--   3. The schema is ready for use - no mock data is inserted
--
-- ====================================================================

-- =====================================================
-- CLEANUP: Drop everything robustly
-- =====================================================

-- 1. Drop Triggers
DROP TRIGGER IF EXISTS trigger_update_account_balance ON transactions;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
DROP TRIGGER IF EXISTS update_budgets_updated_at ON budgets;
DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- 2. Drop Tables (CASCADE removes Policies, Triggers, and Indexes automatically)
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS ai_insights CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 3. Drop debt triggers
DROP TRIGGER IF EXISTS update_debts_updated_at ON debts;
DROP TRIGGER IF EXISTS trigger_update_debt_balance ON debt_payments;

-- 4. Drop Debt tables
DROP TABLE IF EXISTS debt_payments CASCADE;
DROP TABLE IF EXISTS debts CASCADE;

-- 5. Drop Functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS update_account_balance();
DROP FUNCTION IF EXISTS update_debt_balance_on_payment();
DROP FUNCTION IF EXISTS seed_my_data(uuid);
DROP FUNCTION IF EXISTS show_db_tree();

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: users (Simple custom auth)
-- =====================================================
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  encrypted_password TEXT, -- Nullable: Neon Auth manages passwords externally
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);

-- =====================================================
-- TABLE: profiles
-- =====================================================
CREATE TABLE profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  currency TEXT DEFAULT 'USD',
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: accounts
-- =====================================================
CREATE TABLE accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'investment', 'cash', 'other')),
  balance DECIMAL(15, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  color TEXT DEFAULT '#22c55e',
  icon TEXT DEFAULT 'wallet',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: categories
-- =====================================================
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT DEFAULT '#3b82f6',
  icon TEXT DEFAULT 'tag',
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: transactions
-- =====================================================
CREATE TABLE transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  to_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT, -- For transfers
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure transfers have a destination account
  CONSTRAINT transfer_requires_to_account CHECK (
    (type = 'transfer' AND to_account_id IS NOT NULL) OR
    (type != 'transfer' AND to_account_id IS NULL)
  )
);

-- =====================================================
-- FUNCTION: Auto-update account balance on transaction change
-- Handles income, expense, and transfer types
-- =====================================================
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle DELETE: reverse the old transaction
  IF TG_OP = 'DELETE' THEN
    IF OLD.type = 'income' THEN
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'transfer' THEN
      -- Reverse transfer: add back to source, subtract from destination
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.to_account_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT: apply the new transaction
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'income' THEN
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'transfer' THEN
      -- Transfer: subtract from source, add to destination
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.to_account_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE: reverse old, apply new
  IF TG_OP = 'UPDATE' THEN
    -- Reverse old transaction
    IF OLD.type = 'income' THEN
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'transfer' THEN
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.to_account_id;
    END IF;

    -- Apply new transaction
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- =====================================================
-- TABLE: budgets
-- =====================================================
CREATE TABLE budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure end_date is after start_date if provided
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- =====================================================
-- TABLE: goals
-- =====================================================
CREATE TABLE goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(15, 2) NOT NULL CHECK (target_amount > 0),
  current_amount DECIMAL(15, 2) DEFAULT 0 CHECK (current_amount >= 0),
  deadline DATE,
  color TEXT DEFAULT '#22c55e',
  icon TEXT DEFAULT 'target',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure current_amount doesn't exceed target_amount
  CONSTRAINT valid_goal_progress CHECK (current_amount <= target_amount)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_category_id ON budgets(category_id);
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);

-- =====================================================
-- FUNCTION: Auto-update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE: ai_insights
-- =====================================================
CREATE TABLE ai_insights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('anomaly', 'coaching', 'kudo')),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  amount DECIMAL(15, 2),
  date DATE,
  is_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_insights_user_id ON ai_insights(user_id);
CREATE INDEX idx_transactions_to_account_id ON transactions(to_account_id);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);

-- Add trigger for users table updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE: system_logs
-- =====================================================
CREATE TABLE system_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX idx_system_logs_action ON system_logs(action);
CREATE INDEX idx_system_logs_severity ON system_logs(severity);

-- =====================================================
-- FUNCTION: seed_my_data
-- Seeds demo data for a given user
-- =====================================================
CREATE OR REPLACE FUNCTION seed_my_data(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
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

    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES
    (p_user_id, 'Main Checking', 'checking', 8450.75, '#22c55e', 'wallet') RETURNING id INTO acct_checking;
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES
    (p_user_id, 'Emergency Savings', 'savings', 25000.00, '#3b82f6', 'piggy-bank') RETURNING id INTO acct_savings;
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES
    (p_user_id, 'Travel Rewards Card', 'credit', -1542.50, '#f43f5e', 'credit-card') RETURNING id INTO acct_credit;
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES
    (p_user_id, 'Investment Portfolio', 'investment', 45000.00, '#8b5cf6', 'trending-up') RETURNING id INTO acct_invest;

    INSERT INTO categories (user_id, name, type, color, icon) VALUES
    (p_user_id, 'Salary', 'income', '#10b981', 'briefcase') RETURNING id INTO cat_salary;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES
    (p_user_id, 'Freelance', 'income', '#34d399', 'laptop') RETURNING id INTO cat_freelance;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES
    (p_user_id, 'Investments', 'income', '#8b5cf6', 'trending-up') RETURNING id INTO cat_invest_inc;
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

    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES
    (p_user_id, acct_checking, cat_salary, 'income', 6500.00, 'Monthly Salary', CURRENT_DATE - INTERVAL '32 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES
    (p_user_id, acct_checking, cat_home, 'expense', 2200.00, 'Monthly Rent', CURRENT_DATE - INTERVAL '30 days', true, 'monthly');

    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES
    (p_user_id, acct_checking, cat_salary, 'income', 6500.00, 'Monthly Salary', CURRENT_DATE - INTERVAL '2 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES
    (p_user_id, acct_checking, cat_freelance, 'income', 1200.00, 'Website Redesign', CURRENT_DATE - INTERVAL '10 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES
    (p_user_id, acct_checking, cat_freelance, 'income', 450.00, 'Logo Design', CURRENT_DATE - INTERVAL '18 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES
    (p_user_id, acct_invest, cat_invest_inc, 'income', 125.50, 'Quarterly Dividend', CURRENT_DATE - INTERVAL '8 days');

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
$$;

-- =====================================================
-- FUNCTION: show_db_tree
-- Shows database structure as a tree
-- =====================================================
CREATE OR REPLACE FUNCTION show_db_tree()
RETURNS TABLE(tree_structure TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT ':file_folder: ' || datname || ' (DATABASE)'
    FROM pg_database
    WHERE datistemplate = false;

    RETURN QUERY
    WITH RECURSIVE
    schemas AS (
        SELECT
            n.nspname AS object_name,
            1 AS level,
            n.nspname AS path,
            'SCHEMA'::TEXT AS object_type
        FROM pg_namespace n
        WHERE n.nspname NOT LIKE 'pg_%'
        AND n.nspname != 'information_schema'
    ),
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
    combined AS (
        SELECT * FROM schemas
        UNION ALL
        SELECT * FROM objects
    )
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
$$;

-- ====================================================================
-- SETUP COMPLETE!
-- The database schema is ready for use.
-- No mock data is inserted - users will create their own data.
-- ====================================================================
