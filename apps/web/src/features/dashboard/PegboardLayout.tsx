import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { ScrollArea } from "../../components/ui/scroll-area.js";

export interface PegboardZoneProps {
  title: string;
  countLabel?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  variant?: "players" | "matches" | "courts";
}

function PegboardZone({ title, countLabel, headerAction, children, variant = "players" }: PegboardZoneProps) {
  const subtitle = countLabel ? `${title} · ${countLabel}` : title;

  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-card border border-border/60 bg-surface shadow-sm",
        variant === "courts" && "border-court/20",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <h2 className="text-label font-semibold text-foreground">{subtitle}</h2>
        {headerAction}
      </header>
      <ScrollArea className="min-h-0 flex-1 p-3">{children}</ScrollArea>
    </section>
  );
}

export interface PegboardLayoutProps {
  playerList: ReactNode;
  upcomingMatches: ReactNode;
  courts: ReactNode;
  playerListCount?: string;
  upcomingCount?: string;
  courtsCount?: string;
  playerListAction?: ReactNode;
  upcomingAction?: ReactNode;
  courtsAction?: ReactNode;
  className?: string;
}

export function PegboardLayout({
  playerList,
  upcomingMatches,
  courts,
  playerListCount,
  upcomingCount,
  courtsCount,
  playerListAction,
  upcomingAction,
  courtsAction,
  className,
}: PegboardLayoutProps) {
  return (
    <div
      className={cn(
        "grid gap-3 lg:min-h-[70vh] lg:grid-cols-[minmax(200px,0.22fr)_minmax(260px,0.30fr)_minmax(380px,0.48fr)]",
        className,
      )}
    >
      <PegboardZone
        title="Player List"
        countLabel={playerListCount}
        headerAction={playerListAction}
        variant="players"
      >
        {playerList}
      </PegboardZone>
      <PegboardZone
        title="Upcoming Matches"
        countLabel={upcomingCount}
        headerAction={upcomingAction}
        variant="matches"
      >
        {upcomingMatches}
      </PegboardZone>
      <PegboardZone
        title="Courts"
        countLabel={courtsCount}
        headerAction={courtsAction}
        variant="courts"
      >
        {courts}
      </PegboardZone>
    </div>
  );
}