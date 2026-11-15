# ARES PATH

ARES PATH is a research prototype for explainable Mars terrain-route planning
for the NASA Space Apps “Interplanetary Survival Guide: Martian Map” challenge.
It is not operational EVA navigation, a safety system, or a mission-certified
recommendation engine.

## What is currently verifiable

- A FastAPI backend loads four HiRISE Jezero windows and four broad CTX Jezero
  regions (`jezero_ctx_northwest_20m`, `northeast`, `southwest` and
  `southeast`). Every CTX region has a 20 m elevation GeoTIFF plus an aligned
  orthoimage, and every HiRISE window has its associated RED orthoimage.
- The backend serves metadata, raster bytes, display previews, local raster
  tiles, terrain profiles, and shortest/terrain-aware A* route comparisons.
- The Next.js frontend lets the user choose among the available Jezero regions.
  The computational ROI can be moved and resized, but map selection and route
  processing stay inside the active raster's bounds. It renders NASA Mars Trek
  CTX/HiRISE WMTS descriptors, local raster overlays, typed route responses and
  provenance.
- A browser-side Offline Mission Pack stores the mission response, elevation
  profile and a compact local preview in IndexedDB, supports JSON
  import/export, and reopens without FastAPI. Source GeoTIFF bytes and remote
  NASA WMTS remain explicitly online-only; no new route is calculated offline.

## Repository map

```text
backend/       FastAPI, geospatial data services, terrain and routing tests
frontend/      Next.js App Router, OpenLayers UI, PWA shell and browser tests
docs/          API, methodology, provenance, validation and competition audit
.context/      Team contracts and frontend/backend operating instructions
```

## Run locally

Use two terminals from the repository root.

### Backend (PowerShell)

```powershell
Set-Location .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000/docs`.

### Frontend

```powershell
Set-Location .\frontend
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`.

If PowerShell commands are being run from Git Bash, use the shell-equivalent
commands instead; `Test-Path`, `Get-ChildItem` and `.\venv\Scripts\...` are
PowerShell syntax.

## Verification commands

From `backend/`:

```powershell
python -m pytest -q
```

In the audited Windows sandbox, the default pytest temp directory is not
writable. The reproducible local workaround is:

```powershell
New-Item -ItemType Directory -Path tmp -Force | Out-Null
$env:TEMP = (Resolve-Path tmp).Path
$env:TMP = $env:TEMP
.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
```

From `frontend/`:

```powershell
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
pnpm test:e2e
```

`pnpm test:e2e` starts the backend automatically when
`backend/.venv/Scripts/python.exe` exists. Set `ARES_BACKEND_COMMAND` to use a
different backend start command.

## Scope and data policy

The processed TIFFs are intentionally versioned in this checkout because the
real-data demo and tests depend on them. Raw source downloads, virtual
environments, credentials and temporary artifacts remain ignored. See
`docs/science/DATA_PROVENANCE.md` and `docs/audit/PROJECT_STATUS.md` for the
evidence and known limitations.
