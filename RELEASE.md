# Releasing Mix Bridge

## First-time setup

1. **Create the GitHub repo** (if it doesn't exist):
   - Go to https://github.com/new
   - Name it `mix-bridge` (or update `package.json` and `dev-app-update.yml` if you use a different name)
   - Owner: your GitHub username (update `package.json` build.publish.owner if not `brazsound`)

2. **Add GH_TOKEN secret** (for GitHub Actions to publish):
   - Repo → Settings → Secrets and variables → Actions
   - New repository secret: `GH_TOKEN`
   - Value: a Personal Access Token with `repo` scope (Settings → Developer settings → Personal access tokens)

3. **Initialize git and push** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/mix-bridge.git
   git push -u origin main
   ```

## Publishing a new version

```bash
npm run release 0.2.0 "What changed in this version"
```

This will:
1. Bump `package.json` to 0.2.0
2. Add the release notes to `CHANGELOG.md`
3. Commit, tag as `v0.2.0`, and push

GitHub Actions will then build the app and publish it to the Releases page. Users will get the update when they open the app or click File → Check for Updates.
