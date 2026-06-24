import { DragOverlay } from "@dnd-kit/core";
import type { Active } from "@dnd-kit/core";
import { PlayerCard } from "../../../components/domain/player-card.js";
import { parseDragId } from "./drag-types.js";
import type { DragItem } from "./drag-types.js";

export interface DragOverlayPreviewProps {
  active: Active | null;
  sessionId: string;
}

function overlayLabel(drag: DragItem): string {
  if (drag.kind === "player") {
    return "Moving player";
  }
  if (drag.kind === "queued-match") {
    return "Moving match";
  }
  if (drag.kind === "queued-player") {
    return "Moving player";
  }
  return "Moving";
}

export function DragOverlayPreview({ active, sessionId }: DragOverlayPreviewProps) {
  if (!active) {
    return null;
  }

  const drag = parseDragId(String(active.id), sessionId);
  if (!drag) {
    return (
      <div className="rounded-card border border-border bg-surface px-3 py-2 text-caption shadow-lg">
        {overlayLabel({ kind: "player", sessionId, sourceZone: "available" })}
      </div>
    );
  }

  const displayName =
    typeof active.data.current?.displayName === "string"
      ? active.data.current.displayName
      : overlayLabel(drag);

  if (drag.kind === "player" || drag.kind === "queued-player") {
    return (
      <div className="pointer-events-none opacity-90 shadow-lg">
        <PlayerCard variant="compact" player={{ id: drag.checkInId ?? "player", displayName }} />
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface px-3 py-2 text-caption shadow-lg">
      {displayName}
    </div>
  );
}

export function DragOverlayLayer({ active, sessionId }: DragOverlayPreviewProps) {
  return (
    <DragOverlay dropAnimation={null}>
      <DragOverlayPreview active={active} sessionId={sessionId} />
    </DragOverlay>
  );
}
