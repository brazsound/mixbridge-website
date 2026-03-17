# Mix Bridge License Backend – Setup Guide

Follow these steps in order. You’ll need accounts for Supabase, Vercel, and Paddle (all free tiers).

---

## Step 1: Supabase (Database)

### 1.1 Create project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Name it (e.g. `mix-bridge-license`).
4. Set a database password and save it.
5. Choose a region and create the project.

### 1.2 Run migrations

1. In the Supabase dashboard, open **SQL Editor**.
2. Create a new query.
3. Copy the contents of `sql/001_license_tables.sql` and run it.
4. Create another query.
5. Copy the contents of `sql/002_tier_activations.sql` and run it.

### 1.3 Get API credentials

1. Go to **Settings** → **API**.
2. Copy:
   - **Project URL** → you’ll use this as `SUPABASE_URL`
   - **service_role** key (under “Project API keys”) → you’ll use this as `SUPABASE_SERVICE_ROLE_KEY`  
     ⚠️ Keep this secret; it bypasses RLS.

---

## Step 2: Paddle (Payments – optional for testing)

You can skip this until you need real payments. For testing, use the free-access allowlist.

### 2.1 Create account

1. Go to [paddle.com](https://paddle.com) and sign up.
2. Use **Paddle Billing** (not Classic).

### 2.2 Create products (when ready)

1. In the Paddle dashboard, go to **Catalog** → **Products**.
2. Create three products:
   - **Mix Bridge Solo** – 1 device
   - **Mix Bridge Pro** – 3 devices
   - **Mix Bridge Team** – 10 devices
3. For each product, add a price with a 7-day trial.
4. Copy each product ID (e.g. `pro_01h...`) for later.

### 2.3 Get API key

1. Go to **Developer Tools** → **Authentication** → **API keys**.
2. Create an API key and copy it → you’ll use this as `PADDLE_API_KEY`.
3. Use **Sandbox** for testing (no real charges).

---

## Step 3: Vercel (Backend hosting)

### 3.1 Install Vercel CLI

```bash
npm i -g vercel
```

### 3.2 Deploy the backend

```bash
cd backend
npm install
vercel
```

- Log in or sign up when prompted.
- Link to a new project (or existing one).
- Accept the defaults.

### 3.3 Set environment variables

1. Open [vercel.com/dashboard](https://vercel.com/dashboard).
2. Select your project.
3. Go to **Settings** → **Environment Variables**.
4. Add:

| Name | Value | Notes |
|------|-------|-------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | From Supabase Step 1.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | From Supabase Step 1.3 |
| `PADDLE_API_KEY` | (optional for now) | From Paddle Step 2.3 |
| `PADDLE_SANDBOX` | `true` | Use `true` for testing |
| `PADDLE_PRODUCT_SOLO` | `pro_xxx` | When you create Paddle products |
| `PADDLE_PRODUCT_PRO` | `pro_xxx` | When you create Paddle products |
| `PADDLE_PRODUCT_TEAM` | `pro_xxx` | When you create Paddle products |

5. Redeploy so the new variables are applied:

   **Deployments** → latest deployment → **⋯** → **Redeploy**.

### 3.4 Get your backend URL

After deployment, your backend URL will look like:

`https://your-project-name.vercel.app`

---

## Step 4: Paddle webhook (when using Paddle)

1. In Paddle, go to **Developer Tools** → **Notifications**.
2. Add a destination:
   - URL: `https://your-project-name.vercel.app/api/webhook`
   - Events: `subscription.created`, `subscription.updated`
3. Save.

---

## Step 5: Add yourself to the free-access allowlist

1. In Supabase, open **SQL Editor**.
2. Run:

```sql
INSERT INTO free_access_emails (email, note) 
VALUES ('your-email@example.com', 'testing') 
ON CONFLICT (email) DO NOTHING;
```

Replace `your-email@example.com` with your email.

---

## Step 6: Configure the Mix Bridge app

1. In the project root (not `backend`), create a `.env` file:

```
LICENSE_API_URL=https://your-project-name.vercel.app
```

2. Replace `your-project-name.vercel.app` with your actual Vercel URL.

---

## Step 7: Test

1. Run the app: `npm run dev`
2. On the paywall, enter your email and click **Activate**.
3. You should get access (allowlist).

---

## Checklist

- [ ] Supabase project created
- [ ] Migrations 001 and 002 run
- [ ] Supabase URL and service role key copied
- [ ] Backend deployed to Vercel
- [ ] Environment variables set in Vercel
- [ ] Redeployed after adding env vars
- [ ] Your email added to `free_access_emails`
- [ ] `.env` created with `LICENSE_API_URL`
- [ ] App tested with your email

---

## Troubleshooting

**"License server not configured"**  
→ `LICENSE_API_URL` is missing or wrong in `.env`.

**"No active subscription or free access found"**  
→ Your email is not in `free_access_emails`. Run the INSERT again.

**Activate returns 500**  
→ Check Vercel logs (Deployments → your deployment → **Logs**). Often `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is wrong.
