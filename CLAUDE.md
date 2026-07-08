# Top Seed — Badminton Organizer App

## Project Overview
Organizer-focused web application for managing badminton sessions: players, courts, match recording, queue/matchup management, leaderboard, and manual payment tracking. No integrated payment gateway.

## Key Docs (load on demand)
- Full requirements: [docs/PRD.md](docs/PRD.md)
- Architecture & data model: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Feature specs: [docs/specs/](docs/specs/)

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Auth**: NextAuth.js (credentials provider for organizer login)
- **State**: React Query (server state) + Zustand (UI state)

## Project Structure
```
src/
  app/           # Next.js App Router pages
  components/    # Shared UI components
  lib/           # Utilities, db client, auth config
  server/        # Server actions and API route handlers
  types/         # Shared TypeScript types
prisma/
  schema.prisma  # Data model (source of truth)
docs/            # Specs and planning
```

## Commands
```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run db:migrate   # Run Prisma migrations
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database with test data
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
```

## Conventions
- **Components**: PascalCase, colocate with page unless shared across 2+ pages
- **Server actions**: `src/server/actions/<feature>.ts`
- **API routes**: `src/app/api/<resource>/route.ts` — REST, return `{ data, error }`
- **DB queries**: go through Prisma client in `src/lib/db.ts`, never raw SQL
- **Types**: derive from Prisma generated types; avoid duplicating schemas
- **Forms**: React Hook Form + Zod validation
- **Dates**: store UTC in DB, display in local timezone using `date-fns`
- **No comments** unless the WHY is non-obvious

## Responsive Targets
- Mobile: 375px+
- Tablet: 768px+
- Desktop: 1280px+
- Use Tailwind responsive prefixes: `sm:` `md:` `lg:`

## Out of Scope
- Payment gateway / online transactions
- Player-facing portal (organizer-only)
- Real-time push notifications
- Multi-organizer / team roles

## Data Model Summary (see ARCHITECTURE.md for full schema)
Core entities: `Player`, `Court`, `Match`, `MatchPlayer`, `QueueEntry`, `BenchEntry`, `Payment`, `Session`, `SkillLevelHistory`
- `Session.status` — `OPEN | CLOSED`; only one session can be OPEN at a time; match/queue creation blocked on closed sessions
- `Match.sessionId` — every match belongs to a session; all stats are session-scoped, no cross-session aggregation
- `Match.result` — `SIDE_A | SIDE_B | DRAW`; null while in progress or voided
- `Match.isWalkover` — winning side only gets a win; losing side takes no loss
- No score tracking — `MatchSet` model does not exist
- `Player.notes` — private organizer-only text; shown on profile and match player-picker
- `Player.status` — soft delete via `ACTIVE | INACTIVE`; historical match data preserved
- `SkillLevelHistory` — append-only log created automatically on every level change
- `Court` — hard delete always permitted (no match-history restriction); auto-numbered sequentially (`Court 1`, `Court 2`, …); numbers resequence on add/delete; no custom names; `Match.courtName` snapshots the name at creation so history survives deletion
- `Match.courtId` — nullable FK (`onDelete: SetNull`)
- `Payment` — manual ledger; one record per player per session; created by organizer only
- Smart matchup candidates: **queue only** (bench excluded); not in an active match; ordered by `sessionJoinedAt` ASC
- `QueueEntry.sessionJoinedAt` — set once when a player first enters the session (queue or bench); never reset on re-queue; used to sort players returning from a match back into the queue in original check-in order
- `BenchEntry` — unordered holding area for players present but not ready to queue; also carries `sessionJoinedAt`; draggable into planning cards manually but excluded from auto-suggest
