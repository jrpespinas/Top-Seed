import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface DrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footerActions?: ReactNode;
  side?: "right" | "bottom";
}

export function Drawer({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  footerActions,
  side = "right",
}: DrawerProps) {
  const sideClasses =
    side === "bottom"
      ? "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-card"
      : "inset-y-0 right-0 h-full w-full max-w-md rounded-l-card";

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col border border-border bg-surface shadow-xl focus:outline-none",
            sideClasses,
          )}
        >
          <div className="border-b border-border px-4 py-3">
            <DialogPrimitive.Title className="text-title font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-caption text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
          {footerActions ? (
            <div className="sticky bottom-0 border-t border-border bg-surface px-4 py-3">
              {footerActions}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
