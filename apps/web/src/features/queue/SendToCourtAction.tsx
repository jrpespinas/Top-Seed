import { cn } from "../../lib/cn.js";
import { Button } from "../../components/ui/button.js";
import { DropdownMenu } from "../../components/ui/dropdown-menu.js";

export interface SendToCourtActionProps {
  openCourts: { id: string; name: string }[];
  onSend: (courtId: string) => void;
  disabled?: boolean;
  matchIndex?: number;
  fullWidth?: boolean;
  className?: string;
}

export function SendToCourtAction({
  openCourts,
  onSend,
  disabled,
  matchIndex,
  fullWidth = false,
  className,
}: SendToCourtActionProps) {
  if (openCourts.length === 0 || disabled) {
    return null;
  }

  const matchLabel = matchIndex !== undefined ? `match #${matchIndex}` : "match";

  if (openCourts.length === 1) {
    const court = openCourts[0]!;
    return (
      <Button
        size="compact"
        variant="primary"
        className={cn(fullWidth && "w-full", className)}
        onClick={() => onSend(court.id)}
        aria-label={`Send ${matchLabel} to ${court.name}`}
      >
        Send to {court.name}
      </Button>
    );
  }

  return (
    <DropdownMenu
      align="start"
      trigger={
        <Button
          size="compact"
          variant="primary"
          className={cn(fullWidth && "w-full", className)}
          aria-label={`Send ${matchLabel} to court`}
        >
          Send to court…
        </Button>
      }
      items={openCourts.map((court) => ({
        label: court.name,
        onSelect: () => onSend(court.id),
      }))}
    />
  );
}
