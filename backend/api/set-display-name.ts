import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
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
    const body = await request.json() as {
      email?: string;
      subscription_id?: string;
      device_id?: string;
      display_name?: string;
    };
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    const subscriptionId = typeof body?.subscription_id === 'string' ? body.subscription_id.trim() : null;
    const deviceId = typeof body?.device_id === 'string' ? body.device_id.trim() : null;
    const displayName = typeof body?.display_name === 'string' ? body.display_name.trim() || null : null;

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: 'device_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email && !subscriptionId) {
      return new Response(
        JSON.stringify({ error: 'email or subscription_id is required' }),
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

    // NFR: update free_access_activations
    if (email && !subscriptionId) {
      const { data: freeAccess } = await supabase
        .from('free_access_emails')
        .select('email')
        .ilike('email', email)
        .maybeSingle();

      if (!freeAccess) {
        return new Response(
          JSON.stringify({ error: 'Email not in allowlist' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: activation, error: updateError } = await supabase
        .from('free_access_activations')
        .update({ display_name: displayName })
        .eq('email', freeAccess.email)
        .eq('device_id', deviceId)
        .select('id')
        .maybeSingle();

      if (updateError || !activation) {
        return new Response(
          JSON.stringify({ error: 'Activation not found or update failed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Set default_display_name whenever user sets a name (so it's used for new activations)
      if (displayName) {
        const { error: defaultError } = await supabase
          .from('free_access_emails')
          .update({ default_display_name: displayName })
          .eq('email', freeAccess.email);

        if (defaultError) {
          console.error('Set default_display_name error:', defaultError);
        }
      }

      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Paid: update subscription_activations
    const { data: sub } = await supabase
      .from('paddle_subscriptions')
      .select('subscription_id, default_display_name')
      .eq('subscription_id', subscriptionId)
      .single();

    if (!sub) {
      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: activation, error: updateError } = await supabase
      .from('subscription_activations')
      .update({ display_name: displayName })
      .eq('subscription_id', subscriptionId)
      .eq('device_id', deviceId)
      .select('id')
      .maybeSingle();

    if (updateError || !activation) {
      return new Response(
        JSON.stringify({ error: 'Activation not found or update failed' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: firstPaidActivation } = await supabase
      .from('subscription_activations')
      .select('device_id')
      .eq('subscription_id', subscriptionId)
      .order('activated_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const isFirstPaidActivation = firstPaidActivation?.device_id === deviceId;
    const shouldUpdatePaidDefault = displayName && (sub.default_display_name == null || isFirstPaidActivation);

    if (shouldUpdatePaidDefault) {
      await supabase
        .from('paddle_subscriptions')
        .update({ default_display_name: displayName })
        .eq('subscription_id', subscriptionId);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Set display name error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
