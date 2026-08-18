import type { SkillLevel } from "@/types";

/**
 * The skill ladder, strongest first. Rank is `index + 1`.
 *
 * Four tiers, not seven. The old ladder (Professional → Newbie) was fine enough
 * that exact-level matching almost never succeeded, which is why smart-matchup
 * grew a separate "band" layer to group interchangeable neighbours. At four
 * tiers each level is already about as wide as a band was, so bands collapsed
 * into the levels themselves — see `isAdjacentLevel` below.
 */
export const SKILL_LEVELS: SkillLevel[] = ["ADVANCED", "INTERMEDIATE", "BEGINNER", "CASUAL"];

export const SKILL_RANK: Record<SkillLevel, number> = {
  ADVANCED: 1,
  INTERMEDIATE: 2,
  BEGINNER: 3,
  CASUAL: 4,
};

/**
 * Two levels may be matched together when they are at most one rung apart.
 *
 * Symmetric on purpose: if an Intermediate short of peers may play down to a
 * Beginner, that same pairing has to be reachable when the Beginner is the one
 * waiting. Whether a player *actually* reaches up or down is decided by their
 * own win rate (see the directional escalation in smart-matchup.ts) — this
 * function only says which pairings are permitted at all.
 */
export function isAdjacentLevel(a: SkillLevel, b: SkillLevel): boolean {
  return Math.abs(SKILL_RANK[a] - SKILL_RANK[b]) <= 1;
}

/** Levels stored before the 7 → 4 collapse. */
const LEGACY_SKILL_MAP: Record<string, SkillLevel> = {
  S: "ADVANCED",
  A: "ADVANCED",
  B: "INTERMEDIATE",
  C: "INTERMEDIATE",
  D: "BEGINNER",
  E: "BEGINNER",
  F: "CASUAL",
};

/**
 * Normalises a skill level read from storage.
 *
 * Every persisted blob — live queue and bench entries, planning cards, active
 * matches, the match log, and the frozen snapshots inside closed sessions — is
 * `JSON.parse`d and cast straight to `Player`, so TypeScript never sees a stale
 * value. Left alone, an old `"B"` would sail through the type system and then
 * surface as an undefined badge variant and a `NaN` rank inside the matchup
 * scorer: silent, not loud. Hence a runtime gate at every read boundary.
 *
 * The new codes are words rather than letters precisely so this stays
 * unambiguous. Had the four tiers reused `A`–`D`, a stored `"A"` would be
 * simultaneously a valid old value (Advanced) and a valid new one, and there
 * would be no way to tell migrated data from unmigrated. Idempotent by
 * construction: anything already in the new set is returned untouched.
 *
 * Unrecognised input falls back to INTERMEDIATE — the middle of the ladder is
 * the least wrong guess, and a bad stored value should never crash a session.
 */
export function migrateSkillLevel(raw: unknown): SkillLevel {
  if (typeof raw === "string") {
    if ((SKILL_LEVELS as string[]).includes(raw)) return raw as SkillLevel;
    const mapped = LEGACY_SKILL_MAP[raw];
    if (mapped) return mapped;
  }
  return "INTERMEDIATE";
}

/** Applies `migrateSkillLevel` to anything shaped like a player. */
export function migratePlayerSkill<T extends { skillLevel: SkillLevel }>(player: T): T {
  const migrated = migrateSkillLevel(player.skillLevel);
  return migrated === player.skillLevel ? player : { ...player, skillLevel: migrated };
}

/**
 * Deep-migrates every `skillLevel` in a parsed storage blob.
 *
 * Applied at the deserialize boundary rather than at each of the ~20 read
 * sites, because the field is buried at different depths in every shape:
 * `QueueEntry.player`, `Court.activeMatch.sideA[]`, `PlanningCard.suggestion
 * .sideB[]`, `MatchRecord.sideA[]`, `SessionRecord.players[]`. Walking
 * generically means a new shape can't quietly miss the migration.
 *
 * Returns the original reference when nothing changed, so a read that needed
 * no migration doesn't hand React a new object every time and retrigger
 * renders downstream.
 */
export function migrateSkillLevelsDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const migrated = migrateSkillLevelsDeep(item);
      if (migrated !== item) changed = true;
      return migrated;
    });
    return (changed ? next : value) as T;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const migrated = key === "skillLevel" ? migrateSkillLevel(item) : migrateSkillLevelsDeep(item);
      if (migrated !== item) changed = true;
      next[key] = migrated;
    }
    return (changed ? next : value) as T;
  }
  return value;
}
