# Product

## Register

product

## Users

The Organizer — one person (occasionally a small group sharing a device) who runs recurring badminton sessions at a gymnasium or club. Two modes of use:

- **Courtside**: standing, bright overhead lighting, loud gym, holding a tablet or phone. Interactions must be fast (under 30 seconds per task), tap targets must be large, and contrast must be high enough to read in glare.
- **Pre/post-session desk review**: seated, calm, reviewing history, configuring settings, or reconciling payments.

Technically comfortable but not a developer. Has been managing sessions manually — paper, group chats, mental tracking — and wants to feel in control and professional.

## Product Purpose

Eliminate manual session management for badminton organizers: track courts, manage the queue, record match results, compute standings, and log payments — all in one place.

Success = the organizer runs a full session end-to-end without opening a spreadsheet or group chat. The app should feel like they have a world-class tool — nothing wastes their time, nothing surprises them, everything is exactly where they expect it.

## Brand Personality

Competitive, premium, minimalist. The tool a professional sports manager would choose — not a neighborhood club app. References: Linear, Vercel dashboard. Capable and precise; never friendly-loud or enterprise-bland.

## Anti-references

- Generic SaaS blue/white (Jira, Salesforce, typical admin panels)
- Warm-cream aesthetic dashboards (Notion-lite, beige/sand palette clones popular in 2024–2026 AI-generated UIs)
- Neighborhood sports club websites (low-effort, clip-art energy)
- Busy sports-betting apps (neon overload, information anxiety, aggressive color saturation)

## Design Principles

1. **Courtside first** — every interaction is designed for someone standing up, glancing at a screen under bright gym lights. Desktop refinement is secondary, never the baseline.
2. **The app disappears into the task** — no decoration that doesn't carry information. The organizer's attention stays on the session, not the interface.
3. **Operational confidence over delight** — predictability and speed beat moments of wow. A button that always works beats an animated one that sometimes surprises you.
4. **Earned density** — during a session, every relevant piece of information is visible without scrolling. Between sessions, spacious and calm.
5. **Premium restraint** — one accent color, strong contrast, tight typography. Quality shows in precision, not ornamentation.

## Accessibility & Inclusion

- WCAG AA minimum; courtside priority target exceeds AA: body text contrast ≥7:1, interactive elements ≥4.5:1
- Minimum tap target: 44×44px; primary session actions (start match, end match, add to queue) ≥48×48px
- Dark mode primary — bright gym environments benefit from a dark interface; reduces glare reflection in peripheral vision
- Reduced motion respected (`prefers-reduced-motion`); transitions limited to state conveyance only, never choreography
