# smartfarm-web

Frontend application for the SmartFarm GAP platform.

This repository is the user-facing surface for:

- farmer dashboards
- advisor workflows
- GAP checklist and evidence submission
- future advisory, messaging, and recommendation UX

## Phase 1 focus

Phase 1 is GAP-first:

- organization switcher
- farm and plot views
- GAP record entry
- evidence upload UI
- advisor review surfaces

## Stack

- React
- TypeScript
- Vite

## Scripts

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
```

## API integration

The store can run in two modes:

- **Mock mode (default)** — in-memory fixtures from `src/mock-data.ts`.
- **Live API mode** — typed client in `src/api/` talks to `smartfarm-api`.

Switch by copying `.env.example` to `.env.local` and setting
`VITE_USE_MOCKS=false` plus the dev tenant headers
(`VITE_DEV_USER_ID`, `VITE_DEV_ORG_ID`). Real auth lands in a separate child
issue; the dev headers stand in until then.

Endpoints currently wired live:

- `GET /api/v1/organizations`
- `GET /api/v1/farm-sites`
- `GET /api/v1/plots`
- `GET /api/v1/crop-cycles`
- `GET /api/v1/evidence`

GAP records, per-record review threads with comments, and the real evidence
upload client are tracked as follow-up child issues; those flows still use
mock data so the UI stays usable end-to-end.

## Related repos

- API: `smartfarm-api`
- Docs: `smartfarm-docs`
- Infra: `smartfarm-infra`

