-- Improve FTS search to include solutions text
-- Currently only searches query + common_pitfalls + category
-- This adds solutions text to make search more comprehensive

-- Create function to extract solutions text from JSONB array
CREATE OR REPLACE FUNCTION extract_solutions_text(solutions JSONB)
RETURNS TEXT AS $$
  SELECT COALESCE(string_agg(value->>'solution', ' '), '')
  FROM jsonb_array_elements(solutions);
$$ LANGUAGE SQL IMMUTABLE;

-- Drop existing FTS index
DROP INDEX IF EXISTS idx_knowledge_fts;

-- Create improved FTS index that includes solutions text
CREATE INDEX idx_knowledge_fts ON knowledge_entries USING gin(
  to_tsvector('english',
    query || ' ' ||
    COALESCE(common_pitfalls, '') || ' ' ||
    category || ' ' ||
    extract_solutions_text(solutions)
  )
);

-- Update search_knowledge RPC to search solutions text too
DROP FUNCTION IF EXISTS search_knowledge(text, integer, text);

CREATE FUNCTION search_knowledge(
  search_query TEXT,
  result_limit INT DEFAULT 5,
  type_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  id BIGINT,
  query TEXT,
  category TEXT,
  hit_frequency TEXT,
  solutions JSONB,
  failed_attempts JSONB,
  common_pitfalls TEXT,
  pattern_id INT,
  pattern_name TEXT,
  pattern_display_name TEXT,
  pattern_root_cause TEXT,
  pattern_detection_signals TEXT,
  pattern_solution_template TEXT,
  view_count INT,
  success_rate REAL,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  search_rank REAL,
  type TEXT,
  user_id TEXT,
  project_id TEXT,
  project_name TEXT,
  is_public BOOLEAN
) AS $func$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.query,
    k.category,
    k.hit_frequency,
    k.solutions,
    k.failed_attempts,
    k.common_pitfalls,
    k.pattern_id,
    p.pattern_name,
    p.display_name AS pattern_display_name,
    p.root_cause AS pattern_root_cause,
    p.detection_signals AS pattern_detection_signals,
    p.solution_template AS pattern_solution_template,
    k.view_count,
    k.success_rate,
    k.created_at,
    k.updated_at,
    ts_rank(
      to_tsvector('english',
        k.query || ' ' ||
        COALESCE(k.common_pitfalls, '') || ' ' ||
        k.category || ' ' ||
        extract_solutions_text(k.solutions)
      ),
      plainto_tsquery('english', search_query)
    ) AS search_rank,
    k.type,
    k.user_id,
    k.project_id,
    k.project_name,
    k.is_public
  FROM knowledge_entries k
  LEFT JOIN patterns p ON k.pattern_id = p.id
  WHERE
    (type_filter IS NULL OR k.type = type_filter) AND
    to_tsvector('english',
      k.query || ' ' ||
      COALESCE(k.common_pitfalls, '') || ' ' ||
      k.category || ' ' ||
      extract_solutions_text(k.solutions)
    ) @@ plainto_tsquery('english', search_query)
  ORDER BY search_rank DESC, k.view_count DESC
  LIMIT result_limit;
END;
$func$ LANGUAGE plpgsql;
