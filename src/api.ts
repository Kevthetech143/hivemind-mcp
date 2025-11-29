/**
 * Hivemind API client
 * Connects to the hivemind public gateway (no auth required)
 */

// Public gateway - no API key needed
const API_BASE = process.env.HIVEMIND_API_URL || "https://ksethrexopllfhyrxlrb.supabase.co/functions/v1/public";

// Local storage interfaces and helpers
interface LocalHiveEntry {
  id: number;
  query: string;
  solution: string;
  category: string;
  created_at: string;
}

interface LocalHive {
  storage_type: 'local';
  user_id: string;
  project_id: string;
  project_name: string;
  entries: LocalHiveEntry[];
}

async function readLocalHive(projectPath: string): Promise<LocalHive | null> {
  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    const hivePath = path.join(projectPath, '.hive.json');
    const content = await fs.readFile(hivePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeLocalHive(projectPath: string, hive: LocalHive): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const hivePath = path.join(projectPath, '.hive.json');
  await fs.writeFile(hivePath, JSON.stringify(hive, null, 2), 'utf-8');
}

async function createLocalHive(projectPath: string, projectId: string, projectName: string, userId: string): Promise<void> {
  const hive: LocalHive = {
    storage_type: 'local',
    user_id: userId,
    project_id: projectId,
    project_name: projectName,
    entries: []
  };
  await writeLocalHive(projectPath, hive);
}

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
  isPublic: boolean = false,
  projectPath?: string
): Promise<ContributeProjectResult> {
  // Check if local storage
  if (userId.startsWith('local-') && projectPath) {
    const hive = await readLocalHive(projectPath);
    if (!hive) {
      throw new Error('Local hive not found. Run init_hive first.');
    }

    const newEntry: LocalHiveEntry = {
      id: hive.entries.length + 1,
      query,
      solution,
      category: category || 'general',
      created_at: new Date().toISOString()
    };

    hive.entries.push(newEntry);
    await writeLocalHive(projectPath, hive);

    return {
      success: true,
      entry_id: newEntry.id,
      message: `Added to ${projectId} hive (local)`
    };
  }

  // Cloud storage - use API
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
  includePublic: boolean = true,
  projectPath?: string
): Promise<SearchProjectResult> {
  // Check if local storage
  if (userId.startsWith('local-') && projectPath) {
    const hive = await readLocalHive(projectPath);
    if (!hive) {
      return { query, results: [], count: 0, source: 'local (not found)' };
    }

    // Simple search: filter entries by query keywords
    const queryLower = query.toLowerCase();
    const results = hive.entries.filter(entry =>
      entry.query.toLowerCase().includes(queryLower) ||
      entry.solution.toLowerCase().includes(queryLower) ||
      entry.category.toLowerCase().includes(queryLower)
    ).map(entry => ({
      query: entry.query,
      solution: entry.solution,
      category: entry.category,
      created_at: entry.created_at
    }));

    return {
      query,
      results,
      count: results.length,
      source: `local:${projectId}`
    };
  }

  // Cloud storage - use API
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

interface DeleteHiveResult {
  success: boolean;
  deleted_entries: number;
  message: string;
  user_deleted: boolean;
}

/**
 * Delete project hive - removes all project entries
 */
export async function deleteHive(
  userId: string,
  projectId: string
): Promise<DeleteHiveResult> {
  const response = await fetch(`${API_BASE}/delete-hive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      project_id: projectId
    }),
  });

  if (!response.ok) {
    throw new Error(`Delete hive failed: ${response.statusText}`);
  }

  return response.json();
}

interface GetHiveOverviewResult {
  success: boolean;
  project_name: string;
  project_id: string;
  user_id: string;
  storage_type: string;
  rate_limit: number;
  total_entries: number;
  category_breakdown: Record<string, number>;
  recent_entries: Array<{
    category: string;
    query: string;
    created_at: string;
  }>;
}

/**
 * Get hive overview - shows stats and recent entries
 */
export async function getHiveOverview(
  userId: string,
  projectId: string,
  projectPath?: string
): Promise<GetHiveOverviewResult> {
  // Check if local storage
  if (userId.startsWith('local-') && projectPath) {
    const hive = await readLocalHive(projectPath);
    if (!hive) {
      throw new Error('Local hive not found');
    }

    // Aggregate by category
    const categoryBreakdown: Record<string, number> = {};
    hive.entries.forEach(entry => {
      const cat = entry.category || 'uncategorized';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    // Get recent entries (last 10)
    const recentEntries = hive.entries
      .slice(-10)
      .reverse()
      .map(e => ({
        category: e.category,
        query: e.query,
        created_at: e.created_at
      }));

    return {
      success: true,
      project_name: hive.project_name,
      project_id: hive.project_id,
      user_id: hive.user_id,
      storage_type: 'local',
      rate_limit: 100,
      total_entries: hive.entries.length,
      category_breakdown: categoryBreakdown,
      recent_entries: recentEntries
    };
  }

  // Cloud storage - use API
  const response = await fetch(`${API_BASE}/get-hive-overview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      project_id: projectId
    }),
  });

  if (!response.ok) {
    throw new Error(`Get hive overview failed: ${response.statusText}`);
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
  scan_results?: {
    tech_stack: string[];
    architecture: string[];
    database?: string;
    build_system?: string;
    description?: string;
    version?: string;
  };
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

  // Try Node.js (package.json)
  try {
    const pkgPath = path.join(projectPath, 'package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    result.description = pkg.description;
    result.version = pkg.version;

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

    if (pkg.scripts?.build?.includes('tsc')) {
      result.build_system = 'TypeScript compiler (tsc)';
    }

    if (pkg.engines?.node || pkg.scripts) {
      result.tech_stack.push('Node.js');
    }
  } catch {
    // No package.json, try other project types
  }

  // Try Go (go.mod)
  try {
    const goModPath = path.join(projectPath, 'go.mod');
    const goModContent = await fs.readFile(goModPath, 'utf-8');

    // Extract Go version
    const versionMatch = goModContent.match(/^go\s+([\d.]+)/m);
    if (versionMatch) {
      result.tech_stack.push(`Go ${versionMatch[1]}`);
      result.version = versionMatch[1];
    }

    // Extract module name (first line)
    const moduleMatch = goModContent.match(/^module\s+(.+)/m);
    if (moduleMatch && !result.description) {
      result.description = `Go module: ${moduleMatch[1]}`;
    }

    // Detect common Go libraries
    if (goModContent.includes('github.com/gorilla/mux')) {
      result.architecture.push('HTTP server (gorilla/mux)');
    }
    if (goModContent.includes('github.com/gin-gonic/gin')) {
      result.architecture.push('HTTP server (Gin)');
    }
    if (goModContent.includes('github.com/mattn/go-sqlite3')) {
      result.database = 'SQLite';
      result.categories.push('database');
    }
    if (goModContent.includes('github.com/lib/pq') || goModContent.includes('gorm.io/driver/postgres')) {
      result.database = 'PostgreSQL';
      result.categories.push('database');
    }
    if (goModContent.includes('go-sql-driver/mysql')) {
      result.database = 'MySQL';
      result.categories.push('database');
    }

    result.build_system = 'go build';
  } catch {
    // No go.mod
  }

  // Try Python (requirements.txt or pyproject.toml)
  try {
    const reqPath = path.join(projectPath, 'requirements.txt');
    const reqContent = await fs.readFile(reqPath, 'utf-8');

    result.tech_stack.push('Python');

    if (reqContent.includes('django')) {
      result.architecture.push('Django framework');
    }
    if (reqContent.includes('flask')) {
      result.architecture.push('Flask framework');
    }
    if (reqContent.includes('fastapi')) {
      result.architecture.push('FastAPI framework');
    }
    if (reqContent.includes('sqlalchemy')) {
      result.categories.push('database');
    }
  } catch {
    // Try pyproject.toml
    try {
      const pyprojectPath = path.join(projectPath, 'pyproject.toml');
      await fs.stat(pyprojectPath);
      result.tech_stack.push('Python');
      result.build_system = 'pyproject.toml';
    } catch {
      // No Python project
    }
  }

  // Try Rust (Cargo.toml)
  try {
    const cargoPath = path.join(projectPath, 'Cargo.toml');
    const cargoContent = await fs.readFile(cargoPath, 'utf-8');

    result.tech_stack.push('Rust');
    result.build_system = 'cargo';

    // Extract version
    const versionMatch = cargoContent.match(/^version\s*=\s*"([^"]+)"/m);
    if (versionMatch) {
      result.version = versionMatch[1];
    }
  } catch {
    // No Cargo.toml
  }

  // Check for Supabase directory (any project type)
  try {
    const supabasePath = path.join(projectPath, 'supabase');
    const supabaseStats = await fs.stat(supabasePath);
    if (supabaseStats.isDirectory()) {
      if (!result.database) result.database = 'PostgreSQL (Supabase)';
      result.architecture.push('Supabase edge functions');
      result.categories.push('database', 'edge-functions');
    }
  } catch {
    // No supabase directory
  }

  // Check for README to extract description if not set
  if (!result.description) {
    try {
      const readmePath = path.join(projectPath, 'README.md');
      const readmeContent = await fs.readFile(readmePath, 'utf-8');

      // Extract first heading or first paragraph
      const headingMatch = readmeContent.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        result.description = headingMatch[1];
      } else {
        // Get first non-empty line
        const lines = readmeContent.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          result.description = lines[0].substring(0, 200);
        }
      }
    } catch {
      // No README
    }
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
  let result;

  if (storageChoice === 'local') {
    // Create local .hive.json file
    const userId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    if (projectPath) {
      await createLocalHive(projectPath, projectId, projectName, userId);
    }
    result = { user_id: userId, project_id: projectId, project_name: projectName };
  } else {
    // Use cloud storage (Supabase)
    result = await initProjectKB(projectId, projectName, storageChoice);
  }

  let scannedEntries = 0;
  let scanResult: ProjectScanResult | undefined;

  // Step 3: Scan project and auto-contribute base knowledge
  if (projectPath && result.user_id) {
    try {
      scanResult = await scanProject(projectPath);

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
          false,
          projectPath
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
          false,
          projectPath
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
          false,
          projectPath
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
          false,
          projectPath
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
          false,
          projectPath
        );
        scannedEntries++;
      }
    } catch (error) {
      console.error('Scanner error:', error);
      // Continue even if scan fails
    }
  }

  const storageLocation = storageChoice === 'cloud'
    ? 'Supabase cloud database (ksethrexopllfhyrxlrb.supabase.co)'
    : 'Supabase cloud database (ksethrexopllfhyrxlrb.supabase.co)';

  const nextStepsMessage = `This hive is your project's growing brain. Every solution, pitfall, broken approach, and architecture decision you store makes Claude faster and smarter in future sessions. The bigger your hive grows, the less you re-explain and the fewer past mistakes get repeated.

Updating is simple: Just say "update hive" and Claude will analyze what you worked on and add relevant entries automatically.

Store:
- Solutions that worked
- Approaches that failed (so Claude avoids them)
- Architecture decisions and why you made them
- Database schema changes
- Common pitfalls and gotchas
- Dependencies and version issues

For maximum impact, add this to your CLAUDE.md:

## Project Hive: ${projectName}
- User ID: ${result.user_id}
- Project ID: ${projectId}

**Protocol:**
1. Search hive before working: mcp__hivemind__search_project(user_id, query, project_id)
2. After every session: "update hive" (Claude adds entries for you)
3. Keep it current - run "update hive" after major changes

Bigger hive = Smarter Claude = Faster development. Your project knowledge compounds over time.

Want to see your current hive? Say "show me my hive"`;

  const localStoragePath = storageChoice === 'local' ? `${projectPath}/.hive.json` : null;

  const statusMessage = storageChoice === 'cloud'
    ? `Hive active with 10x limits. Your project knowledge syncs wherever you go, and your solutions help improve Hivemind for everyone. User ID: ${result.user_id} (save this)${scannedEntries > 0 ? `. Scanned and added ${scannedEntries} foundational entries to Supabase cloud database.` : ''}`
    : `Hive active. Knowledge stays private on this machine. User ID: ${result.user_id} (save this)${scannedEntries > 0 ? `. Scanned and added ${scannedEntries} foundational entries to ${localStoragePath}.` : ''}`;

  return {
    step: 'confirm_setup',
    message: `${statusMessage}\n\n${nextStepsMessage}`,
    user_id: result.user_id,
    project_id: result.project_id,
    storage_type: storageChoice,
    scanned_entries: scannedEntries,
    scan_results: scanResult ? {
      tech_stack: scanResult.tech_stack,
      architecture: scanResult.architecture,
      database: scanResult.database,
      build_system: scanResult.build_system,
      description: scanResult.description,
      version: scanResult.version
    } : undefined
  };
}
