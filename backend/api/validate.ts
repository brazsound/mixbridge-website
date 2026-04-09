import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;

const ACTIVATION_LIMITS: Record<string, number> = {
  solo: 1,
  pro: 3,
  team: 10,
};
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const config = {
  runtime: 'edge',
};

export async function POST(request: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json() as { subscription_id?: string; email?: string; device_id?: string };
    const subscriptionId = typeof body?.subscription_id === 'string' ? body.subscription_id.trim() : null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    const deviceId = typeof body?.device_id === 'string' ? body.device_id.trim() : null;

    if (!subscriptionId && !email) {
      return new Response(
        JSON.stringify({ error: 'subscription_id or email is required' }),
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

    // NFR (free access): validate by email (case-insensitive)
    if (email && !subscriptionId) {
      const { data: freeAccess } = await supabase
        .from('free_access_emails')
        .select('email, activation_limit, default_display_name')
        .ilike('email', email)
        .maybeSingle();

      if (!freeAccess) {
        return new Response(
          JSON.stringify({ valid: false, status: null, tier: null, activation_used: null, activation_limit: null, display_name: null, default_display_name: null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nfrLimit = typeof freeAccess.activation_limit === 'number' && freeAccess.activation_limit > 0
        ? freeAccess.activation_limit
        : 3;

      const { count } = await supabase
        .from('free_access_activations')
        .select('*', { count: 'exact', head: true })
        .eq('email', freeAccess.email);

      let displayName: string | null = null;
      let deviceIsActivated = false;
      if (deviceId) {
        const { data: activation } = await supabase
          .from('free_access_activations')
          .select('display_name')
          .eq('email', freeAccess.email)
          .eq('device_id', deviceId)
          .maybeSingle();
        displayName = activation?.display_name ?? null;
        deviceIsActivated = !!activation;
      }

      // Device must be in activations to be valid (prevents use after remote deactivation)
      const valid = deviceId ? deviceIsActivated : true;

      return new Response(
        JSON.stringify({
          valid,
          status: 'free',
          tier: null,
          activation_used: count ?? 0,
          activation_limit: nfrLimit,
          display_name: displayName,
          default_display_name: freeAccess.default_display_name ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('paddle_subscriptions')
      .select('status, tier, activation_limit, default_display_name')
      .eq('subscription_id', subscriptionId)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ valid: false, status: null, tier: null, activation_used: null, activation_limit: null, display_name: null, default_display_name: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subscriptionValid = ['trialing', 'active', 'past_due'].includes(data.status);
    const tier = data.tier ?? 'solo';
    const activationLimit = typeof data.activation_limit === 'number' && data.activation_limit > 0
      ? data.activation_limit
      : (ACTIVATION_LIMITS[tier] ?? 1);

    const { count } = await supabase
      .from('subscription_activations')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_id', subscriptionId);

    const activationUsed = count ?? 0;

    let displayName: string | null = null;
    let deviceIsActivated = false;
    if (deviceId) {
      const { data: activation } = await supabase
        .from('subscription_activations')
        .select('display_name')
        .eq('subscription_id', subscriptionId)
        .eq('device_id', deviceId)
        .maybeSingle();
      displayName = activation?.display_name ?? null;
      deviceIsActivated = !!activation;
    }

    // Device must be in activations to be valid (prevents use after remote deactivation)
    const valid = subscriptionValid && (deviceId ? deviceIsActivated : true);

    return new Response(
      JSON.stringify({
        valid,
        status: data.status,
        tier,
        activation_used: activationUsed,
        activation_limit: activationLimit,
        display_name: displayName,
        default_display_name: data.default_display_name ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Validate error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
