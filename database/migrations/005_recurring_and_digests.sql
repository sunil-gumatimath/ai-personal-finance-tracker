-- =====================================================
-- MIGRATION 005: Recurring transaction automation + AI weekly digests
-- =====================================================

-- Recurring transactions: the template transaction carries an optional end
-- date and the next scheduled occurrence. A cron job (or the in-app
-- "process due" action) materializes occurrences by copying the template
-- with `date = next_due_date`, then advances `next_due_date` by one interval.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS recurring_end_date DATE,
  ADD COLUMN IF NOT EXISTS next_due_date DATE,
  ADD COLUMN IF NOT EXISTS recurring_parent_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

-- Fast lookup of due templates per user.
CREATE INDEX IF NOT EXISTS idx_transactions_recurring_due
  ON transactions (user_id, next_due_date)
  WHERE is_recurring = true AND next_due_date IS NOT NULL;

-- =====================================================
-- TABLE: ai_digests
-- Weekly AI-generated summaries. One row per user per week (Monday-based);
-- regenerating a week replaces the stored content.
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_digests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);
