"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { SkillBadge } from "@/components/ui/SkillBadge";
import { GenderIcon } from "@/components/ui/GenderIcon";
import { PaymentToggle } from "@/components/ui/PaymentToggle";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SessionSelect } from "@/components/ui/SessionSelect";
import { PlayerDrawer } from "./PlayerDrawer";
import { useToast, ToastViewport } from "@/components/ui/Toast";
import { cn, SKILL_LABELS, SKILL_LABELS_SHORT } from "@/lib/utils";
import { useMatchLog } from "@/lib/match-log-store";
import {
  useSessionOptions,
  useCurrentSession,
  useSessionArchive,
  useQueueSnapshot,
  useBenchSnapshot,
  updateQueuePlayer,
  updateBenchPlayer,
  removeQueueEntry,
  removeBenchEntry,
  restoreQueueEntry,
  restoreBenchEntry,
} from "@/lib/session-store";
import type { Player, SkillLevel, Gender, PaymentStatus } from "@/types";

type Source = "queue" | "bench";
type SortKey = "name" | "skillLevel" | "gender" | "state" | "paymentStatus" | "gamesPlayed" | "sessionJoinedAt";
type SortDir = "asc" | "desc";

const SKILL_LEVELS: SkillLevel[] = ["S", "A", "B", "C", "D", "E", "F"];
const GENDERS: Gender[] = ["M", "F"];
// Below `lg:`, the table (and its clickable SortHeader cells) is replaced by
// a card list with no column headers — this label set drives a compact
// sort <select> so sorting stays available, not just filtering.
const SORT_KEY_LABELS: Record<SortKey, string> = {
  name: "Name",
  skillLevel: "Skill",
  paymentStatus: "Payment",
  gender: "Gender",
  state: "State",
  gamesPlayed: "Games",
  sessionJoinedAt: "Check-in",
};
const SORT_KEYS: SortKey[] = ["name", "skillLevel", "paymentStatus", "gender", "state", "gamesPlayed", "sessionJoinedAt"];
const SKILL_ORDER: Record<SkillLevel, number> = { S: 0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };
const STATE_ORDER: Record<Source, number> = { queue: 0, bench: 1 };
// Ascending surfaces who still owes money first — the organizer's most useful default.
const PAYMENT_ORDER: Record<PaymentStatus, number> = { UNPAID: 0, WAIVED: 1, PAID: 2 };

// A single row on this page — scoped to whichever session is selected in the
// title bar. The open session is a live merge of its queue/bench (editable —
// presence IS the "status", there's no separate active/inactive concept); a
// closed session is the frozen SessionPlayerSnapshot[] captured at close time
// (read-only — same branch SessionDetailView already uses, since a snapshot
// has no live queue/bench entry behind it to mutate, no remembered queue-vs-
// bench source, and no check-in timestamp). The discriminated union keeps
// entryId/source type-safe: only reachable when editable. sessionJoinedAt is
// no longer editable-only, though — it's now captured into the frozen
// SessionPlayerSnapshot at close time (see session-store.ts's closeSession),
// so a closed row can carry a real value too. It's still nullable there
// because snapshots taken before that field existed won't have one.
type SessionPlayerRow =
  | { key: string; player: Player; editable: true; entryId: string; source: Source; sessionJoinedAt: string }
  | { key: string; player: Player; editable: false; entryId: null; source: null; sessionJoinedAt: string | null };

// null covers closed-session snapshots taken before sessionJoinedAt was
// captured — graceful degradation, not an error state.
function formatCheckinTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export interface PlayerSaveData {
  name: string;
  skillLevel: SkillLevel;
  gender?: Gender;
  notes: string;
}

function SortHeader({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onSort,
  align = "left",
  className,
  title,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
  title?: string;
}) {
  const isActive = currentKey === key;
  return (
    <th
      title={title}
      onClick={() => onSort(key)}
      role="columnheader"
      aria-sort={isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none"}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSort(key); }}
      className={cn(
        "text-xs font-medium py-2.5 whitespace-nowrap cursor-pointer select-none group",
        "transition-colors duration-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
        isActive ? "text-ink" : "text-muted hover:text-ink",
        className
      )}
    >
      <span className={cn("inline-flex items-center gap-0.5", align === "right" && "justify-end w-full")}>
        {label}
        <span
          className={cn(
            "transition-opacity duration-100",
            isActive ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-30"
          )}
        >
          {isActive && currentDir === "desc" ? (
            <ChevronDown size={10} strokeWidth={2.5} aria-hidden />
          ) : (
            <ChevronUp size={10} strokeWidth={2.5} aria-hidden />
          )}
        </span>
      </span>
    </th>
  );
}

function StateCell({ source }: { source: Source }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          source === "queue" ? "bg-primary" : "bg-border"
        )}
        aria-hidden
      />
      <span className={cn("text-xs font-medium", source === "queue" ? "text-ink" : "text-muted")}>
        {source === "queue" ? "Queued" : "Benched"}
      </span>
    </span>
  );
}

function PlayerTableRow({
  row,
  gamesPlayed,
  onClick,
  onPaymentChange,
}: {
  row: SessionPlayerRow;
  gamesPlayed: number;
  onClick: () => void;
  onPaymentChange: (status: PaymentStatus) => void;
}) {
  const { player, editable } = row;
  return (
    <tr
      onClick={editable ? onClick : undefined}
      onKeyDown={editable ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      tabIndex={editable ? 0 : undefined}
      role="row"
      aria-label={`${player.name}${row.source === "bench" ? ", benched" : ""}`}
      className={cn(
        "border-b border-border/50 transition-colors duration-100",
        editable && "cursor-pointer hover:bg-surface-elevated/40 focus-visible:outline-none focus-visible:bg-surface-elevated/40"
      )}
    >
      {/* Name */}
      <td className="pl-4 sm:pl-6 pr-3 py-3 min-w-[140px]">
        <span className="text-sm font-medium truncate text-ink">
          {player.name}
        </span>
      </td>

      {/* Skill — always */}
      <td className="px-3 py-3 w-[100px]">
        <SkillBadge level={player.skillLevel} compact />
      </td>

      {/* Payment — interactive for the live session, a plain read-out for a
          closed one (no live entry behind a snapshot to mutate). */}
      <td className="px-3 py-3 w-[190px]">
        {editable ? (
          <PaymentToggle value={player.paymentStatus} onChange={onPaymentChange} />
        ) : (
          <StatusBadge status={player.paymentStatus.toLowerCase() as "paid" | "unpaid" | "waived"} />
        )}
      </td>

      {/* Gender */}
      <td className="px-3 py-3 w-[56px]">
        {player.gender ? (
          <GenderIcon gender={player.gender} size={14} />
        ) : (
          <span className="text-xs text-border">—</span>
        )}
      </td>

      {/* State — not preserved once a session closes (the snapshot merges
          queue+bench without remembering which). */}
      <td className="px-3 py-3 w-[84px]">
        {editable ? <StateCell source={row.source} /> : <span className="text-xs text-border">—</span>}
      </td>

      {/* Games — scoped to this session */}
      <td className="px-3 py-3 w-[60px] text-right">
        <span className="font-mono text-sm tabular-nums text-muted">
          {gamesPlayed}
        </span>
      </td>

      {/* Check-in time — "—" only for closed-session snapshots taken before
          this field was captured (see SessionPlayerSnapshot.sessionJoinedAt) */}
      <td className="px-3 py-3 w-[88px] text-right">
        <span className="font-mono text-sm tabular-nums text-muted">
          {formatCheckinTime(row.sessionJoinedAt)}
        </span>
      </td>

      {/* Notes */}
      <td className="pl-3 pr-4 sm:pr-6 py-3 max-w-[140px]">
        {player.notes ? (
          <span className="block truncate text-xs text-muted" title={player.notes}>
            {player.notes}
          </span>
        ) : (
          <span className="text-xs text-border">—</span>
        )}
      </td>
    </tr>
  );
}

// Dot-separated meta line — filters out absent fields (no gender set) so the
// divider between items always lands between two real values, never orphaned.
function MetaLine({ items }: { items: React.ReactNode[] }) {
  const present = items.filter((item) => item !== null && item !== undefined && item !== false);
  return (
    <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1 text-xs text-muted">
      {present.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="text-muted/40" aria-hidden>·</span>}
          {item}
        </span>
      ))}
    </div>
  );
}

// Below `lg:`, replaces the table row — every field the table hides below
// that breakpoint (Payment, Gender, State, Games, Check-in, Notes) is shown
// here instead, vertically, rather than clipped behind a horizontal scroll.
function PlayerCard({
  row,
  gamesPlayed,
  onClick,
  onPaymentChange,
}: {
  row: SessionPlayerRow;
  gamesPlayed: number;
  onClick: () => void;
  onPaymentChange: (status: PaymentStatus) => void;
}) {
  const { player, editable } = row;
  return (
    <div
      onClick={editable ? onClick : undefined}
      onKeyDown={editable ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      tabIndex={editable ? 0 : undefined}
      role={editable ? "button" : undefined}
      aria-label={`${player.name}${row.source === "bench" ? ", benched" : ""}`}
      className={cn(
        "flex flex-col gap-2 px-4 sm:px-6 py-3 border-b border-border/50 transition-colors duration-100",
        editable && "cursor-pointer hover:bg-surface-elevated/40 focus-visible:outline-none focus-visible:bg-surface-elevated/40"
      )}
    >
      {/* Name + skill */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-ink truncate flex-1 min-w-0">{player.name}</span>
        <SkillBadge level={player.skillLevel} compact />
      </div>

      {/* Payment — interactive for the live session, a plain read-out for a
          closed one; PaymentToggle already stops its own click propagation. */}
      {editable ? (
        <PaymentToggle value={player.paymentStatus} onChange={onPaymentChange} />
      ) : (
        <StatusBadge status={player.paymentStatus.toLowerCase() as "paid" | "unpaid" | "waived"} className="self-start" />
      )}

      <MetaLine
        items={[
          player.gender && <GenderIcon gender={player.gender} />,
          editable ? <StateCell key="state" source={row.source} /> : null,
          <span key="games" className="font-mono tabular-nums">{gamesPlayed} games</span>,
          row.sessionJoinedAt && <span key="checkin" className="font-mono tabular-nums">{formatCheckinTime(row.sessionJoinedAt)}</span>,
        ]}
      />

      {player.notes && (
        <span className="block truncate text-xs text-muted" title={player.notes}>
          {player.notes}
        </span>
      )}
    </div>
  );
}

export function PlayersView() {
  const { sessions, selectedSessionId, setSelectedSessionId } = useSessionOptions();
  const currentSession = useCurrentSession();
  const archive = useSessionArchive();
  const queue = useQueueSnapshot();
  const bench = useBenchSnapshot();
  const matches = useMatchLog();

  // The open session is live and editable (a merge of its current queue +
  // bench, same as before); any other selected session is closed — its
  // players come from the frozen SessionPlayerSnapshot[] captured at close
  // time instead, which carries no live entryId/source/check-in to edit.
  // Same open-vs-closed branch SessionDetailView already uses.
  const isOpenSessionSelected = !!currentSession && currentSession.id === selectedSessionId;

  const rows = useMemo<SessionPlayerRow[]>(() => {
    if (isOpenSessionSelected) {
      return [
        ...queue.map((e) => ({ key: e.id, entryId: e.id, source: "queue" as const, player: e.player, sessionJoinedAt: e.sessionJoinedAt, editable: true as const })),
        ...bench.map((e) => ({ key: e.id, entryId: e.id, source: "bench" as const, player: e.player, sessionJoinedAt: e.sessionJoinedAt, editable: true as const })),
      ];
    }
    const record = archive.find((r) => r.id === selectedSessionId);
    if (!record) return [];
    return record.players.map((p) => ({ key: p.id, player: p, editable: false as const, entryId: null, source: null, sessionJoinedAt: p.sessionJoinedAt ?? null }));
  }, [isOpenSessionSelected, queue, bench, archive, selectedSessionId]);

  // Scoped to the selected session, not all-time — consistent with the rest
  // of this page now being session-scoped. Same COMPLETED-only rule as
  // match-log-store's useGamesPlayedMap, just filtered to one session first.
  const sessionMatches = useMemo(
    () => matches.filter((m) => m.sessionId === selectedSessionId),
    [matches, selectedSessionId]
  );
  const gamesPlayedMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const match of sessionMatches) {
      if (match.status !== "COMPLETED") continue;
      for (const p of [...match.sideA, ...match.sideB]) {
        map.set(p.id, (map.get(p.id) ?? 0) + 1);
      }
    }
    return map;
  }, [sessionMatches]);

  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState<Set<SkillLevel>>(new Set());
  const [genderFilter, setGenderFilter] = useState<Set<Gender>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<SessionPlayerRow | null>(null);
  const [headerShadow, setHeaderShadow] = useState(false);
  const { toast, showToast, dismissAndUndo } = useToast();

  useEffect(() => {
    const onScroll = () => setHeaderShadow(window.scrollY > 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hasFilters = !!search || skillFilter.size > 0 || genderFilter.size > 0;

  const filteredAndSorted = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (search && !r.player.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (skillFilter.size > 0 && !skillFilter.has(r.player.skillLevel)) return false;
      if (genderFilter.size > 0 && (!r.player.gender || !genderFilter.has(r.player.gender))) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":        cmp = a.player.name.localeCompare(b.player.name); break;
        case "skillLevel":  cmp = SKILL_ORDER[a.player.skillLevel] - SKILL_ORDER[b.player.skillLevel]; break;
        case "gender":      cmp = (a.player.gender ?? "").localeCompare(b.player.gender ?? ""); break;
        case "state":       cmp = (a.source ? STATE_ORDER[a.source] : -1) - (b.source ? STATE_ORDER[b.source] : -1); break;
        case "paymentStatus":   cmp = PAYMENT_ORDER[a.player.paymentStatus] - PAYMENT_ORDER[b.player.paymentStatus]; break;
        case "gamesPlayed":     cmp = (gamesPlayedMap.get(a.player.id) ?? 0) - (gamesPlayedMap.get(b.player.id) ?? 0); break;
        case "sessionJoinedAt": cmp = (a.sessionJoinedAt ?? "").localeCompare(b.sessionJoinedAt ?? ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, skillFilter, genderFilter, sortKey, sortDir, gamesPlayedMap]);

  const paidCount = useMemo(
    () => filteredAndSorted.filter((r) => r.player.paymentStatus === "PAID").length,
    [filteredAndSorted]
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSkillFilter(level: SkillLevel) {
    setSkillFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }

  function toggleGenderFilter(gender: Gender) {
    setGenderFilter((prev) => {
      const next = new Set(prev);
      if (next.has(gender)) {
        next.delete(gender);
      } else {
        next.add(gender);
      }
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setSkillFilter(new Set());
    setGenderFilter(new Set());
  }

  function handleEdit(row: SessionPlayerRow) {
    // Closed-session rows have no click handler wired in PlayerTableRow/
    // PlayerCard, so this shouldn't fire for one in practice — guard stays
    // for type-narrowing (entryId/source below need the editable branch).
    if (!row.editable) return;
    setEditingRow(row);
    setDrawerOpen(true);
  }

  function handleClose() {
    setDrawerOpen(false);
    setTimeout(() => setEditingRow(null), 220);
  }

  function handleSave(data: PlayerSaveData) {
    // Players page no longer has an add-player entry point (see AddPlayersModal
    // on the Dashboard) — the drawer only ever opens via handleEdit now, so
    // editingRow is always set (and editable — handleEdit guards on entry) by
    // the time a save happens. Guard stays for type-narrowing.
    if (!editingRow || !editingRow.editable) return;
    // The queue/bench stores sync cross-tab (storage events) — if another
    // tab closed this session while the drawer was open here, the live entry
    // is already gone. updateQueuePlayer/updateBenchPlayer would silently
    // no-op on a missing id, closing the drawer as if the save succeeded
    // when nothing actually happened. Catch it explicitly instead.
    if (!isOpenSessionSelected) {
      showToast("This session was closed elsewhere — nothing saved");
      return;
    }
    const patch = {
      name: data.name,
      skillLevel: data.skillLevel,
      gender: data.gender,
      notes: data.notes || undefined,
    };
    if (editingRow.source === "queue") {
      updateQueuePlayer(editingRow.entryId, patch);
    } else {
      updateBenchPlayer(editingRow.entryId, patch);
    }
  }

  function handlePaymentChange(row: SessionPlayerRow, status: PaymentStatus) {
    // Same reasoning as handleEdit — PaymentToggle only renders (and can only
    // fire onChange) for editable rows; StatusBadge replaces it otherwise.
    if (!row.editable) return;
    // Same cross-tab race as handleSave — the row was editable when this
    // render started, but the session may have closed elsewhere since.
    if (!isOpenSessionSelected) {
      showToast("This session was closed elsewhere — nothing saved");
      return;
    }
    if (row.source === "queue") {
      updateQueuePlayer(row.entryId, { paymentStatus: status });
    } else {
      updateBenchPlayer(row.entryId, { paymentStatus: status });
    }
  }

  function handleRemove() {
    if (!editingRow || !editingRow.editable) return;
    // Same cross-tab race as handleSave.
    if (!isOpenSessionSelected) {
      showToast("This session was closed elsewhere — nothing to remove");
      return;
    }
    const { entryId, source, player } = editingRow;
    if (source === "queue") {
      const removed = removeQueueEntry(entryId);
      if (removed) {
        showToast(
          `Removed ${player.name.split(" ")[0]} from the session`,
          () => restoreQueueEntry(removed),
          "Undo remove from session"
        );
      }
    } else {
      const removed = removeBenchEntry(entryId);
      if (removed) {
        showToast(
          `Removed ${player.name.split(" ")[0]} from the session`,
          () => restoreBenchEntry(removed),
          "Undo remove from session"
        );
      }
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex items-center px-4 sm:px-6 min-h-[56px] pt-[env(safe-area-inset-top)] border-b border-border">
          <h1 className="text-lg font-semibold text-ink">Players</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <p className="text-sm text-muted">No sessions yet</p>
          <p className="text-xs text-muted mt-1">Start your first session from the Dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col min-h-full">
        {/* ── Sticky title + filter bar ────────────────────── */}
        <div
          className={cn(
            "sticky top-0 z-[var(--z-sticky)] pt-[env(safe-area-inset-top)] transition-colors duration-200",
            // Dark mode reads elevation as surface lightness, not shadow color
            // (a black shadow blur is nearly invisible on a near-black bg) —
            // surface-elevated already IS this app's lighter-elevation step in
            // dark mode, and a legible tint-darker step in light mode, so one
            // token covers the "scrolled, lifted header" cue in both themes.
            headerShadow ? "bg-surface-elevated shadow-[0_1px_0_var(--color-border)]" : "bg-bg"
          )}
        >
          {/* Title bar — SessionSelect sits here, not the filter bar below,
              matching Matches/Leaderboard: it changes which dataset this page
              shows, not how the same dataset is displayed. */}
          <div className="flex items-center gap-2.5 px-4 sm:px-6 h-14 border-b border-border">
            <h1 className="text-base font-semibold text-ink">Players</h1>
            <span className="font-mono text-xs text-muted tabular-nums">
              ({filteredAndSorted.length})
            </span>
            {filteredAndSorted.length > 0 && (
              <span className="text-xs text-muted">
                <span className="font-mono tabular-nums text-success">{paidCount}</span> paid
              </span>
            )}
            <div className="ml-auto">
              <SessionSelect sessions={sessions} value={selectedSessionId} onChange={setSelectedSessionId} />
            </div>
          </div>

          {/* Filter bar — wraps by group (search / sort / skill / gender)
              instead of scrolling horizontally. Each group is a single flex
              item with no internal wrap, so flex-wrap always breaks between
              whole groups, never mid-group. */}
          <div className="px-4 sm:px-6 py-2.5 border-b border-border flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Search */}
            <div className="relative flex-shrink-0 w-[160px] sm:w-[188px]">
              <Search
                size={12}
                strokeWidth={2}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface border border-border rounded-md pl-7 pr-7 py-1.5 text-base lg:text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors duration-150 h-10 lg:h-8"
                aria-label="Search players by name"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors focus-visible:outline-none rounded"
                  aria-label="Clear search"
                >
                  <X size={11} strokeWidth={2.5} aria-hidden />
                </button>
              )}
            </div>

            {/* Sort — below `lg:` only. The table's clickable column headers
                (SortHeader) sort at lg+; below that the card list has no
                headers, so sorting needs its own compact control instead of
                silently disappearing. */}
            <div className="lg:hidden flex items-center gap-1 flex-shrink-0">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                aria-label="Sort players by"
                className="bg-surface border border-border rounded-md pl-2 pr-6 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors duration-150 h-10"
              >
                {SORT_KEYS.map((key) => (
                  <option key={key} value={key}>{SORT_KEY_LABELS[key]}</option>
                ))}
              </select>
              <button
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                aria-label={sortDir === "asc" ? "Sort ascending, click for descending" : "Sort descending, click for ascending"}
                className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md border border-border text-muted hover:text-ink hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {sortDir === "asc" ? (
                  <ChevronUp size={13} strokeWidth={2.5} aria-hidden />
                ) : (
                  <ChevronDown size={13} strokeWidth={2.5} aria-hidden />
                )}
              </button>
            </div>

            <div className="hidden lg:block h-4 w-px bg-border/60 flex-shrink-0" aria-hidden />

            {/* Skill filter chips */}
            <div
              className="flex items-center gap-0.5 flex-shrink-0"
              role="group"
              aria-label="Filter by skill level"
            >
              {SKILL_LEVELS.map((level) => {
                const active = skillFilter.has(level);
                return (
                  <button
                    key={level}
                    onClick={() => toggleSkillFilter(level)}
                    aria-pressed={active}
                    aria-label={`${active ? "Remove" : "Add"} ${SKILL_LABELS[level]} filter`}
                    title={SKILL_LABELS[level]}
                    className={cn(
                      "h-7 px-2 flex items-center justify-center rounded-sm text-[10px] font-semibold flex-shrink-0 whitespace-nowrap",
                      "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      active
                        ? "bg-surface-elevated text-ink border border-border ring-1 ring-primary/50"
                        : "text-muted hover:bg-surface-elevated hover:text-ink"
                    )}
                  >
                    {SKILL_LABELS_SHORT[level]}
                  </button>
                );
              })}
            </div>

            <div className="hidden lg:block h-4 w-px bg-border/60 flex-shrink-0" aria-hidden />

            {/* Gender filter chips */}
            <div
              className="flex items-center gap-0.5 flex-shrink-0"
              role="group"
              aria-label="Filter by gender"
            >
              {GENDERS.map((gender) => {
                const active = genderFilter.has(gender);
                const label = gender === "M" ? "Male" : "Female";
                return (
                  <button
                    key={gender}
                    onClick={() => toggleGenderFilter(gender)}
                    aria-pressed={active}
                    aria-label={`${active ? "Remove" : "Add"} ${label} filter`}
                    className={cn(
                      "h-7 px-2 flex items-center justify-center rounded-sm text-[11px] font-medium flex-shrink-0",
                      "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      active
                        ? "bg-surface-elevated text-ink border border-border ring-1 ring-primary/50"
                        : "text-muted hover:bg-surface-elevated hover:text-ink"
                    )}
                  >
                    {gender}
                  </button>
                );
              })}
            </div>

            {/* Clear */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-primary hover:text-primary-hover transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1 h-7 lg:ml-auto"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Table (lg+) / Cards (below lg) ───────────────────── */}
        {filteredAndSorted.length > 0 ? (
          <>
          <table className="hidden lg:table w-full border-collapse" role="grid" aria-label="Players roster">
              {/* Sticky thead — sits directly below the 109px sticky header, plus
                  whatever the notch/status bar's safe-area inset adds on top
                  of that (0 on non-notched devices, so this is a no-op there). */}
              <thead className={cn("sticky top-[calc(109px+env(safe-area-inset-top))] z-[var(--z-sticky)] transition-colors duration-200", headerShadow ? "bg-surface-elevated" : "bg-bg")}>
                <tr className="border-b border-border">
                  <SortHeader
                    label="Name"
                    sortKey="name"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="pl-4 sm:pl-6 pr-3"
                  />
                  <SortHeader
                    label="Skill"
                    sortKey="skillLevel"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="px-3 w-[100px]"
                  />
                  <SortHeader
                    label="Payment"
                    sortKey="paymentStatus"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="px-3 w-[190px]"
                    title="Paid, unpaid, or waived for this session"
                  />
                  <SortHeader
                    label="Gender"
                    sortKey="gender"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="px-3 w-[56px]"
                  />
                  <SortHeader
                    label="State"
                    sortKey="state"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="px-3 w-[84px]"
                    title="Queued or benched right now"
                  />
                  <SortHeader
                    label="Games"
                    sortKey="gamesPlayed"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    align="right"
                    className="px-3 w-[60px]"
                    title="Games played this session"
                  />
                  <SortHeader
                    label="Check-in"
                    sortKey="sessionJoinedAt"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    align="right"
                    className="px-3 w-[88px]"
                    title="Time player checked into this session"
                  />
                  <th className="text-left text-xs font-medium text-muted pl-3 pr-4 sm:pr-6 py-2.5 whitespace-nowrap">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((row) => (
                  <PlayerTableRow
                    key={row.key}
                    row={row}
                    gamesPlayed={gamesPlayedMap.get(row.player.id) ?? 0}
                    onClick={() => handleEdit(row)}
                    onPaymentChange={(status) => handlePaymentChange(row, status)}
                  />
                ))}
              </tbody>
          </table>

          {/* Cards — below lg, replaces the table (and its hidden columns)
              with every field visible, stacked vertically. */}
          <div className="lg:hidden" role="list" aria-label="Players roster">
            {filteredAndSorted.map((row) => (
              <PlayerCard
                key={row.key}
                row={row}
                gamesPlayed={gamesPlayedMap.get(row.player.id) ?? 0}
                onClick={() => handleEdit(row)}
                onPaymentChange={(status) => handlePaymentChange(row, status)}
              />
            ))}
          </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            {hasFilters ? (
              <>
                <p className="text-sm text-muted">No players match these filters</p>
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary hover:text-primary-hover mt-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
                >
                  Clear filters
                </button>
              </>
            ) : isOpenSessionSelected ? (
              <>
                <p className="text-sm text-muted">No players in this session yet</p>
                <p className="text-xs text-muted mt-1">Add players from the Dashboard to get started</p>
              </>
            ) : (
              <p className="text-sm text-muted">No players recorded for this session</p>
            )}
          </div>
        )}
      </div>

      <PlayerDrawer
        isOpen={drawerOpen}
        editingPlayer={editingRow?.player ?? null}
        onClose={handleClose}
        onSave={handleSave}
        onRemove={handleRemove}
      />

      <ToastViewport toast={toast} onDismissAndUndo={dismissAndUndo} />
    </>
  );
}
