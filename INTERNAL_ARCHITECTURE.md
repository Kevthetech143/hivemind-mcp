# Hivemind Internal Architecture

**Last Updated**: 2025-11-28
**Version**: 1.0.11

---

## Overview

Hivemind is a collective debugging knowledge base for AI agents. This document tracks the internal setup, credentials, and architecture decisions.

---

## Infrastructure

### Supabase Project
- **Project Ref**: `ksethrexopllfhyrxlrb`
- **Project URL**: `https://ksethrexopllfhyrxlrb.supabase.co`
- **Region**: (check dashboard)
- **Plan**: Free tier

### Credentials (DO NOT COMMIT)
Stored in `~/.env.local`:
- `SUPABASE_DB_PASSWORD` - Direct postgres password (port 5432)
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side only (never expose)
- `SUPABASE_ANON_KEY` - Public key (safe for frontend)

---

## API Architecture

### Public Gateway (v1.0.11+)
```
Client → Public Edge Function → Supabase DB
         (no auth required)     (service role)
```

**Endpoint**: `https://ksethrexopllfhyrxlrb.supabase.co/functions/v1/public/{action}`

**Actions**:
| Action | Description |
|--------|-------------|
| `/public/search` | Search knowledge base |
| `/public/contribute` | Submit new solution (with credential scanning) |
| `/public/report` | Report success/failure outcome |
| `/public/skills` | List all skills |
| `/public/skill` | Get specific skill by ID |

**Security**:
- No JWT required (public access)
- Rate limiting: 100 req/hr per IP
- IP banning support
- Credential scanning on contributions

### Authenticated Endpoints (Internal)
```
Client → Edge Function → Supabase DB
         (JWT required)
```

**Endpoints**: `/search`, `/contribute`, `/track`, `/ticket`, `/admin`, `/flows`
- Require `Authorization: Bearer <anon_key>` header
- Used by admin tools and internal services

---

## NPM Package

### hivemind-mcp
- **Registry**: https://www.npmjs.com/package/hivemind-mcp
- **Install**: `npx -y hivemind-mcp@latest`
- **Version History**:
  - 1.0.10: Hardcoded anon key (REMOVED)
  - 1.0.11: Public gateway, zero credentials, credential scanning

### MCP Tools Exposed
| Tool | Description |
|------|-------------|
| `search_kb` | Search knowledge base |
| `report_outcome` | Report if solution worked |
| `contribute_solution` | Submit new solution |
| `list_skills` | List available skills |
| `get_skill` | Get skill details |

---

## Database Schema

### Core Tables
- `knowledge_entries` - Solutions and skills
- `search_logs` - Search analytics
- `troubleshooting_tickets` - Open debug tickets
- `ticket_steps` - Debug step tracking

### Security Tables
- `banned_ips` - IP blocklist
- `rate_limits` - Request tracking
- `security_audit_log` - Security events

### RLS Status
⚠️ **PENDING**: RLS migration not yet applied
- File: `supabase/migrations/20251128_security_audit_fixes.sql`
- Status: Created but not deployed (network restriction)
- Apply via: Dashboard SQL editor or direct psql

---

## Edge Functions

| Function | JWT Required | Purpose |
|----------|--------------|---------|
| `public` | ❌ No | Public gateway for MCP clients |
| `search` | ✅ Yes | Direct search (authenticated) |
| `contribute` | ✅ Yes | Direct contribute (authenticated) |
| `track` | ✅ Yes | Analytics tracking |
| `ticket` | ✅ Yes | Ticket management |
| `admin` | ✅ Yes | Admin operations |
| `flows` | ✅ Yes | Skills/flows management |

---

## Credential Scanning

Implemented in `public` Edge Function. Blocks submissions containing:
- JWT tokens (`eyJ...`)
- API keys (`sk-`, `pk-`, `AKIA...`)
- Passwords in URLs (`:password@`)
- Bearer tokens
- Private keys (`-----BEGIN...`)
- Supabase keys (`sbp_...`)
- Generic secrets (`password=`, `api_key=`, etc.)

---

## Deployment

### Edge Functions
```bash
npx supabase functions deploy public --no-verify-jwt --project-ref ksethrexopllfhyrxlrb
```

### NPM Package
```bash
cd hivemind-mcp
npm run build
npm publish
```

### Direct DB Access (bypasses MCP read-only)
```bash
/usr/local/opt/libpq/bin/psql "postgresql://postgres:PASSWORD@db.ksethrexopllfhyrxlrb.supabase.co:5432/postgres"
```
⚠️ Use port 5432 (direct), NOT 6543 (pooler - causes "Tenant not found")

---

## Known Issues

1. **Network Restrictions**: Some Claude sandboxes block direct psql connections
2. **RLS Not Applied**: Security migration pending deployment
3. **Miners**: May need alternative upload method if psql blocked

---

## Changelog

### 2025-11-28
- Created public gateway Edge Function
- Removed hardcoded credentials from NPM package
- Added credential scanning for contributions
- Published v1.0.11

### Previous
- v1.0.7-1.0.10: API endpoint fixes, auth fixes
