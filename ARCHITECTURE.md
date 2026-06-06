# Mix Bridge — Full System Architecture

> **For AI agents and developers.** This document describes exactly how every piece of the Mix Bridge system talks to every other piece — no assumptions, no gaps.

---

## 1. The Four Moving Parts

```
┌─────────────────────────────┐      ┌──────────────────────────────────┐
│  STEM APP (Desktop)          │      │  Mixbridge Website               │
│  Electron + React (Vite)     │      │  React 18 + Vite + TailwindCSS   │
│  macOS only                  │      │  mixbridge.net                   │
│  /APP CODING/STEM APP/       │      │  /APP CODING/Mixbridge Website/  │
└──────────┬──────────────────┘      └──────────────┬───────────────────┘
           │  HTTP (fetch)                           │  HTTP (fetch) + Supabase JS
           │  to License API                         │  to License API + Supabase
           ▼                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  License Backend API                                                  │
│  Vercel Edge Functions (TypeScript)                                   │
│  /APP CODING/STEM APP/backend/                                        │
│  Deployed URL: https://mix-bridge-license.vercel.app (or custom)      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  Supabase Service Role Key
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Supabase (single shared project)                                     │
│  PostgreSQL + Auth + Storage                                          │
│  Used by: Desktop App (via API), Website (directly + via API)         │
└─────────────────────────────────────────────────────────────────────┘
```

**Key rule:** The Desktop App **never** talks to Supabase directly. It only calls the License Backend API. The Website talks to both Supabase (for auth) and the License API (for license/device data).

---

## 2. Repository Layout

```
APP CODING/
├── STEM APP/                      ← Desktop app + backend
│   ├── main/                      ← Electron main process (Node.js)
│   │   ├── index.ts               ← All IPC handlers, license logic, PTSL bridge
│   │   ├── preload.ts             ← Exposes IPC to renderer via contextBridge
│   │   ├── ptsl-client.ts         ← PTSL gRPC/socket wrapper for Pro Tools
│   │   ├── ptsl-commands.ts       ← PTSL command IDs and type definitions
│   │   ├── updater.ts             ← electron-updater auto-update logic
│   │   └── logger.ts              ← Support log writer
│   ├── src-renderer/              ← Electron renderer (React UI, Vite)
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── components/        ← UI components
│   │       ├── contexts/          ← React contexts (license, session, etc.)
│   │       ├── hooks/             ← Custom hooks
│   │       ├── utils/             ← Helpers
│   │       └── sessionIntel/      ← Session scan cache logic
│   ├── backend/                   ← Vercel Edge API (deployed separately)
│   │   ├── api/
│   │   │   ├── activate.ts        ← POST /api/activate         (Desktop App)
│   │   │   ├── validate.ts        ← POST /api/validate         (Desktop App)
│   │   │   ├── deactivate.ts      ← POST /api/deactivate       (Desktop App)
│   │   │   ├── list-activations.ts← POST /api/list-activations (Desktop App)
│   │   │   ├── trial-start.ts     ← POST /api/trial-start      (Desktop App)
│   │   │   ├── releases.ts        ← GET  /api/releases         (Website + App)
│   │   │   ├── bug-report.ts      ← POST /api/bug-report       (Desktop App)
│   │   │   ├── set-display-name.ts← POST /api/set-display-name (Desktop App)
│   │   │   ├── ping-supabase.ts   ← GET  /api/ping-supabase    (Vercel Cron)
│   │   │   ├── webhook.ts         ← POST /api/webhook          (Paddle)
│   │   │   ├── web/
│   │   │   │   ├── list-activations.ts ← POST /api/web/list-activations (Website)
│   │   │   │   ├── deactivate.ts       ← POST /api/web/deactivate       (Website)
│   │   │   │   ├── feedback.ts         ← POST /api/web/feedback         (Website)
│   │   │   │   └── delete-account.ts   ← POST /api/web/delete-account   (Website)
│   │   │   └── admin/             ← Admin-only endpoints (require ADMIN_EMAILS JWT)
│   │   │       ├── accounts.ts    ← GET  /api/admin/accounts
│   │   │       ├── audit-log.ts   ← GET  /api/admin/audit-log
│   │   │       ├── bug-reports.ts ← GET  /api/admin/bug-reports
│   │   │       ├── email.ts       ← POST /api/admin/email
│   │   │       ├── license-actions.ts
│   │   │       ├── nfr.ts         ← NFR (free access) management
│   │   │       ├── releases.ts    ← Release management
│   │   │       ├── stats.ts       ← Dashboard stats
│   │   │       └── user-actions.ts
│   │   ├── lib/
│   │   │   └── admin.ts           ← Shared: CORS headers, getAdminEmail(), logAction()
│   │   ├── vercel.json            ← Cron: /api/ping-supabase runs daily at noon UTC
│   │   └── package.json
│   └── supabase/                  ← (if present) local Supabase config/migrations
│
└── Mixbridge Website/             ← Marketing + account portal
    ├── src/
    │   ├── App.tsx                ← Routes: / (marketing), /account (portal), /admin, /privacy, /terms
    │   ├── contexts/
    │   │   └── AuthContext.tsx    ← Supabase auth state + all auth methods
    │   ├── lib/
    │   │   ├── supabase.ts        ← Supabase client (anon key)
    │   │   └── fetchWithRetry.ts  ← fetch() with retry logic
    │   ├── components/            ← Marketing sections (Hero, Pricing, FAQ, etc.)
    │   │   └── AccountLayout.tsx  ← Sidebar layout for /account/* pages
    │   └── pages/
    │       ├── AccountPage.tsx    ← Auth gate (sign in / sign up)
    │       ├── AccountDashboard.tsx ← License summary, key, RTO progress
    │       ├── AccountDownload.tsx  ← Download links from /api/releases
    │       ├── AccountFeedback.tsx  ← POST /api/web/feedback
    │       ├── DevicesPage.tsx      ← Lists + deactivates devices
    │       ├── AccountSettings.tsx  ← Profile, email, password, beta opt-in, delete account
    │       ├── AdminPage.tsx        ← Admin UI (gated by VITE_ADMIN_EMAILS)
    │       ├── PrivacyPage.tsx
    │       └── TermsPage.tsx
    ├── .env.example               ← Required env vars
    └── ARCHITECTURE.md            ← This document
```

---

## 3. Environment Variables

### Desktop App (`STEM APP/.env`)
| Variable | Used in | Purpose |
|---|---|---|
| `LICENSE_API_URL` | `main/index.ts` | Backend API base URL (e.g. `https://mix-bridge-license.vercel.app`) |
| `PADDLE_CHECKOUT_URL` | `main/index.ts` | Opens browser to Paddle checkout when user clicks Buy |

### Backend API (`STEM APP/backend/` — Vercel env)
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** service role key — bypasses RLS |
| `PADDLE_API_KEY` | Paddle API key (for fetching customer email on webhook) |
| `PADDLE_WEBHOOK_SECRET` | HMAC secret to verify Paddle webhook signatures |
| `PADDLE_PRODUCT_V1` | Paddle product ID → license version 1 |
| `PADDLE_RTO_PRODUCT_ID` | Paddle product ID for rent-to-own plan |
| `PADDLE_RTO_PRICE_ID` | Paddle price ID for rent-to-own (checked first) |
| `PADDLE_SANDBOX` | `"true"` to use sandbox API |
| `RTO_INSTALLMENT_COUNT` | Number of installments to complete rent-to-own (default: 12) |
| `ADMIN_EMAILS` | Comma-separated admin email list |
| `SITE_URL` | Used in invite emails: redirect to `{SITE_URL}/account` |

### Website (`Mixbridge Website/.env`)
| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose) |
| `VITE_LICENSE_API_URL` | Backend API base URL |
| `VITE_ADMIN_EMAILS` | Comma-separated admin emails (shows Admin nav link) |

---

## 4. Supabase Database Tables

All API calls use the **service role key** — RLS is effectively bypassed at the API layer. The API itself enforces all authorization logic in TypeScript.

### `paddle_purchases`
Stores every completed Paddle transaction (one-time purchase or rent-to-own plan).

| Column | Type | Notes |
|---|---|---|
| `transaction_id` | text PK | Paddle transaction ID (or `rto_{subscription_id}` anchor for RTO) |
| `customer_id` | text | Paddle customer ID |
| `email` | text | Buyer email (lowercased) |
| `license_key` | text | Generated `XXXX-XXXX-XXXX` key |
| `license_version` | int | Maps from Paddle product ID (currently always 1) |
| `status` | text | `active`, `refunded`, `suspended` |
| `purchase_type` | text | `full` or `rent_to_own` |
| `activation_limit` | int | Nullable — if null, defaults to `ACTIVATION_LIMIT` (3) |
| `paddle_subscription_id` | text | Null for one-time purchases; set for RTO |
| `rto_installments_paid` | int | Incremented per `transaction.completed` webhook for RTO |
| `rto_installments_total` | int | Total installments needed (from `RTO_INSTALLMENT_COUNT`) |
| `rto_completed_at` | timestamptz | Set when `paid >= total`; `purchase_type` also flips to `full` |
| `updated_at` | timestamptz | |
| `created_at` | timestamptz | |

### `purchase_activations`
One row per activated device per purchase.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `transaction_id` | text FK → `paddle_purchases` | |
| `device_id` | text | UUID generated on first run, stored in local license file |
| `display_name` | text | User-set device name (nullable) |
| `activated_at` | timestamptz | Updated on re-activation |

### `free_access_emails` (NFR — Not For Resale)
Allowlist for complimentary/press/internal licenses.

| Column | Type | Notes |
|---|---|---|
| `email` | text PK | Case-insensitive match via `ilike` |
| `license_key` | text | Optional — if set, user must provide it at activation |
| `activation_limit` | int | Nullable — if null, defaults to 3 |
| `default_display_name` | text | Pre-filled name shown on activation |

### `free_access_activations`
One row per activated device per NFR email.

| Column | Type | Notes |
|---|---|---|
| `email` | text FK → `free_access_emails` | |
| `device_id` | text | |
| `display_name` | text | Nullable |
| `activated_at` | timestamptz | |

### `license_trials`
One row per trial started (trial is per-email, not per-device).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | text unique | |
| `started_at` | timestamptz | |
| `ends_at` | timestamptz | `started_at + 7 days` |

### `trial_devices`
One row per device registered on a trial (max 3).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `trial_id` | uuid FK → `license_trials` | |
| `device_id` | text | |
| `display_name` | text | Nullable |
| `activated_at` | timestamptz | |

### `releases`
Published app versions surfaced by `/api/releases`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `version` | text | semver string |
| `released_at` | timestamptz | |
| `download_url` | text | Direct download link |
| `changelog` | text | Markdown or plain text |
| `is_prerelease` | bool | If true, only shown to users with `beta_opt_in: true` in user_metadata |
| `is_published` | bool | Only published rows are returned |

### `admin_audit_log`
Immutable log of all admin actions.

| Column | Type |
|---|---|
| `id` | uuid PK |
| `admin_email` | text |
| `action` | text |
| `target_email` | text nullable |
| `details` | jsonb nullable |
| `created_at` | timestamptz |

### `paddle_rto_transaction_log`
Deduplication guard for RTO installment webhooks.

| Column | Type | Notes |
|---|---|---|
| `paddle_transaction_id` | text PK | Unique constraint prevents double-counting |
| `anchor_transaction_id` | text | The `rto_{subscription_id}` anchor |

### Supabase Auth (`auth.users`)
The website uses Supabase Auth directly. Relevant `user_metadata` fields:

| Field | Set by | Purpose |
|---|---|---|
| `full_name` | Website (signup / profile update) | Display name |
| `avatar_url` | Website (settings) | URL in `avatars` storage bucket |
| `needs_password_setup` | Backend (`trial-start`) | Triggers `SetPasswordModal` on first website login |
| `beta_opt_in` | Website (settings) | If true, sees pre-release builds in downloads |

---

## 5. License Types & Status Values

| Status | What it means | Who can have it |
|---|---|---|
| `active` | Paid, valid one-time purchase (or RTO completed) | Paid users |
| `free` | NFR / complimentary access from allowlist | Press, team, devs |
| `trialing` | 7-day trial, within `ends_at` | Anyone (email required) |
| `suspended` | RTO subscription paused/canceled before completion | RTO users |
| `refunded` | Paddle issued a refund | Paid users |
| `null` | Never activated or deactivated | Unlicensed |

**Device limits (default 3):** Configurable per-purchase via `activation_limit` in `paddle_purchases` or `free_access_emails`. Overridden at the row level.

---

## 6. License Flow — Desktop App

### 6a. First Launch (No License)
```
App starts → main/index.ts reads mix-bridge-license.json from userData
No transactionId, no email → hasAccess: false → renderer shows license screen
```

### 6b. Start Trial
```
User enters email in renderer
renderer → IPC: license:startTrial(email)
main/index.ts → POST /api/trial-start { email, device_id }
  Backend checks: not already paid, not already NFR
  If new: INSERT license_trials, INSERT trial_devices
  If existing + not expired: INSERT trial_devices (if new device)
  Backend calls supabase.auth.admin.inviteUserByEmail(email, { redirectTo: SITE_URL/account })
    → sets user_metadata.needs_password_setup = true
    → Supabase sends invite email with magic link to mixbridge.net/account
  Returns: { ok, status:'trialing', ends_at, activation_used, activation_limit,
             website_invite_sent, website_account_existed }
main/index.ts → saves to mix-bridge-license.json:
  { status:'trialing', email, deviceId, trialEndsAt, lastValidatedAt, ... }
→ renderer: hasAccess: true
```

### 6c. Activate Paid License
```
User enters email + license key in renderer
renderer → IPC: license:activateWithEmail(email, licenseKey)
main/index.ts → POST /api/activate { email, device_id, license_key }
  Backend:
    1. Check free_access_emails (NFR) first
       - If found and key matches: upsert free_access_activations, return { status:'free', access:true }
    2. Check paddle_purchases by email + license_key + status='active'
       - If already activated on this device: update activated_at, return counts
       - If activation_limit reached: return 403
       - Else: INSERT purchase_activations, return { transaction_id, status, license_version, ... }
main/index.ts → saves to mix-bridge-license.json (transactionId for paid, or email+status:'free' for NFR)
→ renderer: hasAccess: true
```

### 6d. Periodic Validation (every hour / on app focus)
```
renderer → IPC: license:validate(force?)
main/index.ts:
  Reads local license file
  If within 1-hour cache AND not forced → return cached result
  Trial path: POST /api/validate { email, device_id }
    → checks license_trials + trial_devices, returns { valid, status, trial_ends_at }
  Free path: POST /api/validate { email, device_id }
    → checks free_access_emails + free_access_activations, returns { valid, status }
  Paid path: POST /api/validate { transaction_id, device_id }
    → checks paddle_purchases + purchase_activations, returns { valid, status, license_version }
  Offline grace: if network fails, allow up to 5 days from lastValidatedAt
  Updates mix-bridge-license.json with fresh data
```

### 6e. Deactivate This Device
```
renderer → IPC: license:deactivate()
main/index.ts → POST /api/deactivate { email OR transaction_id, device_id }
  Backend deletes row from purchase_activations or free_access_activations or trial_devices
main/index.ts → clears license file (keeps deviceId)
```

---

## 7. License Flow — Website

The website uses a **different auth path** to the same license data. It authenticates via Supabase JWT and calls `/api/web/*` endpoints that resolve the user's email from the token.

### 7a. User Signs In to Website
```
User goes to mixbridge.net/account
AccountAuthGate shows sign-in form
Options:
  1. Magic link: supabase.auth.signInWithOtp(email, { emailRedirectTo: '/account' })
     → Supabase sends email → user clicks link → redirected to /account with session
  2. Password: supabase.auth.signInWithPassword(email, password)
  3. Sign up: supabase.auth.signUp(email, password, { emailRedirectTo: '/account' })

AuthContext.onAuthStateChange fires:
  event=PASSWORD_RECOVERY → show ResetPasswordModal
  user.metadata.needs_password_setup=true → show SetPasswordModal
  else → proceed to account dashboard
```

### 7b. View Devices (Website)
```
DevicesPage mounts
→ POST /api/web/list-activations
  Headers: { Authorization: Bearer <session.access_token> }
  Backend: verifies JWT via supabase.auth.getUser(token) → extracts email
  Checks free_access_emails → if NFR: query free_access_activations
  Else: find paddle_purchases by email → query purchase_activations
  Returns: { activations[], status, activation_used, activation_limit, license_key, purchase_type, rto_* }
DevicesPage renders list with Deactivate buttons
```

### 7c. Deactivate Device (Website)
```
User clicks Deactivate on a device
→ POST /api/web/deactivate { device_id }
  Headers: { Authorization: Bearer <session.access_token> }
  Backend: verifies JWT → gets email → finds purchase → deletes activation row
```

### 7d. Delete Account (Website)
```
User confirms account deletion in AccountSettings
AuthContext.deleteAccount() →
  → POST /api/web/delete-account
    Headers: { Authorization: Bearer <session.access_token> }
    Backend: verifies JWT → deletes all activations for this user's email
             → supabase.auth.admin.deleteUser(userId)
  On success: supabase.auth.signOut()
```

---

## 8. Paddle Payment Flow

```
User clicks Buy in Desktop App
→ IPC: license:openCheckout()
→ main/index.ts opens PADDLE_CHECKOUT_URL in system browser

User completes Paddle checkout
Paddle sends webhook → POST /api/webhook
  Webhook verifies HMAC-SHA256 signature via PADDLE_WEBHOOK_SECRET

event_type = 'transaction.completed':
  If subscriptionId exists AND product matches PADDLE_RTO_PRODUCT_ID/PRICE_ID:
    → RTO installment path:
      Deduplicate via paddle_rto_transaction_log (unique on paddle_transaction_id)
      If first installment: INSERT paddle_purchases { status:'active', purchase_type:'rent_to_own', rto_installments_paid:1 }
      Else: UPDATE rto_installments_paid += 1
        If paid >= total: set purchase_type='full', rto_completed_at=now
  Else (one-time purchase):
    Fetch customer email from Paddle API (/customers/{customerId})
    UPSERT paddle_purchases { status:'active', purchase_type:'full', license_key: generated XXXX-XXXX-XXXX }

event_type = 'transaction.updated' (refund):
  UPDATE paddle_purchases SET status='refunded'

event_type = 'subscription.updated' / 'subscription.canceled':
  If status is bad (paused/past_due/canceled): UPDATE status='suspended'
  If status is 'active': UPDATE status='active'
```

---

## 9. API Endpoint Reference

### App-facing (Desktop → Backend, no auth required — trust model is email+deviceId+licenseKey)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/trial-start` | `{ email, device_id }` | `{ ok, status, ends_at, activation_used, activation_limit, website_invite_sent }` |
| POST | `/api/activate` | `{ email, device_id, license_key }` | `{ status, transaction_id, activation_used, activation_limit }` |
| POST | `/api/validate` | `{ transaction_id?, email?, device_id? }` | `{ valid, status, activation_used, activation_limit, display_name, trial_ends_at, rto_* }` |
| POST | `/api/deactivate` | `{ email? OR transaction_id, device_id, device_id_to_deactivate? }` | `{ ok }` |
| POST | `/api/list-activations` | `{ email? OR transaction_id, device_id }` | `{ activations[], activation_used, activation_limit }` |
| POST | `/api/set-display-name` | `{ email? OR transaction_id, device_id, display_name }` | `{ ok }` |
| POST | `/api/bug-report` | `{ description, log }` | `{ ok }` |
| GET | `/api/releases` | Headers: `Authorization: Bearer <token>?` | `{ releases[], beta_opt_in }` |
| GET | `/api/ping-supabase` | — | `{ ok }` (Vercel cron keepalive) |
| POST | `/api/webhook` | Paddle event (raw body) | `200 OK` |

### Web-facing (Website → Backend, require Supabase JWT in Authorization header)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/web/list-activations` | `{}` | `{ activations[], status, activation_used, activation_limit, license_key, purchase_type, rto_* }` |
| POST | `/api/web/deactivate` | `{ device_id }` | `{ ok }` |
| POST | `/api/web/feedback` | `{ message, ... }` | `{ ok }` |
| POST | `/api/web/delete-account` | `{}` | `{ ok }` |

### Admin-facing (require admin JWT — email must be in `ADMIN_EMAILS` env var)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/accounts` | List all users with license info |
| GET | `/api/admin/stats` | Dashboard stats |
| GET | `/api/admin/audit-log` | View audit log |
| GET | `/api/admin/bug-reports` | View submitted bug reports |
| POST/PATCH | `/api/admin/license-actions` | Grant, revoke, modify licenses |
| POST | `/api/admin/nfr` | Add/remove NFR (free access) entries |
| POST | `/api/admin/email` | Send transactional emails |
| POST | `/api/admin/releases` | Publish new app release |
| POST | `/api/admin/user-actions` | Force-delete user, reset, etc. |

---

## 10. Authentication — Two Separate Systems

### Desktop App Auth
There is **no Supabase auth** in the desktop app. Authentication is:
- **Email** (stored locally) + **device_id** (persisted in userData) + **license key** (entered by user)
- The backend trusts this triple — no JWT involved
- License state is cached in `~/Library/Application Support/Mix Bridge/mix-bridge-license.json`

### Website Auth (Supabase)
Full Supabase authentication with:
- **Magic link** (OTP email → click → redirected to `/account`)
- **Email + password** (standard)
- **Invite link** (backend creates user via `auth.admin.inviteUserByEmail()` when trial starts)
- Password reset via `supabase.auth.resetPasswordForEmail()`
- The `session.access_token` (JWT) is sent as `Authorization: Bearer` to `/api/web/*` endpoints

**Connection between the two:** When a trial starts in the desktop app, the backend automatically creates a Supabase Auth account for that email (invite flow), so the user can immediately access the website portal.

---

## 11. Local Data Persistence (Desktop App)

All files live in `app.getPath('userData')` (macOS: `~/Library/Application Support/Mix Bridge/`):

| File | Purpose |
|---|---|
| `mix-bridge-license.json` | License state: email, transactionId, deviceId, status, caches |
| `mix-bridge-window-bounds.json` | Last window position/size |
| `mix-bridge-session-batch.json` | Saved session batch queue (atomic write with .bak) |
| `mix-bridge-app-state.json` | UI state: selected session, sidebar widths |
| `mix-bridge-session-scan-cache.json` | Per-session cached scan results (tracks, mixes, memory locations) |
| `mix-bridge-presets.json` | 5 preset slots (atomic write with .bak) |
| `notifications-config.json` | iMessage phone number, macOS notification settings |
| `mix-bridge-support.log` | Rolling support log (exported for bug reports) |

---

## 12. Electron IPC Channels (Main ↔ Renderer)

All channels use `ipcMain.handle` / `ipcRenderer.invoke` (promise-based, context-isolated).

### License
| Channel | Direction | Description |
|---|---|---|
| `license:getState` | R→M | Read local license (no network) |
| `license:validate` | R→M | Validate with backend (cached 1hr, 5-day offline grace) |
| `license:startTrial` | R→M | Start 7-day trial, invite to website |
| `license:activateWithEmail` | R→M | Activate paid or NFR license |
| `license:deactivate` | R→M | Remove this device |
| `license:deactivateDevice` | R→M | Remove another device by ID |
| `license:listActivations` | R→M | List all activated devices |
| `license:setUserName` | R→M | Set display name locally + on server |
| `license:getDeviceId` | R→M | Get this device's ID |
| `license:openCheckout` | R→M | Open Paddle checkout in browser |
| `license:clear` | R→M | Clear license state (sign out) |

### Pro Tools / PTSL
| Channel | Direction | Description |
|---|---|---|
| `ptsl:connect` | R→M | Connect to Pro Tools via PTSL socket |
| `ptsl:disconnect` | R→M | Disconnect |
| `ptsl:send` | R→M | Send raw PTSL command |
| `ptsl:getTrackList` | R→M | Get all tracks |
| `ptsl:getTimelineSelection` | R→M | Get selected range (samples) |
| `ptsl:getMemoryLocations` | R→M | Get all memory locations |
| `ptsl:exportMix` | R→M | Trigger export mix (long-running) |
| `ptsl:bounceTrack` | R→M | Trigger track bounce (long-running) |
| `ptsl:importAudioBack` | R→M | Import bounced files back into session |
| `ptsl:openSession` | R→M | Open a .ptx file |
| `ptsl:closeSession` | R→M | Close current session |
| `ptsl:saveSessionAs` | R→M | Save session copy |
| `ptsl:openSessionDialog` | R→M | Native file picker for .ptx |
| `ptsl:checkFilesExist` | R→M | Check which output files already exist |
| `ptsl:getSessionPath` | R→M | Get current session file path |
| `ptsl:getSessionSampleRate` | R→M | Get session sample rate |
| `ptsl:getSessionBitDepth` | R→M | Get session bit depth |

### App / System
| Channel | Direction | Description |
|---|---|---|
| `app:pickFolder` | R→M | Native folder picker dialog |
| `app:ensureFolder` | R→M | Create folder (restricted to home + userData) |
| `app:showItemInFolder` | R→M | Reveal file in Finder |
| `app:getAppVersion` | R→M | Returns `app.getVersion()` |
| `app:sendBounceCompleteNotification` | R→M | Send iMessage via AppleScript |
| `app:showBounceCompleteNativeNotification` | R→M | macOS Notification Center |
| `window:setAlwaysOnTop` | R→M | Pin window on top |
| `window:titleBarDoubleClick` | R→M | Zoom/minimize per macOS preference |
| `updater:checkForUpdates` | R→M | Check for new release |
| `updater:startDownload` | R→M | Download update |
| `updater:skipUpdate` | R→M | Skip a version |
| `updater:quitAndInstall` | R→M | Install and relaunch |
| `appLog:log` | R→M | Write to support log |
| `appLog:logError` | R→M | Log error + trigger error report prompt |
| `appLog:export` | R→M | Export support log to file |
| `appLog:submitReport` | R→M | POST bug report to `/api/bug-report` |
| `appLog:errorOccurred` | M→R | Main notifies renderer of reportable error |

### State Persistence
| Channel | Description |
|---|---|
| `appState:load` / `appState:save` | Selected session, sidebar widths |
| `sessionBatch:load` / `sessionBatch:save` | Batch queue |
| `sessionBatch:pickSessions` | Multi-file picker for .ptx |
| `sessionBatch:hasBackup` / `sessionBatch:loadBackup` | Backup recovery |
| `sessionScanCache:load` / `sessionScanCache:save` | Scan result cache |
| `presets:load` / `presets:save` | 5-slot preset storage |
| `presets:export` / `presets:import` | Preset file I/O |
| `notifications:load` / `notifications:save` | iMessage + macOS notification config |

---

## 13. PTSL — Pro Tools Integration

The desktop app communicates with Pro Tools via **PTSL** (Pro Tools SDK local socket API). The main process (`main/ptsl-client.ts`) maintains a persistent connection.

```
Renderer (React) → IPC → Main Process → PTSLClientWrapper → PTSL Socket → Pro Tools
```

Key characteristics:
- Connection is one-per-app (singleton `ptsl` instance in `main/index.ts`)
- Long-running commands (export, bounce) use extended timeout (`LONG_RUNNING_PTLS_COMMAND_TIMEOUT_MS`)
- All PTSL commands are defined as `CommandId` enum in `main/ptsl-commands.ts`
- Session scan cache (`sessionScanCache`) persists expensive scan results across PTSL connections

---

## 14. Auto-Update Flow

```
App starts → updater.ts sets up electron-updater
Renderer can call updater:checkForUpdates(isManual)
  → electron-updater checks GitHub Releases (or configured update server)
  → If update found: sends events to renderer (available, downloading, ready)
Renderer shows update banner/prompt
User accepts → updater:startDownload() → updater:quitAndInstall()

Manual check: File menu → Check for Updates
```

---

## 15. Critical Invariants for AI Agents

1. **Never add direct Supabase calls to the Desktop App.** All DB access goes through the License API.

2. **`/api/*` endpoints (non-web) use no JWT.** They are secured by the combination of email + device_id + license_key. Do not add auth header requirements there.

3. **`/api/web/*` endpoints always require `Authorization: Bearer <supabase_jwt>`.** Extract email via `supabase.auth.getUser(token)` using the service role client. Do not trust email in the request body.

4. **`/api/admin/*` endpoints require the caller's email to be in `process.env.ADMIN_EMAILS`.** Use `getAdminEmail(request)` from `lib/admin.ts`.

5. **The `SUPABASE_SERVICE_ROLE_KEY` is only in the backend.** Never expose it to the renderer or website. The website only uses `VITE_SUPABASE_ANON_KEY`.

6. **License state in the desktop app is the single source of truth for `hasAccess`.** The renderer reads it via `license:getState` or `license:validate`. It is persisted to disk. Do not store license state in React state only.

7. **`paddle_rto_transaction_log` is a deduplication guard.** Its unique constraint on `paddle_transaction_id` prevents double-counting installments. If an insert gets a `23505` error, it is a duplicate and should be silently skipped.

8. **Trial creates a website account automatically.** When `trial-start` runs, it calls `supabase.auth.admin.inviteUserByEmail()`. This is the mechanism that links a desktop trial user to a website account. The website invite sets `needs_password_setup: true` in user metadata.

9. **`needs_password_setup: true` in Supabase user_metadata triggers `SetPasswordModal` on the website.** Once the user sets a password, the flag is cleared via `supabase.auth.updateUser({ data: { needs_password_setup: false } })`.

10. **Offline grace period is 5 days.** If the license server is unreachable, `license:validate` returns `hasAccess: true` for up to 5 days from `lastValidatedAt`. After that, access is denied until connectivity is restored.

11. **Vercel cron (`/api/ping-supabase`) runs daily at 12:00 UTC** to keep Supabase connections warm on the free tier. Defined in `backend/vercel.json`.

12. **`beta_opt_in` in Supabase user_metadata controls pre-release visibility.** The `/api/releases` endpoint accepts an optional Bearer token; if present and the user has `beta_opt_in: true`, pre-releases are included in the response.
