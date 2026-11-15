# ARES PATH — Frontend

Frontend application for the ARES PATH research prototype. The current screen
keeps the existing console shell while consuming the real FastAPI contracts.

## Stack

- Next.js App Router
- React + TypeScript in strict mode
- Tailwind CSS
- pnpm
- OpenLayers, Zod, Lucide React and Recharts
- Vitest, React Testing Library and Playwright

## Development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Useful checks:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
pnpm test:e2e
```

Copy `.env.example` to `.env.local` and set the FastAPI URL when the backend
is available. Do not commit `.env.local` or credentials.

## Backend integration

Run FastAPI from `backend/`:

```bash
source .venv/Scripts/activate
python -m uvicorn app.main:app --reload
```

Then run this app from `frontend/`:

```bash
pnpm dev
```

The frontend loads health, system info, regions, raster metadata, native raster
tile descriptors and scientific-target entries. The map renders the backend's
display-only PNG tile matrix (`local_native_xyz`) instead of synthetic contour
lines; routes remain an SVG overlay using the backend's `grid_row_col` contract.
Mission setup sends one validated `POST /api/missions/plan` request and renders
the returned routes, comparison, elevation profile, sources and limitations.
The raw GeoTIFF endpoint remains available for downloads/analysis and is not
used as a numeric source in the browser.

## Structure

- `src/app/`: Next.js technical entry points and metadata.
- `src/components/`: generic shared UI layers; no product components yet.
- `src/features/`: domain features for the Mars map, mission planning, route
  analysis and scientific targets.
- `src/shared/`: API, configuration, hooks, libraries, types and utilities.
- `src/test/`: test setup, fixtures and mocks.
- `e2e/`: browser tests.
- `public/`: approved public assets only.

See `.context/FRONT_AGENTS.MD` for the current frontend contracts and scope.
