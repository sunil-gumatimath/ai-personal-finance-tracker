-- ====================================================================
-- SEED: Default Categories
-- Inserts default income and expense categories for a new user.
-- Usage: Replace <USER_ID> with the actual user UUID before running.
-- ====================================================================

INSERT INTO categories (user_id, name, type, color, icon)
SELECT <USER_ID>, name, type, color, icon FROM (VALUES
  -- Expense categories
  ('Housing',       'expense', '#ef4444', 'home'),
  ('Groceries',     'expense', '#22c55e', 'shopping-cart'),
  ('Dining Out',    'expense', '#f97316', 'utensils'),
  ('Transportation','expense', '#3b82f6', 'car'),
  ('Utilities',     'expense', '#eab308', 'zap'),
  ('Healthcare',    'expense', '#ec4899', 'heart-pulse'),
  ('Entertainment', 'expense', '#8b5cf6', 'film'),
  ('Shopping',      'expense', '#06b6d4', 'shopping-bag'),
  ('Subscriptions', 'expense', '#6366f1', 'repeat'),
  ('Education',     'expense', '#14b8a6', 'graduation-cap'),
  ('Travel',        'expense', '#0ea5e9', 'plane'),
  ('Insurance',     'expense', '#64748b', 'shield'),
  ('Debt Payments', 'expense', '#dc2626', 'credit-card'),
  ('Savings',       'expense', '#16a34a', 'piggy-bank'),
  ('Miscellaneous', 'expense', '#94a3b8', 'tag'),
  -- Income categories
  ('Salary',        'income',  '#22c55e', 'briefcase'),
  ('Freelance',     'income',  '#14b8a6', 'laptop'),
  ('Business',      'income',  '#0ea5e9', 'building'),
  ('Investments',   'income',  '#8b5cf6', 'trending-up'),
  ('Interest',      'income',  '#84cc16', 'percent'),
  ('Gifts',         'income',  '#ec4899', 'gift'),
  ('Refunds',       'income',  '#f97316', 'rotate-ccw'),
  ('Other Income',  'income',  '#64748b', 'plus-circle')
) AS defaults(name, type, color, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE user_id = <USER_ID> AND name = defaults.name
);
