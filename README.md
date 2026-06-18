# Top Seed

**Top Seed** helps a badminton open-play organizer run tonight’s session from a phone or tablet: check players in, fill courts, suggest fair doubles matches, record results, track who paid, and review history and leaderboards — even when the internet drops.

MVP v1 is **organizer-only** (no player login, no payment gateway). The app is **local-first**: live session work saves in the browser first and syncs to the server when connectivity is available.

---

## What you can try today

| Area | What it does |
|------|----------------|
| **Sessions** | Create an open-play session, set fee and court count, complete when done |
| **Live dashboard** | Check in players, manage courts and queue lanes, start matches, record results |
| **Payments** | Mark paid, partial, waived, refunded; see session totals |
| **Match history** | Browse finished matches; correct results on live sessions |
| **Leaderboard** | Club-wide or per-session stats (wins, losses, draws, win %) |
| **Players** | Full check-in, queue, and profile editing via the player drawer |

Specs and product boundaries live in [`docs/specs/`](docs/specs/) and [`AGENTS.md`](AGENTS.md).

---

## Prerequisites

Install these once on your machine:

| Tool | Version |
|------|---------|
| [Node.js](https://nodejs.org/) | 20 LTS or newer |
| [pnpm](https://pnpm.io/) | 9 or newer |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Optional — only needed for the API database |

Check versions:

```bash
node -v    # should print v20.x or higher
pnpm -v    # should print 9.x or higher
```

---

## Local setup

### 1. Clone and install

```bash
git clone <repository-url>
cd Top-Seed
pnpm install
cp .env.example .env
```

The `.env` file points the web app at `http://localhost:3001` and the API at a local PostgreSQL database. Defaults work for local development; you usually do not need to edit it.

### 2. Choose how to run

#### Option A — Full stack (recommended)

Best for demos that include server sync. Starts the web app, API, and expects PostgreSQL.

```bash
# Terminal 1 — start PostgreSQL
docker compose up -d

# One-time database setup
pnpm --filter @top-seed/api db:push
pnpm --filter @top-seed/api db:seed

# Terminal 2 — start web + API together
pnpm dev
```

| Service | URL |
|---------|-----|
| **Organizer app** | [http://localhost:5173](http://localhost:5173) |
| **API health check** | [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health) |

On the Sessions page you should see **API healthy**. If the API is down, the app still runs in local-first mode and shows a warning banner.

#### Option B — Web app only (quickest look)

Useful when you only want the organizer UI without Docker or PostgreSQL.

```bash
pnpm --filter @top-seed/web dev
```

Open [http://localhost:5173](http://localhost:5173). Session data is stored in the browser (IndexedDB). The API warning banner is expected; core session workflows still work offline.

---

## Run a session (walkthrough)

Use a tablet-sized browser window if you can — the dashboard is designed for that first.

1. **Open the app** at [http://localhost:5173](http://localhost:5173).
2. **Sessions** → **New session** — name, venue, fee, court count, queue mode.
3. **Open dashboard** — you land on the live pegboard: players, courts, and queue.
4. **Check in players** — search existing profiles or add a walk-in.
5. **Queue matches** — use suggestions or build a doubles match manually, then assign to an open court.
6. **Start and complete matches** — tap a court, record win/loss/draw/unscored/cancel.
7. **Payments** — header link or **More** tab on mobile; mark players paid as cash comes in.
8. **History & leaderboard** — review results; correct a live match if needed.
9. **Complete session** — ends live editing; payments and history become read-only.

**Tip:** If you have exactly one active session, visiting `/` redirects straight to its dashboard.

### Dev shortcut (developers only)

In development mode, [http://localhost:5173/organizer/sessions/dev-harness](http://localhost:5173/organizer/sessions/dev-harness) seeds a sample session and players for quick offline testing.

---

## How local-first behaves

- **Data lives in the browser** during a session (IndexedDB via Dexie). Refreshing the page keeps your work.
- **Mutations queue locally** when the API is unreachable; they sync when the server is back.
- **No login in MVP v1** — anyone with the URL can use the organizer UI on that device.
- **Payments are manual tracking** — “Mark paid” records cash or other off-app payment; there is no card processing.

To reset local data, clear site data for `localhost:5173` in your browser settings.

---

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| `pnpm: command not found` | Install pnpm: `npm install -g pnpm` |
| API unreachable banner | Start `pnpm dev` (or `pnpm --filter @top-seed/api dev`) and ensure Docker Postgres is running |
| Database connection errors | `docker compose up -d`, then `pnpm --filter @top-seed/api db:push` |
| Port already in use | Stop other apps on 5173 (web) or 3001 (API), or change `API_PORT` in `.env` |
| Blank page after pull | `pnpm install` then `pnpm --filter @top-seed/contracts build` |
| Stale or confusing local data | Clear browser storage for localhost, then create a fresh session |

---

## Project layout (for developers)

```text
apps/
  web/          Vite + React organizer app (primary UI)
  api/          Fastify API + Prisma (PostgreSQL)
packages/
  contracts/    Shared API and sync schemas (Zod)
  domain/       Pure business rules (queueing, ratings, payments)
```

---

## Commands reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Web (5173) + API (3001) |
| `pnpm --filter @top-seed/web dev` | Web app only |
| `pnpm build` | Production build for all packages |
| `pnpm test` | Run tests across the monorepo |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Regenerate Prisma client |

**API integration tests** (optional, requires Postgres):

```bash
RUN_DB_TESTS=1 pnpm --filter @top-seed/api test
```

---

## Out of scope for MVP v1

- Player self-service (check-in, “my next match”, player accounts)
- Login, roles, and multi-organizer permissions
- Online payment processing
- Native mobile apps and venue booking

These are intentional boundaries while the organizer live-session experience is proven.
