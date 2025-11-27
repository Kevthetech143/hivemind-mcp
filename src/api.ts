/**
 * Hivemind API client
 * Connects to the hivemind backend API
 */

const API_BASE = process.env.HIVEMIND_API_URL || "https://api.hivemind.sh";
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
