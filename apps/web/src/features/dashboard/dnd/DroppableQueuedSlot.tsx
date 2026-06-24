import { useDroppable } from "@dnd-kit/core";
import { useDndContext } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { cn } from "../../../lib/cn.js";
import type { QueuedMatchSlotOrder, QueuedMatchTeam } from "../../../lib/queued-match-participants.js";
import { parseDragId, queuedSlotDropId } from "./drag-types.js";

export interface DroppableQueuedSlotProps {
  sessionId: string;
  queuedMatchId: string;
  team: QueuedMatchTeam;
  slotOrder: QueuedMatchSlotOrder;
  enabled: boolean;
  occupied?: boolean;
  occupantCheckInId?: string;
  variant?: "queued" | "queuedIncomplete";
  className?: string;
  children: ReactNode;
}

export function DroppableQueuedSlot({
  sessionId,
  queuedMatchId,
  team,
  slotOrder,
  enabled,
  occupied = false,
  occupantCheckInId,
  variant,
  className,
  children,
}: DroppableQueuedSlotProps) {
  const { active } = useDndContext();
  const { isOver, setNodeRef } = useDroppable({
    id: queuedSlotDropId(queuedMatchId, team, slotOrder),
    disabled: !enabled,
  });

  const activeDrag = active ? parseDragId(String(active.id), sessionId) : null;
  const acceptsPlayer = !occupied && activeDrag?.kind === "player";
  const acceptsQueuedPlayer =
    activeDrag?.kind === "queued-player" &&
    activeDrag.queuedMatchId === queuedMatchId &&
    activeDrag.checkInId !== occupantCheckInId;
  const acceptsDrop = acceptsPlayer || acceptsQueuedPlayer;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-control transition-colors",
        occupied
          ? "border border-transparent bg-transparent p-0"
          : "border border-dashed border-border/80 bg-muted/30 px-2 py-2 text-center text-caption text-muted-foreground",
        !occupied && variant === "queuedIncomplete" && "border-next/40",
        acceptsDrop && enabled && !occupied && "border-primary/30",
        acceptsDrop && isOver && enabled && "border-primary bg-primary/5 ring-2 ring-primary/40",
        acceptsDrop && isOver && enabled && occupied && "rounded-control ring-2 ring-primary/40",
        className,
      )}
    >
      {children}
    </div>
  );
}
