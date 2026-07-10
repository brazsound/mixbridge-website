/**
 * Shared types and helpers for the extension directory.
 *
 * The registry is the single source of truth for what extensions exist. It's a
 * static JSON file served from the mixbridge GitHub repo (raw), so both the
 * public list (/extensions) and the per-extension detail page
 * (/extensions/:id) read from the same place with no backend of our own.
 *
 * Community data (votes, comments) lives in Supabase and is keyed by the
 * extension `id` — see CommentThread and the *_vote_counts / *_comment_counts
 * views.
 */

export const REGISTRY_URL =
  'https://raw.githubusercontent.com/brazsound/mixbridge/main/registry/registry.json';

export interface RegistryFiles {
  /** Raw URL of the extension manifest (plugin.json). */
  manifest?: string;
  /** Raw URL of the extension entry point (main.js). */
  main?: string;
}

export interface RegistryEntry {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  repository?: string;
  license?: string;
  minAppVersion?: string;
  permissions?: string[];
  allowedDomains?: string[];
  files?: RegistryFiles;
  status?: string;
}

/** Human labels for the permission scopes an extension can request. */
export const PERMISSION_LABELS: Record<string, string> = {
  'queue:read': 'Read queue',
  'queue:write': 'Edit queue',
  events: 'Lifecycle events',
  naming: 'Naming tokens',
  'files:read': 'Read files',
  'files:write': 'Write files',
  network: 'Network',
  'ui:menus': 'Context menus',
  'ui:panels': 'Panels',
};

/** One-line explanation of what each permission lets an extension do. */
export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'queue:read': 'See the items currently in your bounce queue.',
  'queue:write': 'Add, remove, or reorder items in your queue.',
  events: 'React to app lifecycle events (runs, bounces, sessions).',
  naming: 'Provide custom tokens for output file names.',
  'files:read': 'Read files produced by a run (e.g. finished bounces).',
  'files:write': 'Write files to disk.',
  network: 'Make network requests to the allowed domains listed below.',
  'ui:menus': 'Add items to context menus.',
  'ui:panels': 'Add custom panels to the app.',
};

/** Compact relative time, e.g. "just now", "5m ago", "3d ago". */
export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Fetch and normalize the registry. Filters out entries that shouldn't be shown
 * publicly (missing id, delisted, or still pending review).
 */
export async function fetchRegistry(): Promise<RegistryEntry[]> {
  const res = await fetch(REGISTRY_URL);
  if (!res.ok) throw new Error(`Registry responded ${res.status}`);
  const data = (await res.json()) as { extensions?: RegistryEntry[] };
  return (data.extensions ?? []).filter(
    (e) => e.id && e.status !== 'delisted' && e.status !== 'pending'
  );
}
