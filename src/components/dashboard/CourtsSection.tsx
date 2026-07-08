import type { Court, MatchResult } from "@/types";
import { CourtCard } from "./CourtCard";
import { cn } from "@/lib/utils";
import { Grid3X3, Plus } from "lucide-react";

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
      <div className="flex items-center justify-between px-3 pt-3 pb-2.5 flex-shrink-0 border-b border-border">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Grid3X3 size={15} strokeWidth={2} className="text-muted" aria-hidden />
          Courts
          <span className="font-mono text-xs text-muted font-normal tabular-nums">
            ({courts.length})
          </span>
        </h2>

        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-muted hover:text-ink hover:bg-surface-elevated transition-colors px-2 py-1.5 rounded-sm border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px]"
          aria-label="Add a court"
        >
          <Plus size={12} strokeWidth={2.5} aria-hidden />
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
                  />
                </div>
              ))}
            </div>
          </div>
          {/* Right-edge scroll fade — communicates horizontal scrollability */}
          <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-surface to-transparent pointer-events-none" aria-hidden />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <div className={`grid gap-3 ${cols === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {courts.map((court) => (
              <CourtCard
                key={court.id}
                court={court}
                isDragging={isDragging}
                onDrop={onCourtDrop}
                onDelete={onDelete}
                onEndMatch={onEndMatch}
                onVoidMatch={onVoidMatch}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
