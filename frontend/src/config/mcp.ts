// Expose MCP endpoint URL using Vite env var VITE_MCP_BASE_URL in production.
// Falls back to http://localhost:4000 for local development.
const DEFAULT_LOCAL = 'http://localhost:4000'

export const MCP_API_BASE = (import.meta.env.VITE_MCP_BASE_URL || DEFAULT_LOCAL).replace(/\/+$/, '')

export const MCP_PAGE_TREE_URL = `${MCP_API_BASE}/api/mcp/page-tree`