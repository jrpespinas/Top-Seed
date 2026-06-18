import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function ScrollArea({ className, children, ...props }: ScrollAreaProps) {
  return (
    <div className={cn("min-h-0 overflow-y-auto", className)} {...props}>
      {children}
    </div>
  );
}
