import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

/**
 * Submit an extension to the MixBridge store — no GitHub PR required.
 *
 * Paste a link to your plugin.json; we fetch it, validate it live, preview
 * the store listing, and queue it for review. Approved extensions appear in
 * the app's Browse tab and on /extensions.
 */

const KNOWN_PERMISSIONS = [
  'queue:read', 'queue:write', 'events', 'naming',
  'files:read', 'files:write', 'network', 'ui:menus', 'ui:panels',
];

interface Manifest {
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
}

interface Submission {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  extension_id: string;
  name: string;
  version: string;
  created_at: string;
}

/** Accepts github.com blob URLs and converts them to raw.githubusercontent. */
function toRawUrl(input: string): string {
  const url = input.trim();
  const blob = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (blob) return `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}`;
  return url;
}

function validateManifest(m: Manifest): string[] {
  const errors: string[] = [];
  if (!m.id || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(m.id)) {
    errors.push('"id" must be lowercase letters, digits, and dashes (e.g. "my-extension")');
  }
  if (!m.name || !m.name.trim()) errors.push('"name" is required');
  if (!m.version || !/^\d+\.\d+\.\d+$/.test(m.version)) errors.push('"version" must be semver (e.g. "1.0.0")');
  if (!m.repository || !/^https:\/\/github\.com\/.+\/.+/.test(m.repository)) {
    errors.push('"repository" must be a public GitHub URL — listings must be open source');
  }
  if (!m.license || !m.license.trim()) errors.push('"license" is required (OSI-approved, e.g. "MIT")');
  const perms = m.permissions ?? [];
  const unknown = perms.filter((p) => !KNOWN_PERMISSIONS.includes(p));
  if (unknown.length > 0) errors.push(`Unknown permission(s): ${unknown.join(', ')}`);
  if (perms.includes('network') && (!m.allowedDomains || m.allowedDomains.length === 0)) {
    errors.push('"network" permission requires "allowedDomains"');
  }
  if (!m.description || m.description.trim().length < 20) {
    errors.push('"description" should be at least 20 characters — it becomes your store listing');
  }
  return errors;
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  outline: 'none',
};

export function AccountExtensions() {
  const { user } = useAuth();
  const [manifestInput, setManifestInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestUrl, setManifestUrl] = useState('');
  const [mainUrl, setMainUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mine, setMine] = useState<Submission[]>([]);

  const loadMine = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('extension_submissions')
      .select('id, status, review_note, extension_id, name, version, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setMine(data as Submission[]);
  }, [user]);

  useEffect(() => { void loadMine(); }, [loadMine]);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    setFatal(null);
    setErrors([]);
    setManifest(null);
    setSubmitted(false);
    try {
      const url = toRawUrl(manifestInput);
      if (!/^https:\/\/raw\.githubusercontent\.com\/.+plugin\.json$/.test(url)) {
        setFatal('Paste a link to your plugin.json on GitHub (the file page URL works — we convert it).');
        return;
      }
      const res = await fetch(url);
      if (!res.ok) {
        setFatal(`Couldn't fetch plugin.json (${res.status}). Is the repository public?`);
        return;
      }
      let m: Manifest;
      try {
        m = (await res.json()) as Manifest;
      } catch {
        setFatal('plugin.json is not valid JSON.');
        return;
      }
      const problems = validateManifest(m);

      // main.js must live next to plugin.json
      const main = url.replace(/plugin\.json$/, 'main.js');
      const mainRes = await fetch(main, { method: 'HEAD' }).catch(() => null);
      if (!mainRes || !mainRes.ok) {
        problems.push('main.js not found next to plugin.json');
      }

      setErrors(problems);
      setManifest(m);
      setManifestUrl(url);
      setMainUrl(main);
    } catch (e) {
      setFatal((e as Error).message);
    } finally {
      setChecking(false);
    }
  }, [manifestInput]);

  const handleSubmit = useCallback(async () => {
    if (!user || !manifest || errors.length > 0) return;
    setSubmitting(true);
    setFatal(null);
    try {
      // Submit through the backend so support gets notified and the submitter
      // receives a confirmation email (see /api/web/submit-extension).
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = ((import.meta.env.VITE_LICENSE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/api/web/submit-extension`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          extension_id: manifest.id,
          name: manifest.name.trim(),
          version: manifest.version,
          description: (manifest.description ?? '').trim(),
          author_name: (manifest.author ?? '').trim(),
          repository: manifest.repository ?? '',
          license: manifest.license ?? '',
          min_app_version: manifest.minAppVersion ?? '',
          permissions: manifest.permissions ?? [],
          allowed_domains: manifest.allowedDomains ?? [],
          manifest_url: manifestUrl,
          main_url: mainUrl,
        }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Submission failed. Please try again.');
      setSubmitted(true);
      setManifest(null);
      setManifestInput('');
      await loadMine();
    } catch (e) {
      setFatal(`Could not submit: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }, [user, manifest, errors, manifestUrl, mainUrl, loadMine]);

  const handleWithdraw = useCallback(async (id: string) => {
    await supabase.from('extension_submissions').delete().eq('id', id);
    await loadMine();
  }, [loadMine]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Submit an Extension</h1>
      <p className="text-text-muted text-sm mb-8 max-w-xl">
        Built something for MixBridge? Paste a link to your extension's <code>plugin.json</code> on
        GitHub and we'll validate it instantly. Approved extensions appear in the app's store and
        on the <a href="/extensions" className="text-accent hover:underline">extensions page</a>.
      </p>

      {/* Step 1: paste + validate */}
      <div className="rounded-xl p-6 mb-6" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}>
        <label htmlFor="manifest-url" className="block text-sm font-medium mb-2">
          Link to your plugin.json
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="manifest-url"
            type="url"
            value={manifestInput}
            onChange={(e) => setManifestInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && manifestInput.trim()) void handleCheck(); }}
            placeholder="https://github.com/you/your-extension/blob/main/plugin.json"
            className="flex-1 px-3 py-2.5 rounded-lg text-sm min-w-0"
            style={inputStyle}
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => void handleCheck()}
            disabled={checking || !manifestInput.trim()}
            className="btn-accent text-sm px-5 shrink-0"
          >
            {checking ? 'Checking…' : 'Check'}
          </button>
        </div>
        <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
          Requirements: public GitHub repo · OSI license · honest permissions ·{' '}
          <code>main.js</code> next to <code>plugin.json</code>. Start from the{' '}
          <a
            href="https://github.com/brazsound/mixbridge/tree/main/examples/plugins"
            target="_blank" rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            example extensions
          </a>.
        </p>

        {fatal && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
            {fatal}
          </div>
        )}

        {/* Validation results + preview */}
        {manifest && (
          <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
            {errors.length > 0 ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3" role="alert">
                <p className="text-sm font-medium text-amber-100 mb-1.5">Fix these before submitting:</p>
                <ul className="space-y-1">
                  {errors.map((err) => (
                    <li key={err} className="text-[13px] text-amber-100/90 flex gap-2">
                      <span aria-hidden>·</span>{err}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium mb-3" style={{ color: '#34d399' }}>
                  ✓ Looks good — here's your store listing:
                </p>
                <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[15px]">{manifest.name}</span>
                    <span className="text-xs text-text-muted">v{manifest.version}</span>
                    {manifest.author && <span className="text-xs text-text-muted">by {manifest.author}</span>}
                  </div>
                  <p className="text-text-muted text-sm leading-relaxed mt-1">{manifest.description}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    {(manifest.permissions ?? []).map((perm) => (
                      <span key={perm} className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--accent-subtle)', border: '1px solid rgba(123,92,255,0.2)', color: 'var(--accent)' }}>
                        {perm}
                      </span>
                    ))}
                    {(manifest.permissions ?? []).includes('network') && (
                      <span className="text-[11px] text-text-muted">→ {(manifest.allowedDomains ?? []).join(', ')}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="btn-accent text-sm mt-4"
                >
                  {submitting ? 'Submitting…' : 'Submit for review'}
                </button>
              </>
            )}
          </div>
        )}

        {submitted && (
          <div className="mt-4 rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}>
            Submitted! A confirmation is on its way to your inbox. We review manifest honesty and
            code transparency — you'll see the status below, and your extension goes live in the
            store once approved.
          </div>
        )}
      </div>

      {/* My submissions */}
      {mine.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-widest text-text-muted">Your submissions</h2>
          <div className="space-y-2">
            {mine.map((s) => (
              <div key={s.id} className="rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}>
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-text-muted">v{s.version}</span>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    color: s.status === 'approved' ? '#34d399' : s.status === 'rejected' ? '#f87171' : '#fbbf24',
                    border: `1px solid ${s.status === 'approved' ? 'rgba(52,211,153,0.4)' : s.status === 'rejected' ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.4)'}`,
                  }}
                >
                  {s.status === 'approved' ? 'Approved' : s.status === 'rejected' ? 'Rejected' : 'In review'}
                </span>
                {s.status === 'rejected' && s.review_note && (
                  <span className="text-xs text-text-muted w-full sm:w-auto">— {s.review_note}</span>
                )}
                {s.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => void handleWithdraw(s.id)}
                    className="ml-auto text-[12px] text-text-muted hover:text-text transition-colors underline underline-offset-2"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
