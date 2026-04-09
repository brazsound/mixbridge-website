import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const config = {
  runtime: 'edge',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAdminEmail(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token || !supabaseUrl || !supabaseServiceKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) return null;

  const callerEmail = user.email.trim().toLowerCase();
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(callerEmail) ? callerEmail : null;
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

/** List all NFR users with activation counts */
export async function GET(request: Request) {
  const admin = await getAdminEmail(request);
  if (!admin) return json({ error: 'Forbidden' }, 403);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: rows, error } = await supabase
    .from('free_access_emails')
    .select('email, note, activation_limit, added_at')
    .order('added_at', { ascending: false });

  if (error) {
    console.error('admin/nfr GET error:', error);
    return json({ error: 'Failed to fetch NFR users' }, 500);
  }

  // Get activation counts in one query
  const { data: counts } = await supabase
    .from('free_access_activations')
    .select('email');

  const countByEmail: Record<string, number> = {};
  for (const row of counts ?? []) {
    countByEmail[row.email] = (countByEmail[row.email] ?? 0) + 1;
  }

  const users = (rows ?? []).map((r) => ({
    email: r.email,
    note: r.note ?? '',
    activation_limit: r.activation_limit ?? 3,
    activations_used: countByEmail[r.email] ?? 0,
    added_at: r.added_at,
  }));

  return json({ users });
}

/** Add a new NFR user */
export async function POST(request: Request) {
  const admin = await getAdminEmail(request);
  if (!admin) return json({ error: 'Forbidden' }, 403);

  let body: { email?: string; note?: string; activation_limit?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) return json({ error: 'email is required' }, 400);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabase.from('free_access_emails').insert({
    email,
    note: body.note?.trim() ?? null,
    activation_limit: body.activation_limit ?? 3,
  });

  if (error) {
    if (error.code === '23505') return json({ error: 'Email already exists' }, 409);
    console.error('admin/nfr POST error:', error);
    return json({ error: 'Failed to add NFR user' }, 500);
  }

  return json({ ok: true });
}

/** Update note and/or activation_limit for an existing NFR user */
export async function PATCH(request: Request) {
  const admin = await getAdminEmail(request);
  if (!admin) return json({ error: 'Forbidden' }, 403);

  let body: { email?: string; note?: string; activation_limit?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) return json({ error: 'email is required' }, 400);

  const updates: Record<string, unknown> = {};
  if (body.note !== undefined) updates.note = body.note.trim() || null;
  if (body.activation_limit !== undefined) updates.activation_limit = body.activation_limit;

  if (Object.keys(updates).length === 0) return json({ error: 'Nothing to update' }, 400);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabase
    .from('free_access_emails')
    .update(updates)
    .eq('email', email);

  if (error) {
    console.error('admin/nfr PATCH error:', error);
    return json({ error: 'Failed to update NFR user' }, 500);
  }

  return json({ ok: true });
}

/** Remove an NFR user (cascades to free_access_activations) */
export async function DELETE(request: Request) {
  const admin = await getAdminEmail(request);
  if (!admin) return json({ error: 'Forbidden' }, 403);

  let body: { email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) return json({ error: 'email is required' }, 400);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabase
    .from('free_access_emails')
    .delete()
    .eq('email', email);

  if (error) {
    console.error('admin/nfr DELETE error:', error);
    return json({ error: 'Failed to remove NFR user' }, 500);
  }

  return json({ ok: true });
}
