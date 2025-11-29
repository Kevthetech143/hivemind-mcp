-- Add project knowledge base support
-- Allows users to store project-specific knowledge in cloud

-- Add new columns to knowledge_entries
ALTER TABLE knowledge_entries
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS project_name TEXT;

-- Create index for user queries
CREATE INDEX IF NOT EXISTS idx_user_project ON knowledge_entries(user_id, project_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_is_public ON knowledge_entries(is_public) WHERE is_public = true;

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Public read access" ON knowledge_entries;

-- New RLS policies
-- 1. Public entries are readable by everyone
CREATE POLICY "public_read" ON knowledge_entries
  FOR SELECT
  USING (is_public = true);

-- 2. Users can read their own private entries
CREATE POLICY "user_read_own" ON knowledge_entries
  FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- 3. Users can insert their own entries (via edge function with service role)
CREATE POLICY "user_insert_own" ON knowledge_entries
  FOR INSERT
  WITH CHECK (
    user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- 4. Users can update their own entries
CREATE POLICY "user_update_own" ON knowledge_entries
  FOR UPDATE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Create contributors tier tracking table
CREATE TABLE IF NOT EXISTS contributor_tiers (
  user_id TEXT PRIMARY KEY,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'cloud', 'contributor', 'active', 'core')),
  contribution_count INTEGER DEFAULT 0,
  rate_limit INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to get user's rate limit
CREATE OR REPLACE FUNCTION get_user_rate_limit(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  SELECT rate_limit INTO v_limit
  FROM contributor_tiers
  WHERE user_id = p_user_id;

  -- Default to 100 if user not found
  RETURN COALESCE(v_limit, 100);
END;
$$ LANGUAGE plpgsql;

-- Function to upgrade user tier based on storage choice
CREATE OR REPLACE FUNCTION set_cloud_storage_tier(p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO contributor_tiers (user_id, tier, rate_limit)
  VALUES (p_user_id, 'cloud', 1000)
  ON CONFLICT (user_id)
  DO UPDATE SET
    tier = 'cloud',
    rate_limit = 1000,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_tiers ENABLE ROW LEVEL SECURITY;

-- RLS for contributor_tiers (users can read their own tier)
CREATE POLICY "users_read_own_tier" ON contributor_tiers
  FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

COMMENT ON COLUMN knowledge_entries.user_id IS 'User who created this entry (NULL for public/legacy entries)';
COMMENT ON COLUMN knowledge_entries.project_id IS 'Project identifier for project-specific knowledge';
COMMENT ON COLUMN knowledge_entries.is_public IS 'Whether this entry is public (true) or private to user (false)';
COMMENT ON COLUMN knowledge_entries.project_name IS 'Human-readable project name';
