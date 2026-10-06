# Elbi GradeSim web app

The web app at [gradesim.uplb.tools](https://gradesim.uplb.tools): a UPLB GWA calculator, Latin honors simulator and course planner that runs entirely in the browser. It is the companion to the [GradeSim browser extension](https://github.com/uplbtools/gradesim), which reads grades from AMIS.

Built with SvelteKit (Svelte 5, TypeScript) and prerendered to static files. Grades are kept in the browser's local storage under the `gradesim:v1` key and never sent anywhere.

## Getting started

```bash
npm install
npm run dev
```

## Checks

```bash
npm run check      # svelte-check
npm run lint       # eslint
npm test           # vitest: scheduler, curriculum, GWA, importers, planner, xlsx
npm run build      # static site in build/
npm run test:e2e   # Playwright against the built site
```

## Layout

- `src/routes/+page.svelte` is the app (Grades, What if, Planner, Wrapped). `about`, `install`, `curricula`, `privacy` and `terms` are the pages around it.
- `src/lib/*.ts` holds the logic ported from the extension as pure functions: `scheduler.ts`, `curriculum.ts`, `catalog.ts`, `grades.ts`, `planner.ts`, `requirements.ts`, `xlsx.ts`, `wrapped.ts`, and `importers.ts` for backups, plan files and manual entry.
- `src/lib/data/*.json` is generated from the extension's `curriculum.js` and `catalog.js` by `node scripts/sync-extension-data.mjs <path to extension/src>`. Fix curriculum data in the extension repo, then run it.
- `src/lib/bridge.ts` asks an installed extension for its grades (externally_connectable on Chromium browsers, a window message answered by a content script on Firefox).
- `src/service-worker/` precaches the build so the app works offline.

## Deployment

Vercel builds `main` (`vercel.json` sets the static output in `build/`).
