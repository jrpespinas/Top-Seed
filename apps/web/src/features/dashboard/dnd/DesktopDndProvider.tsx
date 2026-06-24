import { useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Active,
  type DragEndEvent,
} from "@dnd-kit/core";
import { parseDragId, parseDropId } from "./drag-types.js";
import { DragOverlayLayer } from "./DragOverlayPreview.js";
import { resolvePegboardDrop, type PegboardDropContext } from "./resolvePegboardDrop.js";

export interface DesktopDndProviderProps {
  enabled: boolean;
  dropContext: PegboardDropContext;
  children: ReactNode;
}

export function DesktopDndProvider({ enabled, dropContext, children }: DesktopDndProviderProps) {
  const [active, setActive] = useState<Active | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  if (!enabled) {
    return <>{children}</>;
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActive(null);
    const { active: activeItem, over } = event;
    if (!over) {
      return;
    }

    const drag = parseDragId(String(activeItem.id), dropContext.sessionId);
    const target = parseDropId(String(over.id), dropContext.sessionId);
    if (!drag || !target) {
      return;
    }

    const result = resolvePegboardDrop(drag, target, dropContext);
    if (!result.ok) {
      setStatusMessage(result.reason);
      return;
    }

    const successMessage =
      drag.kind === "queued-player" ? "Player moved in match" : "Player added to match";

    void result.run().then(
      () => setStatusMessage(successMessage),
      (error: unknown) => {
        setStatusMessage(error instanceof Error ? error.message : "Drop failed");
      },
    );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setActive(event.active)}
      onDragCancel={() => setActive(null)}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlayLayer active={active} sessionId={dropContext.sessionId} />
      <div className="sr-only" role="status" aria-live="polite" id="pegboard-dnd-status">
        {statusMessage}
      </div>
    </DndContext>
  );
}
