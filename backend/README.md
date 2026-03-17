# Mix Bridge License Backend

Backend for Paddle subscription validation and email activation (including free access allowlist).

**→ See [SETUP_GUIDE.md](SETUP_GUIDE.md) for step-by-step setup instructions.**

**App configuration:** After deploying, set `LICENSE_API_URL` in the app's `.env` (e.g. `LICENSE_API_URL=https://your-project.vercel.app`) so the app can validate licenses and activate by email.

## Setup

### 1. Database (Supabase)

1. Create a [Supabase](https://supabase.com) project (free tier).
2. Run the SQL migrations in **SQL Editor** (in order):
   - `sql/001_license_tables.sql`
   - `sql/002_tier_activations.sql`

### 2. Environment Variables

Set these in Vercel (or your deployment platform):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (Dashboard → Settings → API) |
| `PADDLE_API_KEY` | Paddle API key (for webhook to fetch customer email) |
| `PADDLE_SANDBOX` | Set to `true` when using Paddle sandbox |
| `PADDLE_PRODUCT_SOLO` | Paddle product ID for Solo tier (1 device) |
| `PADDLE_PRODUCT_PRO` | Paddle product ID for Pro tier (3 devices) |
| `PADDLE_PRODUCT_TEAM` | Paddle product ID for Team tier (10 devices) |

### 3. Deploy to Vercel

```bash
cd backend
npm install
vercel
```

Add the env vars in Vercel Dashboard → Project → Settings → Environment Variables.

### 4. Paddle Webhook

In Paddle Dashboard → Developer Tools → Notifications:
- Add destination: `https://your-vercel-url.vercel.app/api/webhook`
- Subscribe to: `subscription.created`, `subscription.updated`

### 5. Add Free Access

To grant free access to someone:

```sql
INSERT INTO free_access_emails (email, note) VALUES ('friend@example.com', 'beta tester');
```

## API

### POST /api/validate

Body: `{ "subscription_id": "sub_xxx" }`

Returns: `{ "valid": true|false, "status": "active"|"trialing"|... }` — used by the app to verify subscription status.

### POST /api/activate

Body: `{ "email": "user@example.com", "device_id": "xxx" }`

Returns:
- `{ "status": "free", "access": true }` — email is on allowlist
- `{ "subscription_id": "sub_xxx", "status": "active" }` — has Paddle subscription
- `403` — no access
