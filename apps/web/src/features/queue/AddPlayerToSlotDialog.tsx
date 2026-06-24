import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "../../components/ui/dialog.js";
import { SearchInput } from "../../components/ui/search-input.js";
import { PlayerRow } from "../../components/domain/player-row.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import { displayNameForCheckIn } from "../../lib/dashboard-helpers.js";
import type { LocalCheckIn } from "../../db/types.js";
import type { QueuedMatchSlotOrder, QueuedMatchTeam } from "../../lib/queued-match-participants.js";

export interface AddPlayerToSlotDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  team: QueuedMatchTeam;
  slotOrder: QueuedMatchSlotOrder;
  checkIns: LocalCheckIn[];
  excludedCheckInIds: Set<string>;
  onSelect: (checkInId: string) => void;
}

const teamLabels: Record<QueuedMatchTeam, string> = {
  team_one: "Team A",
  team_two: "Team B",
};

export function AddPlayerToSlotDialog({
  isOpen,
  onOpenChange,
  team,
  slotOrder,
  checkIns,
  excludedCheckInIds,
  onSelect,
}: AddPlayerToSlotDialogProps) {
  const [query, setQuery] = useState("");

  const eligible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return checkIns.filter((checkIn) => {
      if (checkIn.queueStatus !== "waiting" && checkIn.queueStatus !== "resting") {
        return false;
      }
      if (excludedCheckInIds.has(checkIn.id)) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      const name = displayNameForCheckIn(checkIn.id, checkIns).toLowerCase();
      return name.includes(normalized);
    });
  }, [checkIns, excludedCheckInIds, query]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Add player — ${teamLabels[team]} slot ${slotOrder}`}
        description="Choose a waiting or resting player."
      >
        <SearchInput
          id="add-player-to-slot-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search players"
          aria-label="Search players"
        />
        {eligible.length > 0 ? (
          <ul className="mt-3 max-h-64 divide-y divide-border overflow-y-auto rounded-control border border-border">
            {eligible.map((checkIn) => (
              <li key={checkIn.id}>
                <PlayerRow
                  player={{
                    id: checkIn.playerProfileId,
                    displayName: displayNameForCheckIn(checkIn.id, checkIns),
                  }}
                  variant="search"
                  actions={[
                    {
                      label: "Add to slot",
                      onSelect: () => {
                        onSelect(checkIn.id);
                        onOpenChange(false);
                        setQuery("");
                      },
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No available players"
            description="Check in more players or free a slot in this match."
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
