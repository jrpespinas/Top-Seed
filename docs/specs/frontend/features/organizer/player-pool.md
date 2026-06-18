# PlayerPool

## Purpose

Layout composite for the pegboard **Available** zone on the live dashboard. Desktop display label: **Player List**.

## User Job

Let the organizer check players in and see who is waiting, resting, done, or removed.

## Composition

```text
PlayerPool
├── PlayerCheckInPanel   (search, add walk-in, check in)
└── QueuePanel           (filter chips on desktop; PlayerCard list; opens PlayerDetailDrawer)
```

## Child Feature Specs

- `docs/specs/frontend/features/organizer/player-check-in-panel.md`
- `docs/specs/frontend/features/organizer/queue-panel.md`

## Layout Rules

- Desktop pegboard: zone header **Player List · {n} total** with optional `+` to focus check-in.
- Tablet/desktop: place beside `NextQueuePanel` and `CourtBoard` per dashboard layout.
- Mobile: **Available** tab in bottom navigation per `docs/specs/frontend/design-system.md`.
- Players with `assigned` or `playing` status appear in Queued/Playing filters and on Next-lane and court cards.

## Deprecated Names

- Do not introduce alternate layout names for this zone in new specs.
