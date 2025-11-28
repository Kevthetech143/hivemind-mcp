/**
 * Hivemind API client
 * Connects to the hivemind backend API
 */

const API_BASE = process.env.HIVEMIND_API_URL || "https://ksethrexopllfhyrxlrb.supabase.co/functions/v1";
const API_KEY = process.env.HIVEMIND_API_KEY;

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
  const response = await fetch(`${API_BASE}/v1/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
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
  const response = await fetch(`${API_BASE}/v1/outcome`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
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
 */
export async function contributeSOlution(
  query: string,
  solution: string,
  category?: string
): Promise<ContributeResult> {
  const response = await fetch(`${API_BASE}/v1/contribute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
    },
    body: JSON.stringify({ query, solution, category }),
  });

  if (!response.ok) {
    throw new Error(`Contribution failed: ${response.statusText}`);
  }

  return response.json();
}

interface SkillListResult {
  action: string;
  type: string;
  flows: Array<{
    id: number;
    query: string;
    category: string;
    solutions?: any;
    common_pitfalls?: string;
    created_at?: string;
  }>;
  total_count: number;
  categories: string[];
}

interface SkillDetailResult {
  action: string;
  flow: {
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
  };
}

/**
 * List all skills (optionally filtered by category)
 */
export async function listSkills(category?: string): Promise<SkillListResult> {
  const response = await fetch(`${API_BASE}/v1/flows`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
    },
    body: JSON.stringify({
      action: "list",
      type: "skill",
      category: category || null,
      limit: 100,
    }),
  });

  if (!response.ok) {
    throw new Error(`List skills failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get a specific skill by ID
 */
export async function getSkill(skillId: number): Promise<SkillDetailResult> {
  const response = await fetch(`${API_BASE}/v1/flows`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
    },
    body: JSON.stringify({
      action: "get",
      type: "skill",
      flow_id: skillId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Get skill failed: ${response.statusText}`);
  }

  return response.json();
}
