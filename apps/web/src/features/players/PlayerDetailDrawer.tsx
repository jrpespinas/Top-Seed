import { useEffect, useState } from "react";
import { PaymentBadge } from "../../components/domain/payment-badge.js";
import { StatusBadge } from "../../components/domain/status-badge.js";
import { SyncStatusBadge } from "../../components/domain/sync-status-badge.js";
import { Button } from "../../components/ui/button.js";
import { ConfirmAction } from "../../components/ui/confirm-action.js";
import { DataList } from "../../components/ui/data-list.js";
import { Drawer } from "../../components/ui/drawer.js";
import { FormField } from "../../components/ui/form-field.js";
import { Select } from "../../components/ui/select.js";
import { formatMoney } from "../../lib/format/money.js";
import { applyPaymentTransition } from "../../lib/payment-actions.js";
import { statsForCheckIn } from "../../lib/session-stats.js";
import { updatePaymentLocal } from "../../mutations/updatePayment.js";
import { updateCheckInLocal } from "../../mutations/updateCheckIn.js";
import { updatePlayerProfileLocal } from "../../mutations/updatePlayerProfile.js";
import { usePlayerDetail } from "../../hooks/usePlayerDetail.js";
import type { PaymentTransitionAction } from "@top-seed/domain";

export interface PlayerDetailDrawerProps {
  sessionId: string;
  checkInId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  focusSection?: "session" | "payment" | "profile";
}

export function PlayerDetailDrawer({
  sessionId,
  checkInId,
  isOpen,
  onOpenChange,
}: PlayerDetailDrawerProps) {
  const { checkIn, session, profile, sessionMode, statsMap } = usePlayerDetail(sessionId, checkInId);
  const [sessionRating, setSessionRating] = useState("3.0");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [clubRating, setClubRating] = useState("3.0");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!checkIn || !profile) {
      return;
    }
    setSessionRating(String(checkIn.sessionSkillRating));
    setDisplayName(profile.displayName);
    setPhone(profile.phone ?? "");
    setGender(profile.gender ?? "");
    setClubRating(String(profile.defaultSkillRating));
    setNotes(profile.notes ?? "");
  }, [checkIn, profile]);

  if (!checkIn || !session || !profile) {
    return (
      <Drawer isOpen={isOpen} onOpenChange={onOpenChange} title="Player details">
        <p className="text-body text-muted-foreground">Player not found.</p>
      </Drawer>
    );
  }

  const stats = statsForCheckIn(checkIn, statsMap);
  const isLive = sessionMode === "live";
  const winRateLabel =
    stats.winRate === null ? "—" : `${Math.round(stats.winRate * 100)}%`;

  const activeCheckIn = checkIn;
  const activeProfile = profile;

  async function saveSessionRating() {
    setBusy(true);
    try {
      await updateCheckInLocal({
        sessionId,
        checkInId: activeCheckIn.id,
        sessionSkillRating: Number(sessionRating),
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    try {
      await updatePlayerProfileLocal({
        playerProfileId: activeProfile.id,
        organizationId: activeProfile.organizationId,
        displayName,
        phone: phone || null,
        gender: gender || null,
        defaultSkillRating: Number(clubRating),
        notes: notes || null,
      });
    } finally {
      setBusy(false);
    }
  }

  async function runPaymentAction(action: PaymentTransitionAction) {
    const payment = applyPaymentTransition(activeCheckIn, action);
    await updatePaymentLocal({ sessionId, checkInId: activeCheckIn.id, payment });
  }

  async function updateQueueStatus(queueStatus: string) {
    await updateCheckInLocal({ sessionId, checkInId: activeCheckIn.id, queueStatus: queueStatus as never });
  }

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={profile.displayName}
      description="Session and club profile"
    >
      <div className="space-y-6">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-title font-semibold">This session</h3>
            <SyncStatusBadge status={checkIn.syncStatus === "synced" ? "synced" : "pending"} />
          </div>
          <DataList
            items={[
              { label: "Queue status", value: checkIn.queueStatus },
              { label: "Record", value: `${stats.wins}-${stats.losses}-${stats.draws}` },
              { label: "Win %", value: winRateLabel },
              { label: "Matches played", value: String(stats.matchesPlayed) },
              {
                label: "Payment",
                value: (
                  <PaymentBadge
                    status={checkIn.paymentStatus as "unpaid"}
                    amountDue={checkIn.paymentAmountDue}
                    amountPaid={checkIn.paymentAmountPaid}
                    currency={session.currency}
                  />
                ),
              },
            ]}
            keyExtractor={(item) => item.label}
            renderItem={(item) => (
              <div className="flex items-center justify-between px-3 py-2 text-body">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            )}
          />
          {isLive ? (
            <div className="mt-3 space-y-3">
              <FormField label="Session skill rating">
                <input
                  className="w-full rounded-card border border-border px-3 py-2"
                  type="number"
                  min={1}
                  max={5}
                  step={0.1}
                  value={sessionRating}
                  onChange={(event) => setSessionRating(event.target.value)}
                />
              </FormField>
              <Button size="compact" isLoading={busy} onClick={() => void saveSessionRating()}>
                Save session rating
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button size="compact" variant="secondary" onClick={() => void runPaymentAction("mark_paid")}>
                  Mark paid
                </Button>
                <Button size="compact" variant="secondary" onClick={() => void runPaymentAction("mark_partial")}>
                  Mark partial
                </Button>
                <Button size="compact" variant="secondary" onClick={() => void runPaymentAction("mark_waived")}>
                  Waive
                </Button>
                <ConfirmAction
                  triggerLabel="Mark refunded"
                  title="Mark refunded?"
                  description={`Refund ${formatMoney(checkIn.paymentAmountPaid, session.currency)} for this player.`}
                  onConfirm={() => runPaymentAction("mark_refunded")}
                />
                <ConfirmAction
                  triggerLabel="Reset to unpaid"
                  title="Reset to unpaid?"
                  description="Clears payment amounts for this check-in."
                  onConfirm={() => runPaymentAction("reset_to_unpaid")}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="compact" variant="ghost" onClick={() => void updateQueueStatus("waiting")}>
                  Back to waiting
                </Button>
                <Button size="compact" variant="ghost" onClick={() => void updateQueueStatus("resting")}>
                  Mark resting
                </Button>
                <Button size="compact" variant="ghost" onClick={() => void updateQueueStatus("done")}>
                  Mark done
                </Button>
                <ConfirmAction
                  triggerLabel="Remove from session"
                  title="Remove player?"
                  description="They will no longer appear in the queue."
                  variant="danger"
                  disabled={checkIn.queueStatus === "playing"}
                  onConfirm={() => updateQueueStatus("removed")}
                />
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge type="queue" status={checkIn.suggestionExcluded ? "removed" : "waiting"} />
                <Button
                  size="compact"
                  variant="ghost"
                  onClick={() =>
                    void updateCheckInLocal({
                      sessionId,
                      checkInId: checkIn.id,
                      suggestionExcluded: !checkIn.suggestionExcluded,
                    })
                  }
                >
                  {checkIn.suggestionExcluded ? "Clear skip" : "Skip suggestions"}
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-title font-semibold">Player profile</h3>
            <SyncStatusBadge status={profile.syncStatus === "synced" ? "synced" : "pending"} />
          </div>
          <div className="space-y-3">
            <FormField label="Display name">
              <input
                className="w-full rounded-card border border-border px-3 py-2"
                value={displayName}
                disabled={!isLive}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </FormField>
            <FormField label="Phone">
              <input
                className="w-full rounded-card border border-border px-3 py-2"
                value={phone}
                disabled={!isLive}
                onChange={(event) => setPhone(event.target.value)}
              />
            </FormField>
            <FormField label="Gender">
              <Select
                value={gender}
                disabled={!isLive}
                onValueChange={setGender}
                options={[
                  { value: "", label: "Not set" },
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ]}
              />
            </FormField>
            <FormField label="Club rating">
              <input
                className="w-full rounded-card border border-border px-3 py-2"
                type="number"
                min={1}
                max={5}
                step={0.1}
                value={clubRating}
                disabled={!isLive}
                onChange={(event) => setClubRating(event.target.value)}
              />
            </FormField>
            <FormField label="Notes">
              <textarea
                className="min-h-20 w-full rounded-card border border-border px-3 py-2"
                value={notes}
                disabled={!isLive}
                onChange={(event) => setNotes(event.target.value)}
              />
            </FormField>
            {isLive ? (
              <Button isLoading={busy} onClick={() => void saveProfile()}>
                Save profile
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    </Drawer>
  );
}
