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
`VITE_USE_MOCKS=false`.

Auth modes:

- **auto (default)** - mock session when `VITE_USE_MOCKS=true`, otherwise uses
  `VITE_DEV_USER_ID` / `VITE_DEV_ORG_ID` when present, else shows the login
  screen and uses the auth API.
- **dev_headers** - bypasses login and sends `x-user-id`,
  `x-organization-id`, and optional `x-membership-role` on each request.
- **api** - stores access and refresh tokens in local storage, refreshes the
  session automatically, and gates the GAP shell on organization membership.

Endpoints currently wired live:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/logout`
- `GET /api/v1/organizations`
- `GET /api/v1/farm-sites`
- `GET /api/v1/plots`
- `GET /api/v1/crop-cycles`
- `GET /api/v1/gap-records`
- `GET /api/v1/evidence`
- `POST /api/v1/documents`
- `GET /api/v1/documents/:id`
- `POST /api/v1/documents/:id/finalize`
- `POST /api/v1/evidence`

Live mode now reads checklist rows from GAP records and uploads evidence via
the real document flow: create document, upload blob to the presigned URL,
finalize, wait for document readiness, then submit evidence against the
selected GAP record.

Per-record review threads with comments and persisted checklist status updates
are still follow-up work; those interactions remain local so the UI stays
usable end-to-end.

## Related repos

- API: `smartfarm-api`
- Docs: `smartfarm-docs`
- Infra: `smartfarm-infra`

