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

interface InitHiveResult {
  step: 'ask_storage' | 'confirm_setup';
  message: string;
  options?: {
    cloud: string;
    local: string;
  };
  user_id?: string;
  project_id?: string;
  storage_type?: string;
  scanned_entries?: number;
}

interface ProjectScanResult {
  tech_stack: string[];
  architecture: string[];
  database?: string;
  build_system?: string;
  categories: string[];
  description?: string;
  version?: string;
}

/**
 * Scan project directory for tech stack and architecture
 * Returns structured data about the project
 */
async function scanProject(projectPath: string): Promise<ProjectScanResult> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const result: ProjectScanResult = {
    tech_stack: [],
    architecture: [],
    categories: ['tech-stack', 'architecture']
  };

  try {
    // Read package.json
    const pkgPath = path.join(projectPath, 'package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    // Extract metadata
    result.description = pkg.description;
    result.version = pkg.version;

    // Detect tech stack from dependencies
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies
    };

    if (allDeps['typescript']) result.tech_stack.push('TypeScript');
    if (allDeps['@modelcontextprotocol/sdk']) {
      result.tech_stack.push('MCP Server');
      result.architecture.push('MCP stdio transport');
      result.categories.push('mcp-development');
    }
    if (allDeps['react']) result.tech_stack.push('React');
    if (allDeps['next']) result.tech_stack.push('Next.js');
    if (allDeps['vue']) result.tech_stack.push('Vue');
    if (allDeps['@supabase/supabase-js']) {
      result.tech_stack.push('Supabase');
      result.categories.push('supabase-backend');
    }

    // Detect from package.json scripts
    if (pkg.scripts?.build?.includes('tsc')) {
      result.build_system = 'TypeScript compiler (tsc)';
    }

    // Check for supabase directory
    try {
      const supabasePath = path.join(projectPath, 'supabase');
      const supabaseStats = await fs.stat(supabasePath);
      if (supabaseStats.isDirectory()) {
        result.database = 'PostgreSQL (Supabase)';
        result.architecture.push('Supabase edge functions');
        result.categories.push('database', 'edge-functions');
      }
    } catch {
      // No supabase directory
    }

    // Detect Node.js
    if (pkg.engines?.node || pkg.scripts) {
      result.tech_stack.push('Node.js');
    }

  } catch (error) {
    // If can't read package.json, return minimal result
    console.error('Scan error:', error);
  }

  return result;
}

/**
 * Initialize project hive - guided flow
 * Step 1: Returns storage options
 * Step 2: User provides choice, gets confirmation + scanned knowledge
 */
export async function initHive(
  projectId: string,
  projectName: string,
  storageChoice?: 'cloud' | 'local',
  projectPath?: string
): Promise<InitHiveResult> {
  // Step 1: No choice yet, return options
  if (!storageChoice) {
    return {
      step: 'ask_storage',
      message: 'Choose storage type for your project hive:',
      options: {
        cloud: '10x limits (1000/hour) + syncs wherever you go + auto-contributes to public Hivemind (helps everyone)',
        local: '100/hour + stays on this computer only + fully private'
      }
    };
  }

  // Step 2: User chose, initialize
  const result = await initProjectKB(projectId, projectName, storageChoice);

  let scannedEntries = 0;

  // Step 3: Scan project and auto-contribute base knowledge
  if (projectPath && result.user_id) {
    try {
      const scanResult = await scanProject(projectPath);

      // Contribute project overview
      const overviewParts = [];
      if (scanResult.description) overviewParts.push(scanResult.description);
      if (scanResult.version) overviewParts.push(`Version: ${scanResult.version}`);
      if (scanResult.tech_stack.length > 0) overviewParts.push(`Tech: ${scanResult.tech_stack.join(', ')}`);
      if (scanResult.database) overviewParts.push(`Database: ${scanResult.database}`);

      if (overviewParts.length > 0) {
        await contributeProject(
          result.user_id,
          projectId,
          `What is ${projectName}? Give me a project overview.`,
          overviewParts.join('. '),
          'project-overview',
          false
        );
        scannedEntries++;
      }

      // Contribute tech stack
      if (scanResult.tech_stack.length > 0) {
        await contributeProject(
          result.user_id,
          projectId,
          `What is the tech stack for ${projectName}?`,
          `Tech stack: ${scanResult.tech_stack.join(', ')}`,
          'tech-stack',
          false
        );
        scannedEntries++;
      }

      // Contribute architecture
      if (scanResult.architecture.length > 0) {
        await contributeProject(
          result.user_id,
          projectId,
          `What is the architecture of ${projectName}?`,
          `Architecture: ${scanResult.architecture.join(', ')}`,
          'architecture',
          false
        );
        scannedEntries++;
      }

      // Contribute database info
      if (scanResult.database) {
        await contributeProject(
          result.user_id,
          projectId,
          `What database does ${projectName} use?`,
          `Database: ${scanResult.database}`,
          'database',
          false
        );
        scannedEntries++;
      }

      // Contribute build system
      if (scanResult.build_system) {
        await contributeProject(
          result.user_id,
          projectId,
          `What build system does ${projectName} use?`,
          `Build system: ${scanResult.build_system}`,
          'tooling',
          false
        );
        scannedEntries++;
      }
    } catch (error) {
      console.error('Scanner error:', error);
      // Continue even if scan fails
    }
  }

  return {
    step: 'confirm_setup',
    message: storageChoice === 'cloud'
      ? `Hive active with 10x limits. Your project knowledge syncs wherever you go, and your solutions help improve Hivemind for everyone. User ID: ${result.user_id} (save this)${scannedEntries > 0 ? `. Scanned and added ${scannedEntries} foundational entries.` : ''}`
      : 'Hive active. Knowledge stays private on this machine.',
    user_id: result.user_id,
    project_id: result.project_id,
    storage_type: storageChoice,
    scanned_entries: scannedEntries
  };
}
