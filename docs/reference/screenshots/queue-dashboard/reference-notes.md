# Queue Dashboard Reference Notes

## What Works

- Courts are visible as spatial containers, not just rows in a table.
- Occupied courts show players inside court/team slots.
- Waiting players are represented like movable tokens.
- Next matches or queue slots are visible before they move to a court.
- Add court and add player actions are close to the operating surface.
- The primitive pegboard model makes the organizer's mental map obvious: waiting players move to next, next moves to court, court returns players to the pool after a result.

## What Does Not Fit

- Tiny labels and low-contrast text are risky in a bright badminton hall.
- Drag-and-drop-only interactions do not work well enough on mobile or for accessibility.
- Dense sidebars can hide payment exceptions or sync failures.
- Some references over-index on visual court drawings at the expense of clear action hierarchy.
- A pure manual pegboard misses MVP needs like payment tracking, match history, sync status, and auto-suggestions.

## Borrow

- The physical pegboard mental model.
- `Available`, `Next`, and `Now` layout structure.
- Player tokens that can be moved between waiting pool, next queue, and court slots.
- Court cards with Team A / Team B slots.
- A visible next-match staging lane that can hold more than one upcoming match.
- Add court affordances directly inside the court area.

## Do Not Copy

- Pixel-level layouts, colors, logos, or typography from reference products.
- Inaccessible low-contrast labels.
- Drag-and-drop as the only assignment method.
- Generic dashboard metric dominance over courts and next queue.
- Visual clutter that makes live courtside decisions slower.

## MVP Layout Principle

The organizer dashboard should behave like a digital badminton pegboard:

```text
Available Players -> Next Queue -> Courts -> Result -> Available Players
```

The app may use modern UI components, but the workflow should remain grounded in this physical queueing behavior.
