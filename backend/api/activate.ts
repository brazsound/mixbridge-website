import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ACTIVATION_LIMITS: Record<string, number> = {
  solo: 1,
  pro: 3,
  team: 10,
};

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
    const body = await request.json() as { email?: string; device_id?: string };
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    const deviceId = typeof body?.device_id === 'string' ? body.device_id.trim() : null;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: 'Device ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Check free access allowlist first (NFR: default 3, overridable per email)
    const { data: freeAccess } = await supabase
      .from('free_access_emails')
      .select('email, activation_limit')
      .ilike('email', email)
      .maybeSingle();

    if (freeAccess) {
      const nfrLimit = typeof freeAccess.activation_limit === 'number' && freeAccess.activation_limit > 0
        ? freeAccess.activation_limit
        : 3;
      const { data: existingActivation } = await supabase
        .from('free_access_activations')
        .select('id')
        .eq('email', freeAccess.email)
        .eq('device_id', deviceId)
        .single();

      if (existingActivation) {
        await supabase
          .from('free_access_activations')
          .update({ activated_at: new Date().toISOString() })
          .eq('email', freeAccess.email)
          .eq('device_id', deviceId);
        const { count } = await supabase
          .from('free_access_activations')
          .select('*', { count: 'exact', head: true })
          .eq('email', freeAccess.email);
        return new Response(
          JSON.stringify({
            status: 'free',
            access: true,
            activation_used: count ?? 1,
            activation_limit: nfrLimit,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { count } = await supabase
        .from('free_access_activations')
        .select('*', { count: 'exact', head: true })
        .eq('email', freeAccess.email);

      if ((count ?? 0) >= nfrLimit) {
        return new Response(
          JSON.stringify({
            error: `NFR activation limit reached (${nfrLimit} devices). Deactivate a device in Settings to free a slot.`,
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: insertError } = await supabase
        .from('free_access_activations')
        .insert({ email: freeAccess.email, device_id: deviceId });

      if (insertError) {
        console.error('NFR activation insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to record activation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { count: newCount } = await supabase
        .from('free_access_activations')
        .select('*', { count: 'exact', head: true })
        .eq('email', freeAccess.email);

      return new Response(
        JSON.stringify({
          status: 'free',
          access: true,
          activation_used: newCount ?? 1,
          activation_limit: nfrLimit,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Look up Paddle subscription by email
    const { data: sub, error: subError } = await supabase
      .from('paddle_subscriptions')
      .select('subscription_id, status, tier, activation_limit')
      .eq('email', email)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error('Supabase error:', subError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sub) {
      return new Response(
        JSON.stringify({ error: 'No active subscription or free access found for this email' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tier = sub.tier ?? 'solo';
    const limit = typeof sub.activation_limit === 'number' && sub.activation_limit > 0
      ? sub.activation_limit
      : (ACTIVATION_LIMITS[tier] ?? 1);

    // 3. Check if this device is already activated for this subscription
    const { data: existingActivation } = await supabase
      .from('subscription_activations')
      .select('id')
      .eq('subscription_id', sub.subscription_id)
      .eq('device_id', deviceId)
      .single();

    if (existingActivation) {
      // Re-activation on same device: update timestamp
      await supabase
        .from('subscription_activations')
        .update({ activated_at: new Date().toISOString() })
        .eq('subscription_id', sub.subscription_id)
        .eq('device_id', deviceId);
      const { count: usedCount } = await supabase
        .from('subscription_activations')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_id', sub.subscription_id);
      return new Response(
        JSON.stringify({ subscription_id: sub.subscription_id, status: sub.status, tier, activation_used: usedCount ?? 1, activation_limit: limit }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Count current activations
    const { count, error: countError } = await supabase
      .from('subscription_activations')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_id', sub.subscription_id);

    if (countError || (count ?? 0) >= limit) {
      return new Response(
        JSON.stringify({
          error: `Activation limit reached (${limit} device${limit === 1 ? '' : 's'} for ${tier}). Deactivate a device in Settings to free a slot.`,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Record new activation
    const { error: insertError } = await supabase
      .from('subscription_activations')
      .insert({
        subscription_id: sub.subscription_id,
        device_id: deviceId,
      });

    if (insertError) {
      console.error('Activation insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record activation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { count: newCount } = await supabase
      .from('subscription_activations')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_id', sub.subscription_id);

    return new Response(
      JSON.stringify({ subscription_id: sub.subscription_id, status: sub.status, tier, activation_used: newCount ?? 1, activation_limit: limit }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Activate error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
