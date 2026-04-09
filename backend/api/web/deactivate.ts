import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const config = {
  runtime: 'edge',
};

async function getEmailFromToken(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  if (!supabaseUrl || !supabaseServiceKey) return null;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) return null;
  return user.email.trim().toLowerCase();
}

export async function POST(request: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const email = await getEmailFromToken(request);
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Sign in with your email to continue.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await request.json()) as { device_id?: string };
    const deviceIdToDeactivate =
      typeof body?.device_id === 'string' ? body.device_id.trim() : null;

    if (!deviceIdToDeactivate) {
      return new Response(
        JSON.stringify({ error: 'device_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Free access (NFR)
    const { data: freeAccess } = await supabase
      .from('free_access_emails')
      .select('email')
      .ilike('email', email)
      .maybeSingle();

    if (freeAccess) {
      const { error } = await supabase
        .from('free_access_activations')
        .delete()
        .eq('email', freeAccess.email)
        .eq('device_id', deviceIdToDeactivate);

      if (error) {
        console.error('Web deactivate NFR error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to deactivate' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Paid: get subscription by email
    const { data: sub } = await supabase
      .from('paddle_subscriptions')
      .select('subscription_id')
      .eq('email', email)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error } = await supabase
      .from('subscription_activations')
      .delete()
      .eq('subscription_id', sub.subscription_id)
      .eq('device_id', deviceIdToDeactivate);

    if (error) {
      console.error('Web deactivate error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to deactivate' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Web deactivate error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
