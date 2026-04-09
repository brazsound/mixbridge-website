import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const config = {
  runtime: 'edge',
};

interface Activation {
  device_id: string;
  display_name: string | null;
  activated_at: string;
}

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

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check free access first
    const { data: freeAccess } = await supabase
      .from('free_access_emails')
      .select('email')
      .ilike('email', email)
      .maybeSingle();

    if (freeAccess) {
      const { data: faRow } = await supabase
        .from('free_access_emails')
        .select('activation_limit')
        .eq('email', freeAccess.email)
        .single();
      const nfrLimit =
        typeof faRow?.activation_limit === 'number' && faRow.activation_limit > 0
          ? faRow.activation_limit
          : 3;

      const { data: activations, error } = await supabase
        .from('free_access_activations')
        .select('device_id, display_name, activated_at')
        .eq('email', freeAccess.email)
        .order('activated_at', { ascending: true });

      if (error) {
        console.error('Web list-activations NFR error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to list activations' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const list: Activation[] = (activations ?? []).map((a) => ({
        device_id: a.device_id,
        display_name: a.display_name ?? null,
        activated_at: a.activated_at ?? '',
      }));

      return new Response(
        JSON.stringify({
          activations: list,
          status: 'free',
          tier: null,
          activation_used: list.length,
          activation_limit: nfrLimit,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Paid: look up subscription by email
    const { data: sub, error: subError } = await supabase
      .from('paddle_subscriptions')
      .select('subscription_id, status, tier, activation_limit')
      .eq('email', email)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError || !sub) {
      return new Response(
        JSON.stringify({
          activations: [],
          status: null,
          tier: null,
          activation_used: 0,
          activation_limit: 0,
          error: 'No active subscription or free access found for this email.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ACTIVATION_LIMITS: Record<string, number> = {
      solo: 1,
      pro: 3,
      team: 10,
    };
    const tier = sub.tier ?? 'solo';
    const limit =
      typeof sub.activation_limit === 'number' && sub.activation_limit > 0
        ? sub.activation_limit
        : (ACTIVATION_LIMITS[tier] ?? 1);

    const { data: activations, error } = await supabase
      .from('subscription_activations')
      .select('device_id, display_name, activated_at')
      .eq('subscription_id', sub.subscription_id)
      .order('activated_at', { ascending: true });

    if (error) {
      console.error('Web list-activations error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to list activations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const list: Activation[] = (activations ?? []).map((a) => ({
      device_id: a.device_id,
      display_name: a.display_name ?? null,
      activated_at: a.activated_at ?? '',
    }));

    return new Response(
      JSON.stringify({
        activations: list,
        status: sub.status,
        tier,
        activation_used: list.length,
        activation_limit: limit,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Web list-activations error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
