-- ====================================================================
-- ADVANCED SEED DATA SCRIPT
-- ====================================================================
-- Instructions:
-- 1. Copy the entire content of this file.
-- 2. Paste it into the SQL Editor in your Supabase Dashboard.
-- 3. Click "Run".
-- 4. After the function is created, clear the editor and run:
--    SELECT seed_my_data_advanced();
-- ====================================================================

CREATE OR REPLACE FUNCTION seed_my_data_advanced()
RETURNS VOID 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id UUID;
    
    -- Account IDs
    acct_main_id UUID;
    acct_sav_id UUID;
    acct_cc_id UUID;
    
    -- Category IDs
    cat_inc_salary_id UUID;
    cat_inc_freelance_id UUID;
    cat_exp_food_id UUID;
    cat_exp_transport_id UUID;
    cat_exp_home_id UUID;
    cat_exp_ent_id UUID;
    cat_exp_shop_id UUID;
    cat_exp_health_id UUID;
    
    existing_count INT;
BEGIN
    target_user_id := auth.uid();
    
    -- Safety check: don't double seed if accounts already exist
    SELECT COUNT(*) INTO existing_count FROM accounts WHERE user_id = target_user_id;
    IF existing_count > 0 THEN
        RAISE EXCEPTION 'Data already exists for this user. Please clear your data first or skip seeding.';
    END IF;

    -- =====================================================
    -- 1. CREATE ACCOUNTS
    -- =====================================================
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES 
    (target_user_id, 'Main Checking', 'checking', 3450.75, '#22c55e', 'wallet') 
    RETURNING id INTO acct_main_id;
    
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES 
    (target_user_id, 'High Yield Savings', 'savings', 15000.00, '#3b82f6', 'piggy-bank') 
    RETURNING id INTO acct_sav_id;
    
    INSERT INTO accounts (user_id, name, type, balance, color, icon) VALUES 
    (target_user_id, 'Travel Visa', 'credit', -342.50, '#f43f5e', 'credit-card') 
    RETURNING id INTO acct_cc_id;

    -- =====================================================
    -- 2. CREATE CATEGORIES
    -- =====================================================
    
    -- Income Categories
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (target_user_id, 'Salary', 'income', '#10b981', 'briefcase') RETURNING id INTO cat_inc_salary_id;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (target_user_id, 'Freelance', 'income', '#34d399', 'laptop') RETURNING id INTO cat_inc_freelance_id;
    
    -- Expense Categories
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (target_user_id, 'Food & Dining', 'expense', '#f59e0b', 'utensils') RETURNING id INTO cat_exp_food_id;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (target_user_id, 'Transportation', 'expense', '#3b82f6', 'car') RETURNING id INTO cat_exp_transport_id;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (target_user_id, 'Rent & Utilities', 'expense', '#6366f1', 'home') RETURNING id INTO cat_exp_home_id;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (target_user_id, 'Entertainment', 'expense', '#ec4899', 'film') RETURNING id INTO cat_exp_ent_id;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (target_user_id, 'Shopping', 'expense', '#8b5cf6', 'shopping-bag') RETURNING id INTO cat_exp_shop_id;
    INSERT INTO categories (user_id, name, type, color, icon) VALUES 
    (target_user_id, 'Health & Wellness', 'expense', '#ef4444', 'heart') RETURNING id INTO cat_exp_health_id;

    -- =====================================================
    -- 3. CREATE TRANSACTIONS (History for ~2 months)
    -- =====================================================

    -- -- PREVIOUS MONTH --
    
    -- Salary (Previous Month)
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_main_id, cat_inc_salary_id, 'income', 4500.00, 'Salary - Previous Month', CURRENT_DATE - INTERVAL '1 month' - INTERVAL '2 days');

    -- Rent (Previous Month)
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_main_id, cat_exp_home_id, 'expense', 1600.00, 'Rent Payment', CURRENT_DATE - INTERVAL '1 month');

    -- -- THIS MONTH --

    -- Salary (This Month)
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_main_id, cat_inc_salary_id, 'income', 4500.00, 'Salary - Current Month', CURRENT_DATE - INTERVAL '2 days');

    -- Rent (This Month)
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_main_id, cat_exp_home_id, 'expense', 1600.00, 'Rent Payment', CURRENT_DATE - INTERVAL '1 day');

    -- Freelance Project
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_main_id, cat_inc_freelance_id, 'income', 850.00, 'Website Design Project', CURRENT_DATE - INTERVAL '10 days');

    -- Groceries (Several entries)
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_cc_id, cat_exp_food_id, 'expense', 145.20, 'Weekly Groceries', CURRENT_DATE - INTERVAL '3 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_cc_id, cat_exp_food_id, 'expense', 32.50, 'Quick Mart Run', CURRENT_DATE - INTERVAL '8 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_cc_id, cat_exp_food_id, 'expense', 89.90, 'Grocery Haul', CURRENT_DATE - INTERVAL '15 days');

    -- Dining Out
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_cc_id, cat_exp_food_id, 'expense', 65.00, 'Dinner with Friends', CURRENT_DATE - INTERVAL '5 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_cc_id, cat_exp_food_id, 'expense', 12.50, 'Morning Coffee', CURRENT_DATE - INTERVAL '1 day');

    -- Transportation
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_cc_id, cat_exp_transport_id, 'expense', 45.00, 'Gas Refill', CURRENT_DATE - INTERVAL '6 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_cc_id, cat_exp_transport_id, 'expense', 15.00, 'Uber Ride', CURRENT_DATE - INTERVAL '12 days');

    -- Utilities
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_main_id, cat_exp_home_id, 'expense', 120.50, 'Electric Bill', CURRENT_DATE - INTERVAL '18 days');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_main_id, cat_exp_home_id, 'expense', 65.00, 'Internet Service', CURRENT_DATE - INTERVAL '20 days');

    -- Shopping
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES 
    (target_user_id, acct_cc_id, cat_exp_shop_id, 'expense', 120.00, 'New Headphones', CURRENT_DATE - INTERVAL '7 days');
    
    -- Subscriptions (Recurring)
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (target_user_id, acct_cc_id, cat_exp_ent_id, 'expense', 15.99, 'Netflix Standard', CURRENT_DATE - INTERVAL '14 days', true, 'monthly');
    INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, is_recurring, recurring_frequency) VALUES 
    (target_user_id, acct_cc_id, cat_exp_ent_id, 'expense', 9.99, 'Spotify Premium', CURRENT_DATE - INTERVAL '25 days', true, 'monthly');

    -- =====================================================
    -- 4. CREATE BUDGETS
    -- =====================================================
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (target_user_id, cat_exp_food_id, 650.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));
    
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (target_user_id, cat_exp_ent_id, 150.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));
    
    INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
    (target_user_id, cat_exp_shop_id, 300.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));

END;
$$ LANGUAGE plpgsql;

-- Permissions
GRANT EXECUTE ON FUNCTION seed_my_data_advanced TO authenticated;
GRANT EXECUTE ON FUNCTION seed_my_data_advanced TO service_role;
