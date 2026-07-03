# GradeSim Website Agent Guide

**Human developers:** start with [README.md](README.md).

Org-wide agent defaults: see [room-tba/AGENTS.md](https://github.com/uplbtools/room-tba/blob/main/AGENTS.md). This file tailors that playbook to **gradesim-website**.

## Doc map

| When | Read |
| --- | --- |
| Local dev | [README.md](README.md) |
| Extension source (separate repo) | [uplbtools/gradesim](https://github.com/uplbtools/gradesim) |
| PR hygiene | [.github/pull_request_template.md](.github/pull_request_template.md) |
| Release | [.github/workflows/release.yml](.github/workflows/release.yml), `.releaserc.json` |

## Stack

- **Framework:** Next.js 16 (App Router), React 19
- **Language:** JavaScript (JSX) — not TypeScript
- **Package manager:** npm (`package-lock.json`)
- **Deploy:** Vercel — auto-deploy on push to **`main`**
- **Release:** semantic-release on `main` (tags + GitHub Release)

## Branches and deploy

| Branch | Role |
| --- | --- |
| **`staging`** | Default branch on GitHub — integration / draft work |
| **`main`** | Production — Vercel deploy + semantic-release |

**Ship flow:**

1. Feature branch → PR to **`staging`** (integration)
2. Release PR **`staging` → `main`** → production deploy + release tag

When the user says **"ship"**, they mean land on **`main`** / production, not stop at `staging`.

## Verify before done

| Step | When |
| --- | --- |
| `npm run build` | Before commit/PR on substantive changes |
| `npm run dev` | UI/page changes |
| PR title check | CI validates conventional title on PRs to `main` |

CI (`.github/workflows/ci.yml`) runs `npm run build` on push to `main`. No unit test suite yet — manual browser check for layout changes.

## Architecture (short)

```
app/
  page.jsx           # Landing
  curricula/         # Curriculum browser
  layout.js
  globals.css
public/              # Browser logos, curriculum images
```

This repo is **marketing/docs only** — the MV3 extension lives in [gradesim](https://github.com/uplbtools/gradesim).

## UI guardrails

- Keep pages fast and readable on mobile (320px)
- Store install links must match published extension IDs in gradesim README
- No decorative animations

## Commits

- Conventional Commits required for semantic-release on `main`: `feat:`, `fix:`, `docs:`, `chore:`
- Update README when changing deploy behavior or store URLs

## Security

- No AMIS credentials or user grade data on this site — extension is 100% local
- Do not commit Vercel tokens or `.env.local`
