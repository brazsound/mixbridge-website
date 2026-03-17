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
      device_id_to_deactivate?: string;
    };
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    const subscriptionId = typeof body?.subscription_id === 'string' ? body.subscription_id.trim() : null;
    const deviceId = typeof body?.device_id === 'string' ? body.device_id.trim() : null;
    const deviceIdToDeactivate = typeof body?.device_id_to_deactivate === 'string' ? body.device_id_to_deactivate.trim() : null;

    // When deactivating another device, we need caller's device_id for verification
    const targetDeviceId = deviceIdToDeactivate ?? deviceId;

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: 'device_id (caller) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email && !subscriptionId) {
      return new Response(
        JSON.stringify({ error: 'email or subscription_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetDeviceId) {
      return new Response(
        JSON.stringify({ error: 'device_id_to_deactivate or device_id is required' }),
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

    // Free access (NFR): delete from free_access_activations
    const { data: freeAccess } = await supabase
      .from('free_access_emails')
      .select('email')
      .ilike('email', email)
      .maybeSingle();

    if (freeAccess) {
      // When deactivating another device, verify caller is activated
      if (deviceIdToDeactivate && deviceIdToDeactivate !== deviceId) {
        const { data: caller } = await supabase
          .from('free_access_activations')
          .select('id')
          .eq('email', freeAccess.email)
          .eq('device_id', deviceId)
          .maybeSingle();

        if (!caller) {
          return new Response(
            JSON.stringify({ error: 'This device is not activated' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const { error } = await supabase
        .from('free_access_activations')
        .delete()
        .eq('email', freeAccess.email)
        .eq('device_id', targetDeviceId);

      if (error) {
        console.error('NFR deactivate error:', error);
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

    // Get subscription for this email (or use subscription_id if provided)
    let subId: string;
    if (subscriptionId) {
      const { data: subById } = await supabase
        .from('paddle_subscriptions')
        .select('subscription_id')
        .eq('subscription_id', subscriptionId)
        .in('status', ['trialing', 'active', 'past_due'])
        .maybeSingle();
      if (!subById) {
        return new Response(
          JSON.stringify({ error: 'Subscription not found' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      subId = subById.subscription_id;
    } else if (email) {
      const { data: sub } = await supabase
        .from('paddle_subscriptions')
        .select('subscription_id')
        .eq('email', email)
        .in('status', ['trialing', 'active', 'past_due'])
        .limit(1)
        .maybeSingle();
      if (!sub) {
        return new Response(
          JSON.stringify({ error: 'No active subscription found' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      subId = sub.subscription_id;
    } else {
      return new Response(
        JSON.stringify({ error: 'email or subscription_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // When deactivating another device, verify caller is activated
    if (deviceIdToDeactivate && deviceIdToDeactivate !== deviceId) {
      const { data: caller } = await supabase
        .from('subscription_activations')
        .select('id')
        .eq('subscription_id', subId)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (!caller) {
        return new Response(
          JSON.stringify({ error: 'This device is not activated' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { error } = await supabase
      .from('subscription_activations')
      .delete()
      .eq('subscription_id', subId)
      .eq('device_id', targetDeviceId);

    if (error) {
      console.error('Deactivate error:', error);
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
    console.error('Deactivate error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
