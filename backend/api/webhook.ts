import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const paddleApiKey = process.env.PADDLE_API_KEY;
const paddleBaseUrl = process.env.PADDLE_SANDBOX === 'true'
  ? 'https://sandbox-api.paddle.com'
  : 'https://api.paddle.com';

export const config = {
  runtime: 'edge',
};

interface PaddleSubscriptionItem {
  price?: { product_id?: string };
}

interface PaddleSubscriptionData {
  id: string;
  status: string;
  customer_id: string;
  items?: PaddleSubscriptionItem[];
}

interface PaddleNotification {
  event_type: string;
  data: PaddleSubscriptionData;
}

interface PaddleCustomerResponse {
  data?: { email?: string };
}

async function getCustomerEmail(customerId: string): Promise<string> {
  if (!paddleApiKey) return '';
  try {
    const res = await fetch(`${paddleBaseUrl}/customers/${customerId}`, {
      headers: {
        Authorization: `Bearer ${paddleApiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return '';
    const json = (await res.json()) as PaddleCustomerResponse;
    return json?.data?.email ?? '';
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody) as PaddleNotification;

    const eventType = payload.event_type;
    const data = payload.data;

    if (!data?.id || !data?.customer_id) {
      return new Response('Bad payload', { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase env vars');
      return new Response('Server error', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (eventType === 'subscription.created' || eventType === 'subscription.updated') {
      const email = await getCustomerEmail(data.customer_id);

      // Map product_id to tier (Solo=1, Pro=3, Team=10 activations)
      const productSolo = process.env.PADDLE_PRODUCT_SOLO;
      const productPro = process.env.PADDLE_PRODUCT_PRO;
      const productTeam = process.env.PADDLE_PRODUCT_TEAM;

      let tier = 'solo';
      const productId = data.items?.[0]?.price?.product_id;
      if (productId) {
        if (productTeam && productId === productTeam) tier = 'team';
        else if (productPro && productId === productPro) tier = 'pro';
        else if (productSolo && productId === productSolo) tier = 'solo';
      }

      const { error } = await supabase.from('paddle_subscriptions').upsert(
        {
          subscription_id: data.id,
          customer_id: data.customer_id,
          email: email || `customer_${data.customer_id}`,
          status: data.status,
          tier,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'subscription_id' }
      );

      if (error) {
        console.error('Webhook upsert error:', error);
        return new Response('DB error', { status: 500 });
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Error', { status: 500 });
  }
}
