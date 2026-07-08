# Product Requirements Document — Top Seed

## Problem Statement
Badminton organizers manage sessions manually: tracking who's waiting to play, which courts are free, who owes money, and who's winning. This creates friction, errors, and time wasted on logistics instead of playing.

## Target User
**The Organizer** — a single person (or small group) who runs recurring badminton sessions at a venue with multiple courts. They operate from a tablet/phone courtside or a laptop at a desk.

## Goals
1. Eliminate paper-based court and queue management
2. Make match recording fast (under 30 seconds per match)
3. Give players visibility into standings (leaderboard) without needing accounts
4. Track who has paid for a session at a glance

## Non-Goals
- Player self-service portal
- Online payment processing
- Multi-venue / franchise management
- Automated notifications to players

---

## Feature Areas

### 1. Player Management
Maintain a roster of players across sessions.

**User Stories**
- As an organizer, I can add a new player with name, contact number, and skill level so I can track them across sessions.
- As an organizer, I can edit a player's details when their info changes.
- As an organizer, I can mark a player as inactive so they no longer appear in active dropdowns but their history is preserved.
- As an organizer, I can search and filter the player list by name or skill level.
- As an organizer, I can view a player's match history and payment status from their profile.

**Acceptance Criteria**
- Player fields: name (required), contact (optional), skill level (F / E / D / C / B / A / S), status (Active / Inactive)
- Skill level tiers: F=Novice, E=Beginner, D=Upper Beginner, C=Intermediate, B=High-Intermediate, A=Advanced, S=Pro Player
- Default level: C (Intermediate)
- Soft-delete only — no hard deletes
- Search is instant (client-side filter on loaded list)

---

### 2. Court Management
Track which courts are available and what's happening on each. Courts are managed inline from the dashboard — no dedicated courts page.

**User Stories**
- As an organizer, I can add a court from the dashboard with a single tap.
- As an organizer, I can see all courts on the dashboard with their current status at a glance.
- As an organizer, I can manually set a court's status to Available, In Use, or Under Maintenance.
- As an organizer, I can delete a court inline from its card on the dashboard.
- As an organizer, court status updates automatically when a match starts or ends on that court.

**Acceptance Criteria**
- Court statuses: `Available`, `In Use`, `Under Maintenance`
- Courts are auto-numbered sequentially: Court 1, Court 2, Court 3, etc. No custom names.
- Adding a court appends the next number. Deleting a court resequences all numbers automatically.
- Hard delete always permitted — no restriction based on match history. `Match.courtName` snapshots the name at creation so history is preserved even after deletion.
- Dashboard courts column has an "Add Court" button in the header and a delete button inline on each CourtCard.
- No dedicated `/courts` route — all court management happens from the dashboard.

---

### 3. Match Recording
Record the result of each game played.

**User Stories**
- As an organizer, I can start a new match by selecting a court, match type (singles/doubles), and assigning players to Side A and Side B.
- As an organizer, I can record the score and mark a winner when a match ends.
- As an organizer, I can view a log of all completed matches, filterable by date and player.
- As an organizer, I can void a match if it was entered incorrectly.

**Acceptance Criteria**
- Match types: Singles (1v1), Doubles (2v2)
- Score format: set-based (e.g., 21-15, 21-18) — up to 3 sets
- Match statuses: `Pending`, `In Progress`, `Completed`, `Voided`
- Starting a match automatically sets the court to "In Use"
- Ending a match automatically sets the court to "Available"
- Voided matches are excluded from leaderboard calculations

---

### 4. Leaderboard
Show player rankings to encourage competition.

**User Stories**
- As an organizer, I can view a leaderboard ranked by wins, win rate, or total matches played.
- As an organizer, I can filter the leaderboard by date range (this week, this month, all time).
- As an organizer, I can filter the leaderboard by match type (singles, doubles, or combined).

**Acceptance Criteria**
- Columns: Rank, Player Name, Matches Played, Wins, Losses, Win Rate
- Ties broken by total matches played (more matches = higher rank at same win rate)
- Voided matches excluded
- Leaderboard is read-only (no edits from this view)

---

### 5. Queue & Matchup Management
Manage the waitlist of players and plan upcoming matchups — all from the Dashboard, without navigating to a separate page.

**User Stories**
- As an organizer, I can add players to a waiting queue for the current session.
- As an organizer, I can see the order of the queue and reorder players manually (up/down controls on mobile, drag-and-drop on tablet+).
- As an organizer, I can see multiple upcoming matchup proposals at once so I can plan assignments before a court opens up.
- As an organizer, I can accept or modify a proposed matchup (swap players between sides, change singles/doubles) before assigning it to a court.
- As an organizer, I can assign a matchup to a court by dragging the card onto a court slot or using the "Assign to Court" button.
- As an organizer, players are automatically removed from the queue when their match starts.
- As an organizer, players are automatically returned to the back of the queue when their match ends.
- As an organizer, I can control how many upcoming matchup cards are shown at once.

**Acceptance Criteria**
- Queue and matchup planning live on the Dashboard — no separate queue page
- Queue is per-session; resets when a new session is opened
- Default of 3 matchup planning cards per session; organizer can add or dismiss cards on the fly during a session
- Each card is auto-suggested by the Smart Suggest algorithm (see spec 07); organizer can resuggest or manually adjust
- Card suggestions are non-overlapping — each card draws from a different subset of the queue
- Court assignment requires a court to be AVAILABLE; IN_USE courts reject drop
- Queue position is editable via up/down controls (mobile) or drag-and-drop (tablet+)
- Chips inside a card are draggable between Side A and Side B on tablet+; tap-to-swap on mobile

---

### 6. Payment Tracking
Track session fees manually without any payment gateway.

**User Stories**
- As an organizer, I can define a session fee for the current session.
- As an organizer, I can mark each player as Paid, Unpaid, or Waived for a session.
- As an organizer, I can see at a glance who still owes money for today's session.
- As an organizer, I can view a player's payment history across sessions.
- As an organizer, I can add a note to any payment record (e.g., "paid half", "owes from last week").

**Acceptance Criteria**
- Payment statuses: `Paid`, `Unpaid`, `Waived`
- Session has a default fee; individual payments can override the amount
- Summary shows: total collected, total outstanding, number of players paid/unpaid
- No actual money is processed — this is a ledger only

---

## UX Principles
- **Speed over completeness**: Common actions (start match, mark paid, add to queue) should require 2–3 taps maximum
- **Tablet-first layout**: Primary use case is a 10–12" tablet held by the organizer courtside
- **High contrast**: Used in bright gym lighting conditions
- **No dead ends**: Every screen has a clear back/cancel action

## Metrics for Success
- Match recorded in < 30 seconds
- Court status always reflects reality (no manual correction needed)
- Organizer can settle payments at end of session in < 5 minutes
