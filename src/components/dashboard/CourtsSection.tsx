import type { Court, MatchResult } from "@/types";
import type { MenuPoint, PlayerMenuTarget } from "./PlayerMenu";
import type { CourtSlotAddress } from "./DashboardClient";
import type { Endpoint } from "@/lib/roster-swap";
import { CourtCard } from "./CourtCard";
import { cn } from "@/lib/utils";

interface Props {
  courts: Court[];
  isDragging?: boolean;
  cols?: 1 | 2;
  horizontal?: boolean;
  onCourtDrop?: (courtId: string) => void;
  onAdd?: () => void;
  onDelete?: (id: string) => void;
  onEndMatch?: (courtId: string, result: MatchResult) => void;
  onVoidMatch?: (courtId: string) => void;
  hasArmedSelection?: boolean;
  armedCourtSlot?: CourtSlotAddress | null;
  onEndpointDrop?: (from: Endpoint, to: Endpoint) => void;
  onCourtSlotTap?: (courtId: string, side: "A" | "B", index: number) => void;
  onCancelSelection?: () => void;
  onOpenPlayerMenu?: (target: PlayerMenuTarget, point: MenuPoint) => void;
}

export function CourtsSection({
  courts,
  isDragging = false,
  cols = 2,
  horizontal = false,
  onCourtDrop,
  onAdd,
  onDelete,
  onEndMatch,
  onVoidMatch,
  hasArmedSelection,
  armedCourtSlot,
  onEndpointDrop,
  onCourtSlotTap,
  onCancelSelection,
  onOpenPlayerMenu,
}: Props) {
  return (
    <section
      aria-label="Courts"
      className={cn(
        "flex flex-col rounded-lg border border-border bg-surface overflow-hidden",
        !horizontal && "h-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-2 flex-shrink-0 border-b border-border">
        <h2 className="flex items-baseline gap-1.5 text-sm font-semibold text-ink">
          Courts
          <span className="font-mono text-xs text-muted font-normal tabular-nums">
            ({courts.length})
          </span>
        </h2>

        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs font-medium text-primary bg-surface-elevated hover:bg-primary/[0.07] px-2 py-1.5 rounded-sm border border-primary/25 hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Add a court"
        >
          Add
        </button>
      </div>

      {/* Body */}
      {courts.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center text-center px-4 py-8",
            !horizontal && "flex-1"
          )}
        >
          <p className="text-sm text-muted">No courts set up</p>
          <p className="text-xs text-muted/60 mt-1">Add courts to get started</p>
        </div>
      ) : horizontal ? (
        <div className="relative">
          <div className="overflow-x-auto p-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex gap-3 snap-x snap-mandatory">
              {courts.map((court) => (
                <div key={court.id} className="flex-none w-44 snap-start">
                  <CourtCard
                    court={court}
                    isDragging={isDragging}
                    onDrop={onCourtDrop}
                    onDelete={onDelete}
                    onEndMatch={onEndMatch}
                    onVoidMatch={onVoidMatch}
                    hasArmedSelection={hasArmedSelection}
                    armedCourtSlot={armedCourtSlot}
                    onEndpointDrop={onEndpointDrop}
                    onSlotTap={onCourtSlotTap}
                    onOpenPlayerMenu={
                      onOpenPlayerMenu
                        ? (playerId, point) => onOpenPlayerMenu({ where: "court", playerId }, point)
                        : undefined
                    }
                    onCancelSelection={onCancelSelection}
                  />
                </div>
              ))}
            </div>
          </div>
          {/* Right-edge scroll fade — communicates horizontal scrollability */}
          <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-surface to-transparent pointer-events-none" aria-hidden />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
          <div
            className={cn(
              "grid gap-3",
              // `cols={2}` means "two-up once there's room", not always two. The
              // second column starts at `xl:`, not `lg:`: at a 1024px viewport the
              // courts panel is ~557px, and splitting that gives 262px cards — too
              // narrow for the wide card's two halves. One 537px card reads far
              // better there. This same instance also renders the mobile list.
              cols === 1 ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2"
            )}
          >
            {courts.map((court) => (
              <CourtCard
                key={court.id}
                court={court}
                isDragging={isDragging}
                onDrop={onCourtDrop}
                onDelete={onDelete}
                onEndMatch={onEndMatch}
                onVoidMatch={onVoidMatch}
                hasArmedSelection={hasArmedSelection}
                armedCourtSlot={armedCourtSlot}
                onEndpointDrop={onEndpointDrop}
                onSlotTap={onCourtSlotTap}
                    onOpenPlayerMenu={
                      onOpenPlayerMenu
                        ? (playerId, point) => onOpenPlayerMenu({ where: "court", playerId }, point)
                        : undefined
                    }
                onCancelSelection={onCancelSelection}
                variant="wide"
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
