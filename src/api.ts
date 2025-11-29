/**
 * Hivemind API client
 * Connects to the hivemind public gateway (no auth required)
 */

// Public gateway - no API key needed
const API_BASE = process.env.HIVEMIND_API_URL || "https://ksethrexopllfhyrxlrb.supabase.co/functions/v1/public";

interface SearchResult {
  query: string;
  solutions: Solution[];
  total_count: number;
}

interface Solution {
  id: number;
  solution: string;
  success_rate: number;
  command?: string;
  note?: string;
}

interface OutcomeResult {
  success: boolean;
  message: string;
}

interface ContributeResult {
  success: boolean;
  message: string;
  pending_id?: number;
}

/**
 * Search the hivemind knowledge base
 */
export async function searchKnowledgeBase(query: string): Promise<SearchResult> {
  const response = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Report solution outcome (success/failure)
 */
export async function reportOutcome(
  solutionId: number | undefined,
  outcome: "success" | "failure"
): Promise<OutcomeResult> {
  const response = await fetch(`${API_BASE}/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ solution_id: solutionId, outcome }),
  });

  if (!response.ok) {
    throw new Error(`Report failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Contribute a new solution
 * Note: Server-side credential scanning will reject solutions containing secrets
 */
export async function contributeSolution(
  query: string,
  solution: string,
  category?: string
): Promise<ContributeResult> {
  const response = await fetch(`${API_BASE}/contribute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, solution, category }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    if (errorBody.detected_patterns) {
      throw new Error(`Contribution rejected: Contains sensitive data (${errorBody.detected_patterns.join(', ')}). Please remove credentials before submitting.`);
    }
    throw new Error(`Contribution failed: ${response.statusText}`);
  }

  return response.json();
}

interface SkillSearchResult {
  query: string;
  skills: Array<{
    id: number;
    title: string;
    category: string;
    preview: string;
    relevance: number;
  }>;
  total: number;
  tip: string;
}

interface SkillDetailResult {
  id: number;
  query: string;
  category: string;
  solutions?: any;
  common_pitfalls?: string;
  prerequisites?: string;
  success_indicators?: string;
  executable?: any;
  executable_type?: string;
  preview_summary?: string;
  view_count?: number;
  created_at?: string;
}

/**
 * Search skills by query - returns lightweight summaries
 * Use getSkill() to get full details for a specific skill
 */
export async function searchSkills(query: string, maxResults: number = 20): Promise<SkillSearchResult> {
  const response = await fetch(`${API_BASE}/search-skills`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, max_results: maxResults }),
  });

  if (!response.ok) {
    throw new Error(`Search skills failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Count total skills in database
 */
export async function countSkills(): Promise<{ total: number }> {
  const response = await fetch(`${API_BASE}/count-skills`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Count skills failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get a specific skill by ID
 */
export async function getSkill(skillId: number): Promise<SkillDetailResult> {
  const response = await fetch(`${API_BASE}/skill`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ skill_id: skillId }),
  });

  if (!response.ok) {
    throw new Error(`Get skill failed: ${response.statusText}`);
  }

  return response.json();
}

interface InitProjectResult {
  success: boolean;
  user_id: string;
  project_id: string;
  project_name: string;
  storage_type: string;
  rate_limit: number;
  message: string;
}

interface ContributeProjectResult {
  success: boolean;
  entry_id: number;
  message: string;
}

interface SearchProjectResult {
  query: string;
  results: any[];
  count: number;
  source: string;
}

/**
 * Initialize project knowledge base
 */
export async function initProjectKB(
  projectId: string,
  projectName: string,
  storageType: 'cloud' | 'local' = 'cloud'
): Promise<InitProjectResult> {
  const response = await fetch(`${API_BASE}/init-project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      project_id: projectId,
      project_name: projectName,
      storage_type: storageType
    }),
  });

  if (!response.ok) {
    throw new Error(`Init project failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Contribute to project knowledge base
 */
export async function contributeProject(
  userId: string,
  projectId: string,
  query: string,
  solution: string,
  category?: string,
  isPublic: boolean = false
): Promise<ContributeProjectResult> {
  const response = await fetch(`${API_BASE}/contribute-project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      project_id: projectId,
      query,
      solution,
      category,
      is_public: isPublic
    }),
  });

  if (!response.ok) {
    throw new Error(`Contribute project failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search project knowledge base
 */
export async function searchProject(
  userId: string,
  query: string,
  projectId?: string,
  includePublic: boolean = true
): Promise<SearchProjectResult> {
  const response = await fetch(`${API_BASE}/search-project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      query,
      project_id: projectId,
      include_public: includePublic
    }),
  });

  if (!response.ok) {
    throw new Error(`Search project failed: ${response.statusText}`);
  }

  return response.json();
}
