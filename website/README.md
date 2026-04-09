# Mix Bridge Website

Marketing website for Mix Bridge – Pro Tools stem and bounce automation. Includes an account portal for managing license activations (sign in with magic link, view and deactivate devices).

## Local Development

```bash
npm install
cp .env.example .env
# Edit .env with your Supabase URL, anon key, and license API URL
npm run dev
```

Runs at `http://localhost:5174`.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL (same project as license backend) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (safe to expose) |
| `VITE_LICENSE_API_URL` | Backend API URL (e.g. `https://your-backend.vercel.app`) |

For the account portal to work, enable Email auth in Supabase Dashboard → Authentication → Providers, and add your site URL to Redirect URLs (e.g. `http://localhost:5174/account` for dev).

## Build

```bash
npm run build
```

Output in `dist/`.

## Deploy

Build the site and deploy the `dist` folder:

- **Vercel** – Connect repo, set root to `website`, build command: `npm run build`, output: `dist`
- **Netlify** – Same: build command `npm run build`, publish directory `dist`
- **GitHub Pages** – Build locally, push `dist` to `gh-pages` or use GitHub Actions

Once deployed, share the URL (e.g. `https://mixbridge.app`) with users.
