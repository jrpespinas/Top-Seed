import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "../../../components/ui/icon-button.js";
import { cn } from "../../../lib/cn.js";
import { queuedPlayerDragId } from "./drag-types.js";

export interface DraggableQueuedPlayerProps {
  sessionId: string;
  queuedMatchId: string;
  checkInId: string;
  displayName: string;
  enabled: boolean;
  children: ReactNode;
}

export function DraggableQueuedPlayer({
  queuedMatchId,
  checkInId,
  displayName,
  enabled,
  children,
}: DraggableQueuedPlayerProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: queuedPlayerDragId(queuedMatchId, checkInId),
    disabled: !enabled,
    data: { displayName },
  });

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      ref={setNodeRef}
      aria-grabbed={isDragging ? true : undefined}
      className={cn("group flex items-center gap-1", isDragging && "opacity-40")}
    >
      <IconButton
        label={`Drag ${displayName}`}
        size="compact"
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </IconButton>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
