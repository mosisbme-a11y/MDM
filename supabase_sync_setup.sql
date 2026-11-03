-- ==============================================================================
-- EPSS SYSTEM MASTER DATA SYNC TABLE
-- ==============================================================================
-- This table is required for the chunked master data sync service.
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS system_master_data (
  dataset TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_master_data ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (authenticated and anon)
DROP POLICY IF EXISTS "Allow read access to all" ON system_master_data;
CREATE POLICY "Allow read access to all" ON system_master_data FOR SELECT USING (true);

-- Allow full access to service role (server-side)
DROP POLICY IF EXISTS "Allow full access to service and authenticated" ON system_master_data;
CREATE POLICY "Allow full access to service and authenticated" ON system_master_data FOR ALL USING (true) WITH CHECK (true);

-- Insert initial metadata if it doesn't exist
INSERT INTO system_master_data (dataset, payload)
VALUES ('_meta', '{"version": 0, "lastUpdated": "2026-11-03T00:00:00.000Z", "updateKind": "Initial Setup", "counts": {}}')
ON CONFLICT (dataset) DO NOTHING;
