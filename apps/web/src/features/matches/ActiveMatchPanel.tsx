import { Button } from "../../components/ui/button.js";
import { ConfirmAction } from "../../components/ui/confirm-action.js";
import { Dialog, DialogContent } from "../../components/ui/dialog.js";
import type { LocalMatch, LocalSession } from "../../db/types.js";
import type { MatchResultInput } from "@top-seed/contracts";

export interface ActiveMatchPanelProps {
  open: boolean;
  session: LocalSession;
  match: LocalMatch | null;
  onClose: () => void;
  onComplete: (result: MatchResultInput) => Promise<void>;
  onCancel: () => Promise<void>;
}

export function ActiveMatchPanel({
  open,
  session,
  match,
  onClose,
  onComplete,
  onCancel,
}: ActiveMatchPanelProps) {
  if (!match) {
    return null;
  }

  const isRated = session.ratingMode === "rated";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title="Record match result"
        description={
          isRated
            ? "Wins and draws may update ratings in rated mode."
            : "Results update session stats but not ratings in casual mode."
        }
      >
        <div className="flex flex-col gap-2">
          <Button
            onClick={() =>
              void onComplete({ outcome: "team_one_win", winningTeam: "team_one" }).then(onClose)
            }
          >
            Team A wins
          </Button>
          <Button
            onClick={() =>
              void onComplete({ outcome: "team_two_win", winningTeam: "team_two" }).then(onClose)
            }
          >
            Team B wins
          </Button>
          <Button variant="secondary" onClick={() => void onComplete({ outcome: "draw" }).then(onClose)}>
            Draw
          </Button>
          <Button
            variant="secondary"
            onClick={() => void onComplete({ outcome: "unscored" }).then(onClose)}
          >
            Unscored
          </Button>
          <ConfirmAction
            triggerLabel="Cancel match"
            title="Cancel this match?"
            description="Cancelled matches do not affect ratings."
            confirmLabel="Cancel match"
            variant="danger"
            onConfirm={async () => {
              await onCancel();
              onClose();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
