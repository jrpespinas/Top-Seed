import { useMemo, useState, type FormEvent } from "react";
import { PlayerRow } from "../../components/domain/player-row.js";
import { SearchInput } from "../../components/ui/search-input.js";
import { FormField } from "../../components/ui/form-field.js";
import { Button } from "../../components/ui/button.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import type { LocalCheckIn, LocalPlayerProfile } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";

export interface PlayerCheckInPanelProps {
  sessionMode: SessionMode;
  feeAmount: number;
  currency: string;
  playerProfiles: LocalPlayerProfile[];
  checkIns: LocalCheckIn[];
  onCheckIn: (input: {
    playerProfileId: string;
    playerDisplayName: string;
    sessionSkillRating?: number;
  }) => Promise<void>;
  onCreateWalkIn: (displayName: string) => Promise<void>;
}

export function PlayerCheckInPanel({
  sessionMode,
  feeAmount,
  currency,
  playerProfiles,
  checkIns,
  onCheckIn,
  onCreateWalkIn,
}: PlayerCheckInPanelProps) {
  const [query, setQuery] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const activeProfileIds = useMemo(
    () =>
      new Set(
        checkIns
          .filter((checkIn) => checkIn.queueStatus !== "removed")
          .map((checkIn) => checkIn.playerProfileId),
      ),
    [checkIns],
  );

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [];
    }
    return playerProfiles
      .filter((profile) => profile.displayName.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [playerProfiles, query]);

  if (sessionMode === "ended") {
    return null;
  }

  async function handleCheckIn(profile: LocalPlayerProfile) {
    setError(undefined);
    setBusy(true);
    try {
      await onCheckIn({
        playerProfileId: profile.id,
        playerDisplayName: profile.displayName,
        sessionSkillRating: profile.defaultSkillRating,
      });
      setQuery("");
    } catch (checkInError) {
      setError(checkInError instanceof Error ? checkInError.message : "Check-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleWalkIn(event: FormEvent) {
    event.preventDefault();
    if (!walkInName.trim()) {
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await onCreateWalkIn(walkInName.trim());
      setWalkInName("");
    } catch (walkInError) {
      setError(walkInError instanceof Error ? walkInError.message : "Could not add walk-in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="text-title font-semibold">Check in</h2>
      <p className="mt-1 text-caption text-muted-foreground">
        Session fee {feeAmount} {currency} · defaults to unpaid
      </p>
      <div className="mt-3 space-y-3">
        <SearchInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search returning players"
          aria-label="Search players"
        />
        {results.length > 0 ? (
          <ul className="divide-y divide-border rounded-control border border-border">
            {results.map((profile) => (
              <li key={profile.id}>
                <PlayerRow
                  player={{ id: profile.id, displayName: profile.displayName }}
                  variant="search"
                  actions={
                    activeProfileIds.has(profile.id)
                      ? []
                      : [
                          {
                            label: "Check in",
                            onSelect: () => void handleCheckIn(profile),
                          },
                        ]
                  }
                />
              </li>
            ))}
          </ul>
        ) : query ? (
          <EmptyState title="No players found" description="Add a new walk-in below." />
        ) : null}
        <form onSubmit={(event) => void handleWalkIn(event)} className="space-y-2 border-t border-border pt-3">
          <FormField label="New walk-in" htmlFor="walk-in-name">
            <input
              id="walk-in-name"
              className="w-full rounded-control border border-border px-3 py-2 text-body"
              value={walkInName}
              onChange={(event) => setWalkInName(event.target.value)}
              placeholder="Display name"
            />
          </FormField>
          <Button type="submit" disabled={busy || !walkInName.trim()}>
            Add & check in
          </Button>
        </form>
        {error ? <p className="text-caption text-danger">{error}</p> : null}
      </div>
    </section>
  );
}
