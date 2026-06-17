# PlayerPool

## Purpose

Layout composite for the pegboard **Available** zone on the live dashboard. Not a single monolithic component file—compose from feature children.

## User Job

Let the organizer check players in and see who is waiting, resting, done, or removed.

## Composition

```text
PlayerPool
├── PlayerCheckInPanel   (search, add walk-in, check in)
└── QueuePanel           (waiting / resting / done / removed; opens PlayerDetailDrawer)
```

## Child Feature Specs

- `docs/specs/frontend/features/organizer/player-check-in-panel.md`
- `docs/specs/frontend/features/organizer/queue-panel.md`

## Layout Rules

- Tablet/desktop: place beside or below `CourtBoard` and `NextQueuePanel` per dashboard layout.
- Mobile: **Available** tab in bottom navigation per `docs/specs/frontend/design-system.md`.
- Players with `assigned` or `playing` status do not appear here; they appear on Next-lane and court cards.

## Deprecated Names

- Do not introduce alternate layout names for this zone in new specs.
