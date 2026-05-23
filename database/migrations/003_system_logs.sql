-- ====================================================================
-- MIGRATION 003: System Logs
-- Adds system_logs table for auditing all application events
-- ====================================================================

-- =====================================================
-- TABLE: system_logs
-- =====================================================
CREATE TABLE IF NOT EXISTS system_logs (
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

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity);
