# ARES PATH — Frontend

Frontend foundation for the ARES PATH research prototype. The visual identity,
layout and product screens are intentionally not defined yet.

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
