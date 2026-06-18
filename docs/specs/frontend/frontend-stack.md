# Frontend Stack Spec

## Purpose

This spec defines the recommended frontend stack for the organizer-only, offline-resilient badminton queueing MVP. Use it before adding dependencies, choosing component libraries, or implementing frontend architecture.

The goal is to support a premium sports-club visual feel, a pegboard-inspired live dashboard, and local-first offline operation without drifting into a generic enterprise admin UI.

Monorepo layout and shared packages: `docs/specs/backend/backend-stack.md` (`apps/web`, `apps/api`, `packages/contracts`, `packages/domain`).

## Chosen Stack

- `React`: component model for the web app.
- `TypeScript`: type safety for domain data, routes, sync actions, and component props.
- `Vite`: lightweight app shell and PWA-friendly build pipeline.
- `TanStack Router`: typed route structure for organizer pages.
- `TanStack Query`: server sync, retries, stale data handling, and server snapshot coordination.
- `Dexie`: IndexedDB wrapper for durable local session data and sync outbox.
- `Tailwind CSS`: token-driven styling and fast responsive layout work.
- `Radix UI`: accessible primitives for dialogs, drawers, menus, tabs, popovers, and form interactions.
- shadcn-style component organization: copy/adapt component patterns, but apply project-specific visual tokens.
- `dnd-kit`: optional desktop drag/drop for player-token movement.
- `Zod`: runtime validation for forms, local records, and sync payloads.
- PWA service worker support: app-shell caching and offline reopening.

## Why This Stack

- Local-first sessions need durable browser storage; `Dexie` gives a practical IndexedDB layer.
- Sync needs retryable server coordination; `TanStack Query` fits the online side without replacing local state.
- The app needs a custom sports operations feel; `Tailwind` tokens plus custom components give more control than generic UI kits.
- The dashboard needs accessible overlays and menus; `Radix UI` provides behavior without forcing visual style.
- The pegboard interaction may benefit from drag/drop on desktop; `dnd-kit` supports this while preserving button alternatives.
- The MVP has no login and no server-rendered marketing pages, so `Vite` is a better default than a heavier full-stack framework.

## Libraries To Avoid By Default

- Avoid Material UI and Ant Design for MVP UI. They tend to push the product toward generic enterprise admin aesthetics.
- Avoid heavy dashboard/charting libraries for core layout. The MVP is operational, not analytics-first.
- Avoid CSS-in-JS as the main styling system unless a future requirement justifies it.
- Avoid drag/drop-only interaction libraries or patterns.
- Avoid component kits that make it hard to implement project-specific tokens, court cards, and player-token interactions.

## Component System Approach

Use custom project components built on accessible primitives:

```text
components/ui/       shared primitives built from Tailwind + Radix
components/forms/    form wrappers and validation display
components/layout/   shells, columns, panels, responsive primitives
features/*           badminton-specific composition
```

Rules:

- `components/ui` should contain custom styled primitives, not raw imports from a generic kit.
- Radix should provide behavior; Tailwind tokens should provide look and spacing.
- shadcn-style components may be used as a starting pattern, but default visuals must be replaced by Top Seed tokens.
- Domain components such as `CourtCard`, `PlayerRow`, `PlayerCard`, and `MatchCard` should remain custom.

### shadcn-style primitives to add when missing

Avatar, Badge, ScrollArea, and Separator — copy/adapt from shadcn/ui patterns using project tokens. Do not import default shadcn theme colors wholesale.

## Styling And Tokens

Use Tailwind configured around semantic tokens:

- `surface`: app backgrounds, cards, panels.
- `court`: deep green court containers.
- `next`: warm queue/staging accents.
- `attention`: unpaid, failed sync, or required action.
- `text`: primary, secondary, muted.
- `border`: card boundaries, slot dividers, court lines.

Rules:

- Prefer semantic classes or token wrappers over raw color utilities.
- Keep off-white/warm gray surfaces as the default app canvas.
- Use deep green and charcoal for high-emphasis operational areas.
- Use orange/yellow sparingly for next queue, active attention, or highlights.
- Do not copy reference colors exactly; adapt the mood into accessible tokens.

## Local-First Expectations

The frontend must support:

- Durable active session storage in IndexedDB through `Dexie`.
- Local records for players, courts, check-ins, matches, payments, leaderboard cache, and match history cache.
- A sync outbox table for pending actions.
- UI updates from local writes before server acknowledgement.
- Retry and recovery for failed sync actions.
- App-shell caching so the organizer can reopen the app during poor connectivity.

`TanStack Query` should coordinate server snapshots and sync calls, but it should not be the only source of truth for live session operation.

## Drag And Drop

Use `dnd-kit` only as an enhancement.

Allowed:

- Desktop player-token movement between available pool, next queue, and court slots.
- Reordering queued matches.
- Moving a queued match onto a court.

Required alternatives:

- Add to next match.
- Move to court.
- Swap player.
- Remove from queue.
- Send to resting.

Mobile must not require drag/drop.

## PWA Expectations

MVP should be PWA-ready:

- Cache app shell assets.
- Reopen the active session without network when possible.
- Detect online/offline state.
- Preserve local session data across reloads.
- Warn before risky local data clearing when unsynced actions exist.

## Testing Implications

Frontend tests should cover:

- Route rendering with `TanStack Router`.
- Local database read/write paths around active session data.
- Sync outbox creation and retry states.
- Component behavior with Radix primitives.
- Tailwind class/variant behavior for key components when practical.
- Drag/drop behavior on desktop plus non-drag alternatives.
- Offline reload preserving session data.

## Review Checklist

Before adding a frontend dependency:

- Does it support the local-first MVP?
- Can it preserve the custom sports-club visual direction?
- Does it work with Tailwind tokens and Radix primitives?
- Does it avoid making the app look like a generic admin dashboard?
- Does it preserve accessible non-drag workflows?
