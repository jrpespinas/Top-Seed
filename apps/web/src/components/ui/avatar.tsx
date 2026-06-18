import { cn } from "../../lib/cn.js";

export interface AvatarProps {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

const sizeClasses = {
  sm: "h-7 w-7 text-caption",
  md: "h-8 w-8 text-caption",
  lg: "h-10 w-10 text-body",
};

export function Avatar({ name, className, size = "md" }: AvatarProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground",
        sizeClasses[size],
        className,
      )}
    >
      {initialsFromName(name)}
    </div>
  );
}
