import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const config = {
  runtime: 'edge',
};

export interface Activation {
  device_id: string;
  display_name: string | null;
  activated_at: string;
  is_current: boolean;
}

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
    };
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    const subscriptionId = typeof body?.subscription_id === 'string' ? body.subscription_id.trim() : null;
    const deviceId = typeof body?.device_id === 'string' ? body.device_id.trim() : null;

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

    // NFR: list free_access_activations
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

      // Verify caller is activated
      const { data: callerActivation } = await supabase
        .from('free_access_activations')
        .select('id')
        .eq('email', freeAccess.email)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (!callerActivation) {
        return new Response(
          JSON.stringify({ error: 'This device is not activated' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: activations, error } = await supabase
        .from('free_access_activations')
        .select('device_id, display_name, activated_at')
        .eq('email', freeAccess.email)
        .order('activated_at', { ascending: true });

      if (error) {
        console.error('List activations error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to list activations' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const list: Activation[] = (activations ?? []).map((a) => ({
        device_id: a.device_id,
        display_name: a.display_name ?? null,
        activated_at: a.activated_at ?? '',
        is_current: a.device_id === deviceId,
      }));

      return new Response(
        JSON.stringify({ activations: list }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Paid: list subscription_activations
    const { data: sub } = await supabase
      .from('paddle_subscriptions')
      .select('subscription_id')
      .eq('subscription_id', subscriptionId)
      .single();

    if (!sub) {
      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerActivation } = await supabase
      .from('subscription_activations')
      .select('id')
      .eq('subscription_id', subscriptionId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (!callerActivation) {
      return new Response(
        JSON.stringify({ error: 'This device is not activated' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: activations, error } = await supabase
      .from('subscription_activations')
      .select('device_id, display_name, activated_at')
      .eq('subscription_id', subscriptionId)
      .order('activated_at', { ascending: true });

    if (error) {
      console.error('List activations error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to list activations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const list: Activation[] = (activations ?? []).map((a) => ({
      device_id: a.device_id,
      display_name: a.display_name ?? null,
      activated_at: a.activated_at ?? '',
      is_current: a.device_id === deviceId,
    }));

    return new Response(
      JSON.stringify({ activations: list }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('List activations error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
    );
  }
}
