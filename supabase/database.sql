-- ====================================================================
-- PERSONAL FINANCE TRACKER - COMPLETE DATABASE SETUP
-- ====================================================================
-- 
-- HOW TO USE:
--   1. Copy this entire file into your Supabase SQL Editor
--   2. Click "Run" to create tables and functions
--      (If you see "Success, no rows returned", it worked!)
--   3. Sign up in your app
--   4. Run: SELECT seed_my_data(); to populate demo data
--
-- ====================================================================

-- =====================================================
-- CLEANUP: Drop everything robustly
-- =====================================================

-- 1. Drop Triggers on System Tables
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop Tables (CASCADE removes Policies, Triggers, and Indexes automatically)
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 3. Drop Functions
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS seed_my_data();
DROP FUNCTION IF EXISTS seed_my_data_advanced();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS update_account_balance();

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: profiles
-- =====================================================
CREATE TABLE profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: accounts
-- =====================================================
CREATE TABLE accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FUNCTION: Auto-update account balance on transaction change
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
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT: apply the new transaction
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'income' THEN
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
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
    END IF;
    
    -- Apply new transaction
    IF NEW.type = 'income' THEN
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
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
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: goals
-- =====================================================
CREATE TABLE goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount DECIMAL(15, 2) NOT NULL,
  current_amount DECIMAL(15, 2) DEFAULT 0,
  deadline DATE,
  color TEXT DEFAULT '#22c55e',
  icon TEXT DEFAULT 'target',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Accounts
CREATE POLICY "Users can view own accounts" ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON accounts FOR DELETE USING (auth.uid() = user_id);

-- Categories
CREATE POLICY "Users can view own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories FOR DELETE USING (auth.uid() = user_id);

-- Transactions
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- Budgets
CREATE POLICY "Users can view own budgets" ON budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON budgets FOR DELETE USING (auth.uid() = user_id);

-- Goals
CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

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
-- FUNCTION: Auto-create profile on signup
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- FUNCTION: Seed demo data (run after signup)
-- Usage: SELECT seed_my_data();
-- =====================================================
CREATE OR REPLACE FUNCTION seed_my_data()
RETURNS TEXT 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID;
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
    uid := auth.uid();
    
    IF uid IS NULL THEN
        RETURN 'Error: You must be logged in to seed data.';
    END IF;
    
    SELECT COUNT(*) INTO cnt FROM accounts WHERE user_id = uid;
    IF cnt > 0 THEN
        RETURN 'Data already exists. Delete your data first or use the app as-is.';
    END IF;

    -- ACCOUNTS
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES 
    (uid, 'Main Checking', 'checking', 8450.75, '#22c55e', 'wallet') RETURNING id INTO acct_checking;
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES 
    (uid, 'Emergency Savings', 'savings', 25000.00, '#3b82f6', 'piggy-bank') RETURNING id INTO acct_savings;
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES 
    (uid, 'Travel Rewards Card', 'credit', -1542.50, '#f43f5e', 'credit-card') RETURNING id INTO acct_credit;
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES 
    (uid, 'Investment Portfolio', 'investment', 45000.00, '#8b5cf6', 'trending-up') RETURNING id INTO acct_invest;

    -- INCOME CATEGORIES
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (uid, 'Salary', 'income', '#10b981', 'briefcase') RETURNING id INTO cat_salary;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (uid, 'Freelance', 'income', '#34d399', 'laptop') RETURNING id INTO cat_freelance;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (uid, 'Investments', 'income', '#8b5cf6', 'trending-up') RETURNING id INTO cat_invest_inc;

    -- EXPENSE CATEGORIES
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (uid, 'Food & Dining', 'expense', '#f59e0b', 'utensils') RETURNING id INTO cat_food;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (uid, 'Transportation', 'expense', '#3b82f6', 'car') RETURNING id INTO cat_transport;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (uid, 'Rent & Utilities', 'expense', '#6366f1', 'home') RETURNING id INTO cat_home;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (uid, 'Entertainment', 'expense', '#ec4899', 'film') RETURNING id INTO cat_entertainment;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (uid, 'Shopping', 'expense', '#8b5cf6', 'shopping-bag') RETURNING id INTO cat_shopping;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (uid, 'Health & Wellness', 'expense', '#ef4444', 'heart') RETURNING id INTO cat_health;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (uid, 'Subscriptions', 'expense', '#06b6d4', 'repeat') RETURNING id INTO cat_subscriptions;

    -- TRANSACTIONS: Last Month
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_checking, cat_salary, 'income', 6500.00, 'Monthly Salary', CURRENT_DATE - INTERVAL '32 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (uid, acct_checking, cat_home, 'expense', 2200.00, 'Monthly Rent', CURRENT_DATE - INTERVAL '30 days', true, 'monthly');

    -- TRANSACTIONS: This Month - Income
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_checking, cat_salary, 'income', 6500.00, 'Monthly Salary', CURRENT_DATE - INTERVAL '2 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_checking, cat_freelance, 'income', 1200.00, 'Website Redesign', CURRENT_DATE - INTERVAL '10 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_checking, cat_freelance, 'income', 450.00, 'Logo Design', CURRENT_DATE - INTERVAL '18 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_invest, cat_invest_inc, 'income', 125.50, 'Quarterly Dividend', CURRENT_DATE - INTERVAL '8 days');

    -- TRANSACTIONS: This Month - Rent & Utilities
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (uid, acct_checking, cat_home, 'expense', 2200.00, 'Monthly Rent', CURRENT_DATE - INTERVAL '1 day', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_checking, cat_home, 'expense', 165.00, 'Electric & Gas', CURRENT_DATE - INTERVAL '5 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (uid, acct_checking, cat_home, 'expense', 79.99, 'Internet', CURRENT_DATE - INTERVAL '12 days', true, 'monthly');

    -- TRANSACTIONS: Food & Dining
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_food, 'expense', 215.80, 'Weekly Groceries', CURRENT_DATE - INTERVAL '3 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_food, 'expense', 45.20, 'Grocery Run', CURRENT_DATE - INTERVAL '7 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_food, 'expense', 132.50, 'Weekly Groceries', CURRENT_DATE - INTERVAL '14 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_food, 'expense', 95.00, 'Birthday Dinner', CURRENT_DATE - INTERVAL '4 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_food, 'expense', 32.50, 'Lunch', CURRENT_DATE - INTERVAL '9 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_food, 'expense', 18.75, 'Coffee', CURRENT_DATE - INTERVAL '1 day');

    -- TRANSACTIONS: Transportation
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_transport, 'expense', 65.00, 'Gas', CURRENT_DATE - INTERVAL '6 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_transport, 'expense', 48.50, 'Gas', CURRENT_DATE - INTERVAL '16 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_transport, 'expense', 25.00, 'Uber', CURRENT_DATE - INTERVAL '11 days');

    -- TRANSACTIONS: Shopping
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_shopping, 'expense', 189.00, 'Running Shoes', CURRENT_DATE - INTERVAL '7 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_shopping, 'expense', 59.99, 'Amazon Order', CURRENT_DATE - INTERVAL '13 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_shopping, 'expense', 245.00, 'Winter Jacket', CURRENT_DATE - INTERVAL '19 days');

    -- TRANSACTIONS: Health
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (uid, acct_checking, cat_health, 'expense', 75.00, 'Gym Membership', CURRENT_DATE - INTERVAL '5 days', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_health, 'expense', 35.00, 'Vitamins', CURRENT_DATE - INTERVAL '15 days');

    -- TRANSACTIONS: Subscriptions (Recurring)
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (uid, acct_credit, cat_subscriptions, 'expense', 15.99, 'Netflix', CURRENT_DATE - INTERVAL '8 days', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (uid, acct_credit, cat_subscriptions, 'expense', 10.99, 'Spotify', CURRENT_DATE - INTERVAL '12 days', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (uid, acct_credit, cat_subscriptions, 'expense', 14.99, 'YouTube Premium', CURRENT_DATE - INTERVAL '17 days', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (uid, acct_credit, cat_subscriptions, 'expense', 9.99, 'Cloud Storage', CURRENT_DATE - INTERVAL '21 days', true, 'monthly');

    -- TRANSACTIONS: Entertainment
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_entertainment, 'expense', 45.00, 'Concert Tickets', CURRENT_DATE - INTERVAL '10 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (uid, acct_credit, cat_entertainment, 'expense', 28.50, 'Movie Night', CURRENT_DATE - INTERVAL '6 days');

    -- BUDGETS
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (uid, cat_food, 800.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (uid, cat_entertainment, 200.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (uid, cat_shopping, 400.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (uid, cat_transport, 300.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (uid, cat_subscriptions, 100.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));

    -- GOALS
    INSERT INTO goals (user_id, name, target_amount, current_amount, deadline, color, icon) VALUES
    (uid, 'Emergency Fund', 30000.00, 25000.00, CURRENT_DATE + INTERVAL '6 months', '#22c55e', 'target');
    INSERT INTO goals (user_id, name, target_amount, current_amount, deadline, color, icon) VALUES
    (uid, 'Dream Vacation', 5000.00, 1850.00, CURRENT_DATE + INTERVAL '8 months', '#3b82f6', 'sparkles');
    INSERT INTO goals (user_id, name, target_amount, current_amount, deadline, color, icon) VALUES
    (uid, 'New Car Down Payment', 15000.00, 4200.00, CURRENT_DATE + INTERVAL '1 year', '#8b5cf6', 'trophy');
    INSERT INTO goals (user_id, name, target_amount, current_amount, deadline, color, icon) VALUES
    (uid, 'Home Renovation', 20000.00, 8500.00, CURRENT_DATE + INTERVAL '18 months', '#f59e0b', 'trending-up');

    RETURN 'Success! Demo data created with 4 accounts, 10 categories, 30+ transactions, 5 budgets, and 4 goals.';
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION seed_my_data TO authenticated;
GRANT EXECUTE ON FUNCTION seed_my_data TO service_role;

-- ====================================================================
-- SETUP COMPLETE!
-- After signing up, run: SELECT seed_my_data();
-- ====================================================================
