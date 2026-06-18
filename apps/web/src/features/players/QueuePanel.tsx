import { Tabs } from "../../components/ui/tabs.js";
import { PlayerRow } from "../../components/domain/player-row.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import type { LocalCheckIn, LocalSession } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";
import type { PaymentStatus } from "../../components/domain/payment-badge.js";

const TAB_STATUSES = ["waiting", "resting", "done", "removed"] as const;

export interface QueuePanelProps {
  session: LocalSession;
  checkIns: LocalCheckIn[];
  sessionMode: SessionMode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onUpdateCheckIn: (input: {
    checkInId: string;
    queueStatus?: LocalCheckIn["queueStatus"];
    suggestionExcluded?: boolean;
    suggestionExcludeNote?: string | null;
  }) => Promise<void>;
  onOpenPlayerDetails?: (checkInId: string) => void;
}

export function QueuePanel({
  session,
  checkIns,
  sessionMode,
  activeTab = "waiting",
  onTabChange,
  onUpdateCheckIn,
  onOpenPlayerDetails,
}: QueuePanelProps) {
  const poolCheckIns = checkIns.filter(
    (checkIn) => checkIn.queueStatus !== "assigned" && checkIn.queueStatus !== "playing",
  );

  const tabs = TAB_STATUSES.map((status) => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
    content: (
      <QueueTab
        status={status}
        checkIns={poolCheckIns.filter((checkIn) => checkIn.queueStatus === status)}
        session={session}
        sessionMode={sessionMode}
        onUpdateCheckIn={onUpdateCheckIn}
        onOpenPlayerDetails={onOpenPlayerDetails}
      />
    ),
  }));

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="text-title font-semibold">Available players</h2>
      <div className="mt-3">
        <Tabs items={tabs} defaultValue={activeTab} />
      </div>
    </section>
  );
}

function QueueTab({
  status,
  checkIns,
  session,
  sessionMode,
  onUpdateCheckIn,
  onOpenPlayerDetails,
}: {
  status: (typeof TAB_STATUSES)[number];
  checkIns: LocalCheckIn[];
  session: LocalSession;
  sessionMode: SessionMode;
  onUpdateCheckIn: QueuePanelProps["onUpdateCheckIn"];
  onOpenPlayerDetails?: (checkInId: string) => void;
}) {
  if (checkIns.length === 0) {
    return <EmptyState title={`No ${status} players`} />;
  }

  return (
    <ul className="divide-y divide-border">
      {checkIns.map((checkIn) => {
        const actions =
          sessionMode === "live"
            ? buildActions(status, checkIn, onUpdateCheckIn)
            : [];
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
  tabStatus: (typeof TAB_STATUSES)[number],
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
