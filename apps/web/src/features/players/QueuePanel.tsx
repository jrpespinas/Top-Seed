import { useMemo, useState } from "react";
import { Tabs } from "../../components/ui/tabs.js";
import { FilterChips } from "../../components/ui/filter-chips.js";
import { PlayerCard } from "../../components/domain/player-card.js";
import { PlayerRow } from "../../components/domain/player-row.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import type { LocalCheckIn, LocalMatch, LocalQueuedMatch, LocalSession } from "../../db/types.js";
import { countPlayerWinsInSession } from "../../lib/session-stats.js";
import type { SessionMode } from "../../components/domain/types.js";
import type { PaymentStatus } from "../../components/domain/payment-badge.js";

const TAB_STATUSES = ["waiting", "resting", "done", "removed"] as const;
const FILTER_CHIPS = ["all", "available", "queued", "playing"] as const;
type FilterChip = (typeof FILTER_CHIPS)[number];

export interface QueuePanelProps {
  session: LocalSession;
  checkIns: LocalCheckIn[];
  queuedMatches?: LocalQueuedMatch[];
  matches?: LocalMatch[];
  sessionMode: SessionMode;
  layout?: "default" | "pegboard";
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onUpdateCheckIn: (input: {
    checkInId: string;
    queueStatus?: LocalCheckIn["queueStatus"];
    suggestionExcluded?: boolean;
    suggestionExcludeNote?: string | null;
  }) => Promise<void>;
  onOpenPlayerDetails?: (checkInId: string) => void;
  dndEnabled?: boolean;
}

function filterByChip(checkIns: LocalCheckIn[], chip: FilterChip): LocalCheckIn[] {
  switch (chip) {
    case "available":
      return checkIns.filter((c) => c.queueStatus === "waiting" || c.queueStatus === "resting");
    case "queued":
      return checkIns.filter((c) => c.queueStatus === "assigned");
    case "playing":
      return checkIns.filter((c) => c.queueStatus === "playing");
    default:
      return checkIns.filter((c) => c.queueStatus !== "removed");
  }
}

function queuePositionFor(
  checkInId: string,
  queuedMatches: LocalQueuedMatch[] | undefined,
): number | undefined {
  if (!queuedMatches) {
    return undefined;
  }
  const active = queuedMatches.filter((m) => m.status === "draft" || m.status === "ready");
  for (let index = 0; index < active.length; index += 1) {
    const match = active[index];
    if (match?.participants.some((p) => p.checkInId === checkInId)) {
      return index + 1;
    }
  }
  return undefined;
}

export function QueuePanel({
  session,
  checkIns,
  queuedMatches,
  matches = [],
  sessionMode,
  layout = "default",
  activeTab = "waiting",
  onTabChange,
  onUpdateCheckIn,
  onOpenPlayerDetails,
  dndEnabled = false,
}: QueuePanelProps) {
  const [filterChip, setFilterChip] = useState<FilterChip>("all");

  const poolCheckIns = checkIns.filter(
    (checkIn) => checkIn.queueStatus !== "assigned" && checkIn.queueStatus !== "playing",
  );

  const chipCounts = useMemo(() => {
    const active = checkIns.filter((c) => c.queueStatus !== "removed");
    return {
      all: active.length,
      available: active.filter((c) => c.queueStatus === "waiting" || c.queueStatus === "resting").length,
      queued: active.filter((c) => c.queueStatus === "assigned").length,
      playing: active.filter((c) => c.queueStatus === "playing").length,
    };
  }, [checkIns]);

  if (layout === "pegboard") {
    const filtered = filterByChip(checkIns, filterChip);
    return (
      <div className="space-y-2">
        <FilterChips
          value={filterChip}
          onChange={(value) => setFilterChip(value as FilterChip)}
          options={[
            { value: "all", label: "All", count: chipCounts.all },
            { value: "available", label: "Available", count: chipCounts.available },
            { value: "queued", label: "Queued", count: chipCounts.queued },
            { value: "playing", label: "Playing", count: chipCounts.playing },
          ]}
        />
        <PegboardList
          checkIns={filtered}
          session={session}
          sessionMode={sessionMode}
          queuedMatches={queuedMatches}
          matches={matches}
          dndEnabled={dndEnabled}
          onUpdateCheckIn={onUpdateCheckIn}
          onOpenPlayerDetails={onOpenPlayerDetails}
        />
      </div>
    );
  }

  const tabs = TAB_STATUSES.map((status) => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
    content: (
      <QueueTab
        status={status}
        checkIns={poolCheckIns.filter((checkIn) => checkIn.queueStatus === status)}
        totalCheckedIn={checkIns.filter((c) => c.queueStatus !== "removed").length}
        session={session}
        sessionMode={sessionMode}
        onUpdateCheckIn={onUpdateCheckIn}
        onOpenPlayerDetails={onOpenPlayerDetails}
      />
    ),
  }));

  return (
    <section className="rounded-card border border-border bg-surface p-4 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
      <h2 className="text-title font-semibold lg:hidden">Available players</h2>
      <div className="mt-3">
        <Tabs items={tabs} defaultValue={activeTab} />
      </div>
    </section>
  );
}

function PegboardList({
  checkIns,
  session,
  sessionMode,
  queuedMatches,
  matches = [],
  dndEnabled,
  onUpdateCheckIn,
  onOpenPlayerDetails,
}: {
  checkIns: LocalCheckIn[];
  session: LocalSession;
  sessionMode: SessionMode;
  queuedMatches?: LocalQueuedMatch[];
  matches?: LocalMatch[];
  dndEnabled?: boolean;
  onUpdateCheckIn: QueuePanelProps["onUpdateCheckIn"];
  onOpenPlayerDetails?: (checkInId: string) => void;
}) {
  if (checkIns.length === 0) {
    return (
      <EmptyState
        title="No players in this filter"
        description="Try another filter or check in more players."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {checkIns.map((checkIn) => {
        const actions =
          sessionMode === "live"
            ? buildActions(checkIn.queueStatus as (typeof TAB_STATUSES)[number] | "assigned" | "playing", checkIn, onUpdateCheckIn)
            : [];
        return (
          <li key={checkIn.id}>
            <PlayerCard
              player={{ id: checkIn.playerProfileId, displayName: checkIn.playerDisplayName }}
              checkInId={checkIn.id}
              checkIn={{
                queueStatus: checkIn.queueStatus,
                sessionSkillRating: checkIn.sessionSkillRating,
                checkedInAt: checkIn.checkedInAt,
                matchesPlayed: checkIn.matchesPlayedInSession,
                wins: countPlayerWinsInSession(checkIn.playerProfileId, matches),
                suggestionExcluded: checkIn.suggestionExcluded,
              }}
              draggable={dndEnabled}
              payment={{
                status: checkIn.paymentStatus as PaymentStatus,
                amountDue: checkIn.paymentAmountDue,
                amountPaid: checkIn.paymentAmountPaid,
                currency: session.currency,
              }}
              queuePosition={queuePositionFor(checkIn.id, queuedMatches)}
              sessionMode={sessionMode}
              actions={actions}
              onOpenPlayerDetails={
                onOpenPlayerDetails ? () => onOpenPlayerDetails(checkIn.id) : undefined
              }
              onRemove={
                sessionMode === "live" &&
                (checkIn.queueStatus === "waiting" || checkIn.queueStatus === "resting")
                  ? () => void onUpdateCheckIn({ checkInId: checkIn.id, queueStatus: "removed" })
                  : undefined
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

function QueueTab({
  status,
  checkIns,
  totalCheckedIn,
  session,
  sessionMode,
  onUpdateCheckIn,
  onOpenPlayerDetails,
}: {
  status: (typeof TAB_STATUSES)[number];
  checkIns: LocalCheckIn[];
  totalCheckedIn: number;
  session: LocalSession;
  sessionMode: SessionMode;
  onUpdateCheckIn: QueuePanelProps["onUpdateCheckIn"];
  onOpenPlayerDetails?: (checkInId: string) => void;
}) {
  if (status === "waiting" && totalCheckedIn === 0) {
    return (
      <EmptyState
        title="Check in your first players"
        description="Search returning players or add a walk-in to start the queue."
      />
    );
  }

  if (checkIns.length === 0) {
    if (status === "waiting") {
      return (
        <EmptyState
          title="No one waiting"
          description="Players may be on court, in Next, or marked resting."
        />
      );
    }
    return <EmptyState title={`No ${status} players`} />;
  }

  return (
    <ul className="divide-y divide-border">
      {checkIns.map((checkIn) => {
        const actions =
          sessionMode === "live" ? buildActions(status, checkIn, onUpdateCheckIn) : [];
        return (
          <li key={checkIn.id}>
            <PlayerRow
              player={{ id: checkIn.playerProfileId, displayName: checkIn.playerDisplayName }}
              checkIn={{
                queueStatus: checkIn.queueStatus,
                sessionSkillRating: checkIn.sessionSkillRating,
                checkedInAt: checkIn.checkedInAt,
                matchesPlayed: checkIn.matchesPlayedInSession,
                suggestionExcluded: checkIn.suggestionExcluded,
              }}
              payment={{
                status: checkIn.paymentStatus as PaymentStatus,
                amountDue: checkIn.paymentAmountDue,
                amountPaid: checkIn.paymentAmountPaid,
                currency: session.currency,
              }}
              sessionMode={sessionMode}
              actions={actions}
              onOpenPlayerDetails={
                onOpenPlayerDetails ? () => onOpenPlayerDetails(checkIn.id) : undefined
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

function buildActions(
  tabStatus: (typeof TAB_STATUSES)[number] | "assigned" | "playing",
  checkIn: LocalCheckIn,
  onUpdateCheckIn: QueuePanelProps["onUpdateCheckIn"],
) {
  const actions: { label: string; onSelect: () => void; destructive?: boolean }[] = [];

  if (tabStatus === "waiting" || tabStatus === "resting") {
    actions.push({
      label: checkIn.suggestionExcluded ? "Clear skip" : "Skip suggestions",
      onSelect: () =>
        void onUpdateCheckIn({
          checkInId: checkIn.id,
          suggestionExcluded: !checkIn.suggestionExcluded,
        }),
    });
  }

  if (tabStatus === "waiting") {
    actions.push(
      {
        label: "Mark resting",
        onSelect: () => void onUpdateCheckIn({ checkInId: checkIn.id, queueStatus: "resting" }),
      },
      {
        label: "Mark done",
        onSelect: () => void onUpdateCheckIn({ checkInId: checkIn.id, queueStatus: "done" }),
      },
      {
        label: "Remove",
        onSelect: () => void onUpdateCheckIn({ checkInId: checkIn.id, queueStatus: "removed" }),
        destructive: true,
      },
    );
  }

  if (tabStatus === "resting") {
    actions.push({
      label: "Back to waiting",
      onSelect: () => void onUpdateCheckIn({ checkInId: checkIn.id, queueStatus: "waiting" }),
    });
  }

  if (tabStatus === "removed") {
    actions.push({
      label: "Restore",
      onSelect: () => void onUpdateCheckIn({ checkInId: checkIn.id, queueStatus: "waiting" }),
    });
  }

  return actions;
}
