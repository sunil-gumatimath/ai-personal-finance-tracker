-- Personal Finance Tracker Database Schema
-- Run this SQL in your Supabase SQL Editor to reset and set up the database

-- =====================================================
-- FULL RESET: Drop everything first
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP TRIGGER IF EXISTS update_budgets_updated_at ON budgets;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PROFILES TABLE
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
-- ACCOUNTS TABLE
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
-- CATEGORIES TABLE
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
-- TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
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
-- BUDGETS TABLE
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

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Accounts policies
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Categories policies
CREATE POLICY "Users can view own categories" ON categories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories
  FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Budgets policies
CREATE POLICY "Users can view own budgets" ON budgets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON budgets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON budgets
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTION: Create profile on user signup (IMPROVED)
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
    -- Log the error but don't fail the signup
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEED DATA FUNCTION (Self-Service)
-- =====================================================
CREATE OR REPLACE FUNCTION seed_my_data()
RETURNS VOID 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id UUID;
    acct_checking_id UUID;
    acct_savings_id UUID;
    cat_salary_id UUID;
    cat_food_id UUID;
    cat_transport_id UUID;
    cat_utilities_id UUID;
    cat_entertainment_id UUID;
    existing_count INT;
BEGIN
    target_user_id := auth.uid();
    
    -- Prevent seeding if data exists to avoid duplicates
    SELECT COUNT(*) INTO existing_count FROM accounts WHERE user_id = target_user_id;
    IF existing_count > 0 THEN
        RETURN;
    END IF;

    -- 1. Create Accounts
    INSERT INTO accounts (user_id, name, type, balance, color, icon)
    VALUES (target_user_id, 'Main Checking', 'checking', 2500.00, '#22c55e', 'wallet')
    RETURNING id INTO acct_checking_id;

    INSERT INTO accounts (user_id, name, type, balance, color, icon)
    VALUES (target_user_id, 'Emergency Fund', 'savings', 10000.00, '#3b82f6', 'piggy-bank')
    RETURNING id INTO acct_savings_id;

    -- 2. Create Categories
    -- Income
    INSERT INTO categories (user_id, name, type, color, icon) VALUES
      (target_user_id, 'Salary', 'income', '#22c55e', 'briefcase') RETURNING id INTO cat_salary_id;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES
      (target_user_id, 'Freelance', 'income', '#10b981', 'laptop');
    
    -- Expenses
    INSERT INTO categories (user_id, name, type, color, icon) VALUES
      (target_user_id, 'Food & Dining', 'expense', '#ef4444', 'utensils') RETURNING id INTO cat_food_id;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES
      (target_user_id, 'Transportation', 'expense', '#f97316', 'car') RETURNING id INTO cat_transport_id;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES
      (target_user_id, 'Bills & Utilities', 'expense', '#f59e0b', 'home') RETURNING id INTO cat_utilities_id;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES
      (target_user_id, 'Entertainment', 'expense', '#8b5cf6', 'gamepad') RETURNING id INTO cat_entertainment_id;

    -- 3. Create Transactions (Recent Activity)
    -- Salary
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date)
    VALUES (target_user_id, acct_checking_id, cat_salary_id, 'income', 3000.00, 'Monthly Salary', CURRENT_DATE - INTERVAL '10 days');

    -- Expenses
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date)
    VALUES (target_user_id, acct_checking_id, cat_food_id, 'expense', 45.50, 'Grocery Shopping', CURRENT_DATE - INTERVAL '1 day');
    
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date)
    VALUES (target_user_id, acct_checking_id, cat_transport_id, 'expense', 20.00, 'Gas', CURRENT_DATE - INTERVAL '2 days');

    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date)
    VALUES (target_user_id, acct_checking_id, cat_entertainment_id, 'expense', 15.99, 'Netflix Subscription', CURRENT_DATE - INTERVAL '3 days');

    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date)
    VALUES (target_user_id, acct_checking_id, cat_utilities_id, 'expense', 120.00, 'Electric Bill', CURRENT_DATE - INTERVAL '5 days');

    -- 4. Create Budgets
    INSERT INTO budgets (user_id, category_id, amount, period, start_date)
    VALUES (target_user_id, cat_food_id, 500.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));

    INSERT INTO budgets (user_id, category_id, amount, period, start_date)
    VALUES (target_user_id, cat_entertainment_id, 100.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));

END;
$$ LANGUAGE plpgsql;

-- Grant usage
GRANT EXECUTE ON FUNCTION seed_my_data TO authenticated;
GRANT EXECUTE ON FUNCTION seed_my_data TO service_role;
