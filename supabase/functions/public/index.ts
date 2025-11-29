// Public Gateway for Hivemind MCP
// NO JWT required - rate limiting and security handled internally
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Rate limit: 100 requests per hour per IP
const RATE_LIMIT = 100;
const RATE_WINDOW_MINUTES = 60;

function getRealClientIP(req: Request): string {
  const cfIP = req.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;
  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIP = forwardedFor.split(',')[0].trim();
    if (firstIP) return firstIP;
  }
  return 'unknown';
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const clientIP = getRealClientIP(req);
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop(); // e.g., /public/search -> search

    // Check rate limit
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      p_ip_address: clientIP,
      p_endpoint: `public_${action}`,
      p_limit: RATE_LIMIT,
      p_window_minutes: RATE_WINDOW_MINUTES
    });

    if (!rateLimitOk) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded. Please try again later.',
        retry_after_minutes: RATE_WINDOW_MINUTES
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if IP is banned
    const { data: banned } = await supabase
      .from('banned_ips')
      .select('ip_address')
      .eq('ip_address', clientIP)
      .maybeSingle();

    if (banned) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();

    // Route to appropriate handler
    switch (action) {
      case 'search':
        return await handleSearch(supabase, body, corsHeaders);
      case 'contribute':
        return await handleContribute(supabase, body, clientIP, corsHeaders);
      case 'report':
        return await handleReport(supabase, body, corsHeaders);
      case 'search-skills':
        return await handleSearchSkills(supabase, body, corsHeaders);
      case 'skill':
        return await handleGetSkill(supabase, body, corsHeaders);
      case 'count-skills':
        return await handleCountSkills(supabase, corsHeaders);
      case 'init-project':
        return await handleInitProject(supabase, body, corsHeaders);
      case 'contribute-project':
        return await handleContributeProject(supabase, body, corsHeaders);
      case 'search-project':
        return await handleSearchProject(supabase, body, corsHeaders);
      default:
        return new Response(JSON.stringify({
          error: 'Unknown action',
          available_actions: ['search', 'contribute', 'report', 'search-skills', 'skill', 'count-skills', 'init-project', 'contribute-project', 'search-project']
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Gateway error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Search knowledge base
async function handleSearch(supabase: any, body: any, corsHeaders: any) {
  const { query, max_results = 5, session_id = null, type = null } = body;

  if (!query) {
    return new Response(JSON.stringify({ error: 'query parameter required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const startTime = performance.now();

  // Detect query type
  const detectedType = type || detectQueryType(query);

  // Search
  const { data: results, error } = await supabase.rpc('search_knowledge', {
    search_query: query,
    result_limit: max_results,
    ...(type && { type_filter: type })
  });

  if (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const searchTime = performance.now() - startTime;

  // No results - create ticket
  if (!results || results.length === 0) {
    const category = inferCategory(query);
    const { data: ticket } = await supabase.rpc('start_troubleshooting_ticket', {
      p_problem: query,
      p_category: category,
      p_session_id: session_id
    });

    return new Response(JSON.stringify({
      query,
      primary_solution: null,
      confidence: 0.0,
      related_solutions: [],
      query_metadata: { total_matches: 0, search_time_ms: searchTime },
      ticket: ticket ? {
        ticket_id: ticket.ticket_id,
        status: 'open',
        category: ticket.category,
        checklist: ticket.checklist,
        message: `No solutions found. Opened ${ticket.ticket_id} to troubleshoot.`
      } : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Build response
  const primary = results[0];
  const related = results.slice(1, 4).map((r: any) => ({
    similarity_score: r.search_rank ? Math.abs(r.search_rank) : 0.5,
    entry: { id: r.id, query: r.query, category: r.category, solutions: r.solutions }
  }));

  return new Response(JSON.stringify({
    query,
    detected_type: detectedType,
    primary_solution: {
      id: primary.id,
      type: primary.type || 'fix',
      query: primary.query,
      category: primary.category,
      hit_frequency: primary.hit_frequency,
      solutions: primary.solutions,
      failed_attempts: primary.failed_attempts || [],
      common_pitfalls: primary.common_pitfalls
    },
    confidence: 0.85,
    related_solutions: related,
    community_stats: {
      total_hits: primary.hit_frequency === 'HIGH' ? 200 : 50,
      success_rate: primary.success_rate || 0.75,
      last_updated: primary.updated_at
    },
    query_metadata: {
      total_matches: results.length,
      search_method: 'postgres_fts',
      search_time_ms: Math.round(searchTime * 100) / 100
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Contribute new solution
async function handleContribute(supabase: any, body: any, clientIP: string, corsHeaders: any) {
  const { query, solution, category = 'general' } = body;

  if (!query || !solution) {
    return new Response(JSON.stringify({ error: 'query and solution required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Sanitize for credentials
  const sanitized = sanitizeForSecrets(solution);
  if (sanitized.hasSecrets) {
    return new Response(JSON.stringify({
      error: 'Solution appears to contain sensitive data (API keys, passwords, tokens). Please remove before submitting.',
      detected_patterns: sanitized.patterns
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { data, error } = await supabase
    .from('knowledge_entries')
    .insert({
      query,
      solutions: [{ solution: sanitized.text, percentage: 70, note: 'community contributed' }],
      category,
      type: 'fix',
      verified: false,
      verification_source: 'community',
      contributor_email: `ip:${clientIP.substring(0, 8)}...`
    })
    .select('id')
    .single();

  if (error) {
    console.error('Contribute error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Solution submitted for review',
    entry_id: data.id
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Report outcome
async function handleReport(supabase: any, body: any, corsHeaders: any) {
  const { solution_id, outcome } = body;

  if (!outcome || !['success', 'failure'].includes(outcome)) {
    return new Response(JSON.stringify({ error: 'outcome must be success or failure' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { error } = await supabase.rpc('increment_outcome', {
    p_entry_id: solution_id,
    p_outcome: outcome
  });

  if (error) {
    console.error('Report error:', error);
  }

  return new Response(JSON.stringify({ success: true, message: 'Outcome recorded' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Search skills - returns lightweight summaries, use get_skill for full details
async function handleSearchSkills(supabase: any, body: any, corsHeaders: any) {
  const { query, max_results = 20 } = body;

  if (!query) {
    return new Response(JSON.stringify({ error: 'query parameter required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const startTime = performance.now();

  // Cap at 50 to prevent huge responses
  const cappedLimit = Math.min(max_results, 50);

  // Use FTS search filtered to skills only
  const { data: results, error } = await supabase.rpc('search_knowledge', {
    search_query: query,
    result_limit: cappedLimit,
    type_filter: 'skill'
  });

  if (error) {
    console.error('Skills search error:', error);
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const searchTime = performance.now() - startTime;

  // Return lightweight summaries only (no full solutions array)
  const skills = (results || []).map((r: any) => ({
    id: r.id,
    title: r.query,
    category: r.category,
    // Just first solution as preview, not the full array
    preview: r.solutions?.[0]?.solution?.substring(0, 150) + '...' || '',
    relevance: r.search_rank ? Math.abs(r.search_rank) : 0.5
  }));

  return new Response(JSON.stringify({
    query,
    skills,
    total: skills.length,
    tip: skills.length > 0 ? `Use get_skill(${skills[0].id}) to see full details` : 'No matching skills found',
    query_metadata: {
      search_method: 'postgres_fts',
      search_time_ms: Math.round(searchTime * 100) / 100
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Get single skill
async function handleGetSkill(supabase: any, body: any, corsHeaders: any) {
  const { skill_id } = body;

  if (!skill_id) {
    return new Response(JSON.stringify({ error: 'skill_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { data, error } = await supabase
    .from('knowledge_entries')
    .select('*')
    .eq('id', skill_id)
    .eq('type', 'skill')
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Skill not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Count skills - returns total count only
async function handleCountSkills(supabase: any, corsHeaders: any) {
  const { count, error } = await supabase
    .from('knowledge_entries')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'skill');

  if (error) {
    console.error('Count skills error:', error);
    return new Response(JSON.stringify({ error: 'Count failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    total: count || 0
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Initialize project KB - creates user_id if needed, sets cloud tier
async function handleInitProject(supabase: any, body: any, corsHeaders: any) {
  const { project_id, project_name, storage_type = 'cloud' } = body;

  if (!project_id || !project_name) {
    return new Response(JSON.stringify({ error: 'project_id and project_name required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Generate user_id (simple UUID for now, could be extended to real auth)
  const user_id = crypto.randomUUID();

  // Set cloud storage tier (1000/hour rate limit)
  if (storage_type === 'cloud') {
    const { error: tierError } = await supabase.rpc('set_cloud_storage_tier', {
      p_user_id: user_id
    });

    if (tierError) {
      console.error('Failed to set cloud tier:', tierError);
    }
  }

  return new Response(JSON.stringify({
    success: true,
    user_id,
    project_id,
    project_name,
    storage_type,
    rate_limit: storage_type === 'cloud' ? 1000 : 100,
    message: `Project KB initialized. Store this user_id for future contributions.`
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Contribute to project KB - stores project-specific knowledge
async function handleContributeProject(supabase: any, body: any, corsHeaders: any) {
  const { user_id, project_id, query, solution, category, is_public = false } = body;

  if (!user_id || !project_id || !query || !solution) {
    return new Response(JSON.stringify({ error: 'user_id, project_id, query, and solution required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get project name from first entry or use project_id as fallback
  const { data: existingEntry } = await supabase
    .from('knowledge_entries')
    .select('project_name')
    .eq('user_id', user_id)
    .eq('project_id', project_id)
    .limit(1)
    .single();

  const project_name = existingEntry?.project_name || project_id;

  // Insert project knowledge entry
  const { data, error } = await supabase
    .from('knowledge_entries')
    .insert({
      user_id,
      project_id,
      project_name,
      query,
      solution,
      category: category || 'general',
      is_public,
      type: 'solution',
      success_count: 0,
      failure_count: 0,
      command: null
    })
    .select()
    .single();

  if (error) {
    console.error('Contribute project error:', error);
    return new Response(JSON.stringify({ error: 'Failed to store project knowledge' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    entry_id: data.id,
    message: `Added to ${project_name} KB${is_public ? ' (public)' : ' (private)'}`
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Search project KB - searches user's private project knowledge
async function handleSearchProject(supabase: any, body: any, corsHeaders: any) {
  const { user_id, project_id, query, include_public = true } = body;

  if (!user_id || !query) {
    return new Response(JSON.stringify({ error: 'user_id and query required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Build query filter
  let queryBuilder = supabase
    .from('knowledge_entries')
    .select('*');

  if (project_id) {
    // Search specific project
    queryBuilder = queryBuilder.or(`user_id.eq.${user_id},is_public.eq.true`);
    queryBuilder = queryBuilder.eq('project_id', project_id);
  } else {
    // Search all user's projects + public if enabled
    if (include_public) {
      queryBuilder = queryBuilder.or(`user_id.eq.${user_id},is_public.eq.true`);
    } else {
      queryBuilder = queryBuilder.eq('user_id', user_id);
    }
  }

  // Use text search on query and solution
  queryBuilder = queryBuilder.textSearch('fts', query.split(' ').join(' & '));
  queryBuilder = queryBuilder.limit(10);

  const { data: results, error } = await queryBuilder;

  if (error) {
    console.error('Search project error:', error);
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    query,
    results: results || [],
    count: results?.length || 0,
    source: project_id ? `project:${project_id}` : 'all projects'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Helper: Detect query type
function detectQueryType(query: string): string {
  const q = query.toLowerCase();
  const errorSignals = /(error|failed|failure|exception|cannot|unable|crash|timeout|refused|denied|broken|not working|doesn't work|won't|can't|bug|issue|problem|fix)/i;
  const howtoSignals = /^(how (do|to|can|should)|what('s| is) the (best|right) way|guide|tutorial|setup|configure|install|create|build|implement)/i;

  if (errorSignals.test(q)) return 'fix';
  if (howtoSignals.test(q)) return 'flow';
  return 'fix';
}

// Helper: Infer category
function inferCategory(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('mcp') || q.includes('server') || q.includes('connection')) return 'mcp-troubleshooting';
  if (q.includes('playwright') || q.includes('browser') || q.includes('selector')) return 'web-automation';
  if (q.includes('supabase') || q.includes('database') || q.includes('postgres')) return 'database';
  if (q.includes('auth') || q.includes('login') || q.includes('token')) return 'authentication';
  return 'general';
}

// Helper: Check entropy of a string (high entropy = likely a secret)
function getEntropy(str: string): number {
  const len = str.length;
  if (len === 0) return 0;
  const freq: Record<string, number> = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Helper: Try to decode base64 and check for secrets
function decodeBase64Safe(str: string): string | null {
  try {
    // Only try if it looks like base64
    if (!/^[A-Za-z0-9+/=]{20,}$/.test(str)) return null;
    const decoded = atob(str);
    // Check if decoded is printable ASCII
    if (/^[\x20-\x7E]+$/.test(decoded)) return decoded;
    return null;
  } catch {
    return null;
  }
}

// Helper: Sanitize for secrets - BLOCKS submission if secrets detected
function sanitizeForSecrets(text: string): { text: string; hasSecrets: boolean; patterns: string[] } {
  const patterns: string[] = [];

  // Pre-process: remove zero-width chars that could obfuscate
  let cleanText = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');

  // Detect various secret patterns
  const secretPatterns = [
    // JWT and generic tokens
    { name: 'JWT Token', regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
    { name: 'Bearer Token', regex: /[Bb]earer\s+[A-Za-z0-9_-]{20,}/g },

    // AI provider keys
    { name: 'Anthropic Key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
    { name: 'OpenAI Key', regex: /sk-proj-[A-Za-z0-9_-]{20,}/g },
    { name: 'OpenAI Key (old)', regex: /sk-[A-Za-z0-9]{40,}/g },

    // Cloud provider keys
    { name: 'AWS Key', regex: /AKIA[0-9A-Z]{16}/g },
    { name: 'AWS Secret', regex: /aws_secret_access_key\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi },
    { name: 'GCP Key', regex: /AIza[A-Za-z0-9_-]{35}/g },
    // Azure - require context keyword to avoid UUID false positives
    { name: 'Azure Key', regex: /(azure|AZURE|Azure)[_A-Za-z]*\s*[=:]\s*['"]?[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}['"]?/gi },

    // Git provider tokens
    { name: 'GitHub PAT', regex: /ghp_[A-Za-z0-9]{36,}/g },
    { name: 'GitHub OAuth', regex: /gho_[A-Za-z0-9]{36,}/g },
    { name: 'GitHub App', regex: /ghs_[A-Za-z0-9]{36,}/g },
    { name: 'GitLab PAT', regex: /glpat-[A-Za-z0-9_-]{20,}/g },
    { name: 'Bitbucket Token', regex: /ATBB[A-Za-z0-9]{32,}/g },

    // Payment/SaaS keys
    { name: 'Stripe Key', regex: /sk_live_[A-Za-z0-9]{24,}/g },
    { name: 'Stripe Test Key', regex: /sk_test_[A-Za-z0-9]{24,}/g },
    { name: 'Stripe Publishable', regex: /pk_live_[A-Za-z0-9]{24,}/g },
    { name: 'Twilio Key', regex: /SK[A-Za-z0-9]{32}/g },
    { name: 'SendGrid Key', regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g },
    { name: 'Slack Token', regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
    { name: 'Discord Token', regex: /[MN][A-Za-z0-9]{23,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}/g },

    // Database/infra
    { name: 'Supabase Key', regex: /sbp_[A-Za-z0-9]{40,}/g },
    { name: 'Supabase Anon Key', regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
    { name: 'MongoDB URI', regex: /mongodb(\+srv)?:\/\/[^\s]+:[^\s]+@/g },
    { name: 'Redis URL', regex: /redis:\/\/[^\s]*:[^\s]+@/g },
    { name: 'Password in URL', regex: /:([^:@\s]{8,})@[A-Za-z0-9.-]+/g },

    // Private keys
    { name: 'Private Key', regex: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY( BLOCK)?-----/g },
    { name: 'SSH Key', regex: /ssh-(rsa|ed25519|ecdsa)\s+[A-Za-z0-9+/=]{100,}/g },

    // Generic patterns (keep last - more prone to false positives)
    { name: 'API Key (pk-)', regex: /pk-[A-Za-z0-9]{20,}/g },
    { name: 'Generic Secret', regex: /(password|secret|token|api_key|apikey|auth_token|access_token)\s*[=:]\s*['"]?[A-Za-z0-9_-]{16,}['"]?/gi },
    { name: 'Hex Secret', regex: /(secret|key|token|password)\s*[=:]\s*['"]?[a-f0-9]{32,}['"]?/gi },

    // URL query params with secrets
    { name: 'Secret in URL Param', regex: /[?&](api_key|token|secret|password|key|auth|access_token)=[^&\s]{8,}/gi },

    // Environment variable exports
    { name: 'Env Export', regex: /export\s+[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z_]*\s*=\s*['"]?[^\s'"]{12,}['"]?/gi },

    // JSON secret fields
    { name: 'JSON Secret', regex: /"(api_key|apiKey|secret|password|token|auth|credential|private_key)":\s*"[^"]{12,}"/gi },

    // YAML secret fields
    { name: 'YAML Secret', regex: /(api_key|apiKey|secret|password|token|auth|credential):\s*['"]?[^\s'"]{12,}['"]?/gi },

    // Spaced out common prefixes (obfuscation attempt)
    { name: 'Obfuscated Key', regex: /s\s*k\s*[-_.\s]\s*a\s*n\s*t/gi },
    { name: 'Obfuscated Key', regex: /g\s*h\s*p\s*_/gi },

    // MySQL/CLI password flags
    { name: 'CLI Password Flag', regex: /-(p|password)[=]?[A-Za-z0-9_!@#$%^&*]{8,}/g },

    // Webhook URLs (Slack, Discord, etc)
    { name: 'Webhook URL', regex: /https:\/\/hooks\.(slack|discord)\.com\/[^\s]{20,}/gi },
    { name: 'Discord Webhook', regex: /https:\/\/discord\.com\/api\/webhooks\/[^\s]{20,}/gi },

    // Basic auth header
    { name: 'Basic Auth', regex: /Basic\s+[A-Za-z0-9+/=]{20,}/gi },

    // Broader env patterns (PASS, CRED, AUTH)
    { name: 'Env Secret', regex: /[A-Z_]*(PASS|CRED|AUTH|PWD)[A-Z_]*\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/g },

    // Telegram bot token
    { name: 'Telegram Token', regex: /\d{8,}:[A-Za-z0-9_-]{35}/g },

    // NPM authToken
    { name: 'NPM Token', regex: /_authToken\s*=\s*[^\s]{20,}/gi },

    // PyPI token
    { name: 'PyPI Token', regex: /pypi-[A-Za-z0-9]{40,}/g },

    // Rubygems
    { name: 'Rubygems Token', regex: /rubygems_[A-Za-z0-9]{48}/g },

    // Doppler token
    { name: 'Doppler Token', regex: /dp\.pt\.[A-Za-z0-9]{40,}/g }
  ];

  let sanitized = cleanText;
  for (const pattern of secretPatterns) {
    if (pattern.regex.test(cleanText)) {
      patterns.push(pattern.name);
      // Reset regex lastIndex for global patterns
      pattern.regex.lastIndex = 0;
      sanitized = sanitized.replace(pattern.regex, `[REDACTED_${pattern.name.toUpperCase().replace(/\s+/g, '_')}]`);
    }
  }

  // Check for base64-encoded secrets
  const base64Matches = cleanText.match(/[A-Za-z0-9+/=]{30,}/g) || [];
  for (const match of base64Matches) {
    const decoded = decodeBase64Safe(match);
    if (decoded) {
      // Re-run pattern check on decoded content
      for (const pattern of secretPatterns) {
        if (pattern.regex.test(decoded)) {
          patterns.push(`Base64 Encoded ${pattern.name}`);
          pattern.regex.lastIndex = 0;
          sanitized = sanitized.replace(match, '[REDACTED_BASE64_SECRET]');
          break;
        }
      }
      // Also check if decoded looks like key=value with secret
      if (/^[A-Za-z_]+=.{8,}$/.test(decoded) || decoded.includes('password') || decoded.includes('secret')) {
        if (!patterns.includes('Base64 Encoded Secret')) {
          patterns.push('Base64 Encoded Secret');
          sanitized = sanitized.replace(match, '[REDACTED_BASE64_SECRET]');
        }
      }
    }
  }

  // High entropy check for long random-looking strings near secret keywords
  const suspiciousContexts = cleanText.match(/(key|token|secret|password|credential|auth)\s*[=:]\s*['"]?([A-Za-z0-9_\-+/]{20,})['"]?/gi) || [];
  for (const ctx of suspiciousContexts) {
    const valueMatch = ctx.match(/[=:]\s*['"]?([A-Za-z0-9_\-+/]{20,})['"]?/);
    if (valueMatch && valueMatch[1]) {
      const entropy = getEntropy(valueMatch[1]);
      // Entropy > 4.0 for 20+ char string is likely random/secret
      if (entropy > 4.0 && !patterns.includes('High Entropy Secret')) {
        patterns.push('High Entropy Secret');
        sanitized = sanitized.replace(valueMatch[1], '[REDACTED_HIGH_ENTROPY]');
      }
    }
  }

  return {
    text: sanitized,
    hasSecrets: patterns.length > 0,
    patterns
  };
}
