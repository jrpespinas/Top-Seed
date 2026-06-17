# @top-seed/domain

Pure business rules for Top Seed. No Fastify, Prisma, React, or Dexie imports.

Phase 2 `apps/api` use cases should call these functions and map results to `packages/contracts` DTOs.

## Module map

| Module | Key exports | Spec source |
|--------|-------------|-------------|
| `queue/suggestion` | `buildSuggestion`, `buildSuggestionPool`, `explainSuggestion` | `queueing-and-ratings.md` |
| `transitions` | `validatePromoteQueuedMatch`, `clearPlayerFromOtherQueuedMatches`, `validateSessionComplete`, … | `state-transitions.md` |
| `ratings` | `computeMatchRatingDeltas`, `clampRating`, `applyRatingDelta` | `match-results-and-ratings.md` |
| `stats` | `computeWinRate`, `applyOutcomeToPlayerStats`, `recomputeSessionFromMatches` | `match-results-and-ratings.md` |
| `payments` | `validatePaymentState`, `validatePaymentTransition`, `computePaymentSummary` | `payments.md` |
| `constants` | `SUGGESTION_WEIGHTS`, `RATING_DELTAS` | tuning knobs |

## Usage (Phase 2)

```typescript
import { buildSuggestion, validatePromoteQueuedMatch, computePaymentSummary } from "@top-seed/domain";

const suggestion = buildSuggestion(sessionSnapshot);
const promote = validatePromoteQueuedMatch(queuedMatch, court);
const totals = computePaymentSummary(checkIns, session.feeAmount, session.currency);
```

## Testing

```bash
pnpm --filter @top-seed/domain test
```

Domain tests are the primary safety net for queue fairness, pegboard invariants, ratings, and payment totals before HTTP or UI exist.

## Correction recompute

`recomputeSessionFromMatches` recomputes stats and ratings **within a session** in chronological order. Cross-session club rating rebuild is deferred per `match-results-and-ratings.md`.
