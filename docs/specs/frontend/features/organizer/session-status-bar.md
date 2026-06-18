# SessionStatusBar

## User Job

Show the organizer the live health of a badminton session through operational metrics.

**Desktop (≥1280px):** This component is **deprecated on the live dashboard**. Use `AttentionRail` for exceptions (unpaid, sync) and zone context inside the pegboard. See `live-dashboard-layout.md` and `attention-rail.md`.

**Mobile / More tab:** Keep compact horizontal `MetricCard` scroll when full metrics are needed off the primary pegboard tabs.

## Data Required

- Checked-in player count.
- Waiting player count.
- Active match count.
- Open court count.
- Unpaid player count.
- Collected amount.

## Child Components

- `MetricCard`
- `PaymentBadge`

## Actions Emitted

- `onFilterWaiting`
- `onFilterUnpaid`
- `onViewCourts`
- `onViewPayments`

## Permissions

- Payment totals visible to organizers only.

## States

- Loading metrics.
- Ready.
- Realtime updating.
- Empty session metrics.

## Responsive Composition

- Mobile: horizontal scroll of compact `MetricCard` components (e.g. **More** tab).
- Tablet: single-row status bar when space allows; prefer `AttentionRail` when only exceptions matter.
- Desktop live dashboard: **do not render** — replaced by `AttentionRail` + `SupportingStrip`.

## Acceptance Criteria

- Unpaid count is never hidden from organizers.
- Each interactive metric filters or navigates to relevant detail.
- Metrics do not introduce vanity analytics.
