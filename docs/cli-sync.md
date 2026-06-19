# CLI Sync Workflow

This repo now carries its own Vercel and Supabase CLI setup so local work, GitHub, Vercel, and Supabase can stay aligned without depending on global machine state.

## Installed CLIs

- `git`
- `gh`
- local `vercel` via `node_modules`
- local `supabase` via `node_modules`

## Why local wrappers exist

The Codex environment blocks writes to some default home/cache locations. These wrapper scripts keep CLI state inside the repo and out of Git:

- `scripts/vercel-cli.sh`
- `scripts/supabase-cli.sh`

Ignored local tooling state:

- `.vercel-cli/`
- `.tooling-home/`
- `.tooling-cache/`

## Main commands

Run a full tooling check:

```bash
npm run cli:doctor
```

Vercel:

```bash
npm run vercel:whoami
npm run vercel:env:list
npm run vercel:env:pull
npm run vercel:pull
npm run vercel:deploy:prod
```

Supabase:

```bash
npm run supabase:version
npm run supabase:login
npm run supabase:link
npm run supabase:projects
npm run supabase:db:push
```

GitHub:

```bash
npm run github:auth
npm run github:repo
```

## Current linkage

- GitHub remote: `https://github.com/rahulka915/rka-os.git`
- Vercel project: `personal-os`
- Vercel project id: `prj_AYI5Qd8AeaKDf46bPRMNIXT6ajVb`
- Supabase project ref: `iypkcadrxjwmvlkwhwku`

## Recommended daily flow

1. Pull latest GitHub changes:

```bash
git pull origin main
```

2. Pull Vercel development env vars:

```bash
npm run vercel:pull
```

or, if you only want the Development env vars refreshed:

```bash
npm run vercel:env:pull
```

3. Run app locally:

```bash
npm run dev
```

4. If schema changed, push Supabase migrations:

```bash
npm run supabase:db:push
```

5. Build before release:

```bash
npm run build
```

6. Commit and push:

```bash
git add -A
git commit -m "..."
git push origin main
```

7. If needed, trigger a production deploy explicitly:

```bash
npm run vercel:deploy:prod
```

## Notes

- `npm run vercel:pull` pulls project settings and environment metadata from Vercel.
- `npm run vercel:env:pull` refreshes `.env.local` from Vercel Development env vars.
- `npm run supabase:link` may prompt for the remote database password the first time.
- `npm run supabase:login` may require a Supabase personal access token if the CLI is not already authenticated.
