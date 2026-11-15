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

The frontend loads health, system info, terrain coverage metadata, raster
assets, NASA Mars Trek WMTS descriptors and scientific-target entries. The
region selector exposes the validated Jezero HiRISE windows and four broad CTX
regions. Mission routes, waypoints, scientific targets and the computational
ROI are vector overlays transformed from the backend's `grid_row_col` contract.
The ROI can be activated from the lateral mission panel, moved from its center
or resized from its corners; its `analysis_window` is sent to FastAPI and the
backend performs the calculation only inside that window. The map interaction
and backend validation keep the ROI inside the selected parent raster, and
coordinates remain relative to that regional dataset.
through the local Mars equirectangular metadata. The raw GeoTIFF endpoint is
not used as a numeric source in the browser.

Mission responses can be saved as an Offline Mission Pack in IndexedDB and
reviewed when the API is unavailable. The installable PWA caches its shell,
same-origin runtime assets, successful GET responses and Mars Trek tiles that
the user has already visited. A saved pack embeds the mission response,
elevation profile and a compact local raster preview, so it can be exported as
JSON, imported on another browser and reopened without FastAPI. The source
GeoTIFF and remote NASA WMTS remain explicitly `online_only`; the app never
claims that a display preview is a numeric DTM or that a new route can be
calculated offline.

For a real installation/offline check, use a production build from localhost
or HTTPS:

```bash
pnpm build
pnpm start
```

When the browser exposes `beforeinstallprompt`, the `Install app` action opens
the native install prompt. Browsers that do not expose that event use their
standard address-bar/menu installation action; the Offline Mission Pack
import/export controls remain available in either case.

## Structure

- `src/app/`: Next.js technical entry points and metadata.
- `src/components/`: generic shared UI layers; no product components yet.
- `src/features/`: domain features for the Mars map, mission planning, route
  analysis and scientific targets.
- `src/shared/`: API, configuration, hooks, libraries, types and utilities.
- `src/test/`: test setup, fixtures and mocks.
- `e2e/`: browser tests; Playwright can start the local backend automatically
  when its project virtual environment is present.
- `public/`: approved public assets only.

See `.context/FRONT_AGENTS.MD` for the current frontend contracts and scope.
