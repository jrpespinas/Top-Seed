"use client";

import {
  Wallet, Users, Repeat, Signal, Hourglass, AlarmClock, TrendingUp,
} from "lucide-react";
import { cn, SKILL_LABELS, SKILL_LABELS_SHORT, formatElapsedMs } from "@/lib/utils";
import { GENDER_LABELS } from "@/components/ui/GenderToggle";
import { SkillBadge } from "@/components/ui/SkillBadge";
import type { RosterStats, WaitingStats } from "@/lib/player-stats";
import type { WaitSample } from "@/lib/wait-trend";
import { rotationSummary, flowSummary } from "@/lib/player-stats";
import type { Gender, SkillLevel } from "@/types";

const SKILL_FILL: Record<SkillLevel, string> = {
  ADVANCED: "bg-skill-advanced",
  INTERMEDIATE: "bg-skill-intermediate",
  BEGINNER: "bg-skill-beginner",
  CASUAL: "bg-skill-casual",
};

const GENDER_FILL: Record<"M" | "F" | "none", string> = {
  M: "bg-gender-m",
  F: "bg-gender-f",
  none: "bg-border",
};

/**
 * A bento cell.
 *
 * `span` is passed per cell rather than defaulted, because cells of genuinely
 * different sizes is the whole difference between a bento and a grid of
 * identical stat tiles — the latter being one of the shapes this layout is
 * explicitly not allowed to become.
 */
function Cell({
  span,
  label,
  icon: Icon,
  children,
}: {
  span: string;
  label: string;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("rounded-lg border border-border bg-surface p-3.5 flex flex-col", span)}
      aria-label={label}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} strokeWidth={2} className="text-muted flex-shrink-0" aria-hidden />
        <h3 className="text-[11px] font-medium text-muted uppercase tracking-wide">{label}</h3>
      </div>
      {children}
    </section>
  );
}

/**
 * The big number. Mono and tabular so digits don't reflow as counts change.
 *
 * Sized down from `text-5xl`: at that scale a cell holding one figure and one
 * caption couldn't fill the height the grid stretched it to, and every row is
 * only as short as its tallest member allows.
 */
function Figure({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "primary" }) {
  return (
    <span
      className={cn(
        "font-mono text-3xl sm:text-4xl font-bold leading-none tabular-nums tracking-tight",
        tone === "primary" ? "text-primary" : "text-ink"
      )}
    >
      {children}
    </span>
  );
}

/** A figure with its unit beneath, for cells carrying more than one. */
function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <Figure>{value}</Figure>
      <p className="mt-1 text-xs text-muted truncate">{label}</p>
    </div>
  );
}

/**
 * A proportional bar whose segments are the filter control.
 *
 * The page already owned skill and gender filters as pill rows; wiring the
 * chart to the same setters means the bento is the table's control surface
 * rather than decoration stacked on top of it. Selected segments stay full
 * strength and the rest dim, so the bar doubles as a read-out of what the
 * table below is currently showing.
 */
function SegmentBar<T extends string>({
  segments,
  total,
  selected,
  onToggle,
}: {
  segments: { key: T; label: string; shortLabel: string; count: number; fill: string }[];
  total: number;
  selected: Set<T>;
  onToggle?: (key: T) => void;
}) {
  const present = segments.filter((s) => s.count > 0);
  const anySelected = selected.size > 0;

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-elevated"
        role="presentation"
      >
        {present.map((s) => (
          <span
            key={s.key}
            className={cn(
              s.fill,
              "transition-opacity duration-150",
              anySelected && !selected.has(s.key) && "opacity-25"
            )}
            style={{ width: `${(s.count / total) * 100}%` }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
        {segments.map((s) => {
          const isSelected = selected.has(s.key);
          const dimmed = anySelected && !isSelected;
          const disabled = s.count === 0 || !onToggle;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={onToggle ? () => onToggle(s.key) : undefined}
                disabled={disabled}
                aria-pressed={onToggle ? isSelected : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded px-1 -mx-1 py-0.5 transition-opacity duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  disabled ? "cursor-default opacity-40" : "cursor-pointer hover:opacity-100",
                  dimmed && !disabled && "opacity-45"
                )}
                title={disabled && s.count === 0 ? `No ${s.label} players` : s.label}
              >
                <span className={cn("h-2 w-2 rounded-sm flex-shrink-0", s.fill)} aria-hidden />
                <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                  {s.count}
                </span>
                <span className="text-xs text-muted">{s.shortLabel}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Games played, one bar per count.
 *
 * The only chart on this page with a person behind it: the rotation exists to
 * stop anyone sitting out, and nothing in the app has ever shown whether it
 * worked. Bars carry a value label rather than an axis — with a handful of
 * buckets, axis furniture costs more room than it returns.
 */
function RotationChart({ rotation }: { rotation: RosterStats["rotation"] }) {
  const peak = Math.max(1, ...rotation.buckets.map((b) => b.count));
  const laggardLine = rotation.median - 2;

  return (
    <div className="flex-1 flex items-end gap-1.5 min-h-[76px]" role="img"
         aria-label={rotation.buckets
           .map((b) => `${b.count} player${b.count === 1 ? "" : "s"} on ${b.games} matches`)
           .join(", ")}>
      {rotation.buckets.map((bucket) => {
        const behind = rotation.verdict === "uneven" && bucket.games <= laggardLine;
        return (
          <div key={bucket.games} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span
              className={cn(
                "font-mono text-[11px] tabular-nums leading-none",
                bucket.count === 0 ? "text-muted/35" : behind ? "text-warning" : "text-ink"
              )}
            >
              {bucket.count || ""}
            </span>
            <div
              className={cn(
                "w-full rounded-sm transition-colors",
                // Warning, not error: someone playing less is worth a look, not
                // an alarm. An empty bucket keeps a hairline so the axis still
                // reads as a continuous scale rather than a gap.
                bucket.count === 0
                  ? "bg-border/60"
                  : behind
                  ? "bg-warning"
                  : "bg-primary/70"
              )}
              style={{
                height: bucket.count === 0 ? 2 : `${Math.max(6, (bucket.count / peak) * 60)}px`,
              }}
            />
            <span className="font-mono text-[10px] tabular-nums text-muted leading-none">
              {bucket.games}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Current waits, bucketed by minute.
 *
 * A bar chart rather than a box plot: a queue holds a handful of people, and a
 * box plot's quartiles describe noise at that size while demanding more
 * reading literacy than the job needs. "Three people have been waiting 15+
 * minutes" is a sentence with an action attached; a whisker isn't.
 *
 * Bars past the long-wait line take `warning`, matching the rotation chart —
 * someone stuck is worth walking over about, not an alarm.
 */
function WaitChart({ stats }: { stats: WaitingStats }) {
  const peak = Math.max(1, ...stats.buckets.map((b) => b.count));
  const H = 48;
  const stepW = 100 / stats.buckets.length;

  const flagged = stats.buckets.map((b) => {
    const from = b.fromMin * 60_000;
    const to = b.toMin === null ? Infinity : b.toMin * 60_000;
    // Flagged by whether the bucket actually holds a stuck player, not by
    // whether its bounds straddle the line. With the threshold landing
    // mid-bucket, testing bounds would paint a whole step late on behalf of
    // someone who isn't.
    return stats.stuck.some((w) => w.waitedMs >= from && w.waitedMs < to);
  });

  // A stairs plot, not a polyline through midpoints. Counts are binned, so
  // there is no "2.5 players at 7.5 minutes" to interpolate — a step holds
  // each value flat across its own bucket and asserts nothing in between,
  // which is also the only honest way to draw the open-ended 20+ bin.
  const points: string[] = [];
  stats.buckets.forEach((bucket, i) => {
    const y = H - (bucket.count / peak) * H;
    points.push(`${i * stepW},${y}`, `${(i + 1) * stepW},${y}`);
  });

  return (
    <div
      className="flex-1 flex flex-col"
      role="img"
      aria-label={stats.buckets
        .map(
          (b) =>
            `${b.count} player${b.count === 1 ? "" : "s"} waiting ${
              b.toMin === null ? `${b.fromMin} minutes or more` : `${b.fromMin} to ${b.toMin} minutes`
            }`
        )
        .join(", ")}
    >
      <svg
        viewBox={`0 0 100 ${H}`}
        preserveAspectRatio="none"
        className="w-full h-12 overflow-visible"
        aria-hidden
      >
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="currentColor"
          className="text-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {stats.buckets.map((bucket, i) =>
          bucket.count === 0 ? null : (
            <circle
              key={bucket.fromMin}
              cx={i * stepW + stepW / 2}
              cy={H - (bucket.count / peak) * H}
              r={2.5}
              className={flagged[i] ? "text-warning" : "text-primary"}
              fill="currentColor"
              vectorEffect="non-scaling-stroke"
            />
          )
        )}
      </svg>

      <div className="flex mt-1">
        {stats.buckets.map((bucket, i) => (
          <div key={bucket.fromMin} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
            <span
              className={cn(
                "font-mono text-[11px] tabular-nums leading-none",
                bucket.count === 0 ? "text-muted/35" : flagged[i] ? "text-warning" : "text-ink"
              )}
            >
              {bucket.count || "·"}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-muted leading-none whitespace-nowrap">
              {bucket.toMin === null ? `${bucket.fromMin}+` : bucket.fromMin}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Average wait across the evening — the one chart here that is genuinely a
 * line, because clock time is continuous and the space between two samples
 * really does mean something.
 *
 * Answers what a snapshot never can: whether waits crept up after a court was
 * lost, or settled once the queue thinned.
 */
function WaitTrendChart({ samples }: { samples: WaitSample[] }) {
  const H = 44;
  const peak = Math.max(60_000, ...samples.map((s) => s.avgMs));
  const first = new Date(samples[0].at).getTime();
  const last = new Date(samples[samples.length - 1].at).getTime();
  const span = Math.max(1, last - first);

  const points = samples
    .map((s) => {
      const x = ((new Date(s.at).getTime() - first) / span) * 100;
      return `${x},${H - (s.avgMs / peak) * H}`;
    })
    .join(" ");

  const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex-1 flex flex-col">
      <svg
        viewBox={`0 0 100 ${H}`}
        preserveAspectRatio="none"
        className="w-full h-11 overflow-visible"
        role="img"
        aria-label={`Average wait from ${clock(samples[0].at)} to ${clock(
          samples[samples.length - 1].at
        )}, peaking at ${formatElapsedMs(peak)}`}
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          className="text-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between mt-1.5 font-mono text-[10px] tabular-nums text-muted">
        <span>{clock(samples[0].at)}</span>
        <span>peak {formatElapsedMs(peak)}</span>
        <span>{clock(samples[samples.length - 1].at)}</span>
      </div>
    </div>
  );
}

export function RosterOverview({
  stats,
  waiting,
  waitTrend,
  matchesPlayed,
  skillFilter,
  genderFilter,
  onToggleSkill,
  onToggleGender,
}: {
  stats: RosterStats;
  /** Live queue waits. Null for a closed session, which never recorded any. */
  waiting: WaitingStats | null;
  /** Sampled once a minute by `WaitTrendRecorder` while the app is open. */
  waitTrend: WaitSample[];
  matchesPlayed: number;
  skillFilter: Set<SkillLevel>;
  genderFilter: Set<Gender>;
  onToggleSkill: (level: SkillLevel) => void;
  onToggleGender: (gender: Gender) => void;
}) {
  const { total, bySkill, byGender, payment, rotation } = stats;
  if (total === 0) return null;

  const skillSegments = bySkill.map((s) => ({
    key: s.level,
    label: SKILL_LABELS[s.level],
    shortLabel: SKILL_LABELS_SHORT[s.level],
    count: s.count,
    fill: SKILL_FILL[s.level],
  }));

  // The unspecified slice is rendered but never filterable — there is no
  // "no gender" filter behind it, and a segment that looks clickable and
  // isn't is worse than one that plainly isn't.
  const genderSegments = byGender
    .filter((s): s is { gender: Gender; count: number } => s.gender !== null)
    .map((s) => ({
      key: s.gender,
      label: GENDER_LABELS[s.gender],
      shortLabel: GENDER_LABELS[s.gender],
      count: s.count,
      fill: GENDER_FILL[s.gender],
    }));
  const unspecified = byGender.find((s) => s.gender === null)?.count ?? 0;

  return (
    /* Rows are grouped so their cells carry comparable content: grid rows
       stretch every cell to the tallest, so a thin cell beside a chart is
       guaranteed dead space. The always-present rows come first and each fills
       exactly six columns, so a closed session — which has no waiting data —
       ends on a complete row rather than a hole. */
    <div className="px-4 sm:px-6 py-4 grid grid-cols-2 lg:grid-cols-6 gap-3">
      {/* Two figures in one cell rather than two near-empty cells. */}
      <Cell span="col-span-2" label="Session" icon={Users}>
        <div className="flex gap-6">
          <Stat value={total} label={total === 1 ? "player" : "players"} />
          <Stat value={matchesPlayed} label={matchesPlayed === 1 ? "match" : "matches"} />
        </div>
        {unspecified > 0 && (
          <p className="mt-auto pt-2 text-[11px] text-muted">
            {unspecified} without a gender set
          </p>
        )}
      </Cell>

      <Cell span="col-span-2" label="Collected" icon={Wallet}>
        <div className="flex items-baseline gap-1.5">
          <Figure tone={payment.unpaid === 0 ? "primary" : "ink"}>{payment.settled}</Figure>
          <span className="font-mono text-base text-muted tabular-nums">/ {total}</span>
        </div>
        <div className="mt-auto pt-3 flex h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
          <span className="bg-success" style={{ width: `${(payment.paid / total) * 100}%` }} />
          <span className="bg-success/35" style={{ width: `${(payment.waived / total) * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          {payment.unpaid === 0 ? "Everyone settled" : `${payment.unpaid} still to collect`}
          {payment.waived > 0 && ` · ${payment.waived} waived`}
        </p>
      </Cell>

      {/* Skill and gender share a cell: both are proportional bars driving the
          same table, and two of them stacked read as one idea rather than two
          half-empty ones. */}
      <Cell span="col-span-2" label="Make-up" icon={Signal}>
        <div className="flex-1 flex flex-col gap-3 justify-center">
          <SegmentBar
            segments={skillSegments}
            total={total}
            selected={skillFilter}
            onToggle={onToggleSkill}
          />
          <SegmentBar
            segments={genderSegments}
            total={total}
            selected={genderFilter}
            onToggle={onToggleGender}
          />
        </div>
      </Cell>

      {/* Full width, with the names of anyone left behind filling the space the
          histogram alone would have left empty — and answering "who?" without
          a trip to the table. */}
      <Cell span="col-span-2 lg:col-span-6" label="Rotation" icon={Repeat}>
        <div className="flex flex-col sm:flex-row sm:items-stretch gap-4">
          <div className="flex-1 flex flex-col min-w-0">
            <span
              className={cn(
                "text-sm font-semibold mb-2",
                rotation.verdict === "uneven" ? "text-warning" : "text-ink"
              )}
            >
              {rotationSummary(rotation)}
            </span>
            <RotationChart rotation={rotation} />
            <p className="mt-2 text-[11px] text-muted">Players by matches played</p>
          </div>
          {rotation.laggards.length > 0 && (
            <div className="sm:w-56 sm:border-l sm:border-border sm:pl-4 flex flex-col">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wide mb-2">
                Behind the field
              </span>
              <ul className="flex flex-wrap sm:flex-col gap-x-3 gap-y-1">
                {rotation.laggards.slice(0, 6).map((p) => (
                  <li key={p.id} className="text-sm text-ink truncate">
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Cell>

      {waiting && (
        <>
          <Cell span="col-span-2 lg:col-span-3" label="Waiting now" icon={Hourglass}>
            {waiting.averageMs === null ? (
              <p className="text-sm text-muted">Nobody is in the queue.</p>
            ) : (
              <>
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <Figure>{formatElapsedMs(waiting.averageMs)}</Figure>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      waiting.verdict === "backed-up" ? "text-warning" : "text-ink"
                    )}
                  >
                    {flowSummary(waiting)}
                  </span>
                </div>
                <div className="mt-3 flex-1 flex flex-col">
                  <WaitChart stats={waiting} />
                  <p className="mt-2 text-[11px] text-muted">
                    Players by minutes waited · long past{" "}
                    {Math.round(waiting.longWaitMs / 60_000)}m, a typical match here
                  </p>
                </div>
              </>
            )}
          </Cell>

          <Cell span="col-span-2 lg:col-span-3" label="Waiting longest" icon={AlarmClock}>
            {waiting.longest === null ? (
              <p className="text-sm text-muted">Nobody is waiting for a court.</p>
            ) : (
              <>
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <Figure tone="primary">{formatElapsedMs(waiting.longest.waitedMs)}</Figure>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-base font-semibold text-ink truncate">
                      {waiting.longest.name}
                    </span>
                    <SkillBadge level={waiting.longest.skillLevel} compact dense />
                  </span>
                </div>
                {waiting.waiting.length > 1 && (
                  <ul className="mt-auto pt-3 flex flex-col gap-1">
                    {waiting.waiting.slice(1, 5).map((w) => (
                      <li key={w.id} className="flex items-baseline gap-2 min-w-0">
                        <span className="font-mono text-xs tabular-nums text-muted w-10 flex-shrink-0">
                          {formatElapsedMs(w.waitedMs)}
                        </span>
                        <span className="text-xs text-ink truncate">{w.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Cell>

          {waitTrend.length >= 2 && (
            <Cell span="col-span-2 lg:col-span-6" label="Wait across the evening" icon={TrendingUp}>
              <WaitTrendChart samples={waitTrend} />
              <p className="mt-2 text-[11px] text-muted">
                Average queue wait, sampled each minute the app was open
              </p>
            </Cell>
          )}
        </>
      )}
    </div>
  );
}
