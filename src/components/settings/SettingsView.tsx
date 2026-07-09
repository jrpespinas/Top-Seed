"use client";

import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { clearSessionArchive } from "@/lib/session-store";
import { removeMatchRecordsForSessions } from "@/lib/match-log-store";
import { useConfirmFocus } from "@/hooks/useConfirmFocus";

function resetAllData() {
  const keys = Object.keys(window.localStorage).filter((k) => k.startsWith("top-seed:"));
  for (const key of keys) window.localStorage.removeItem(key);
}

type ActionId = "clear-history" | "reset-all";

function DangerAction({
  title,
  description,
  actionLabel,
  confirmLabel,
  isConfirming,
  justDone,
  onRequestConfirm,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  actionLabel: string;
  confirmLabel: string;
  isConfirming: boolean;
  justDone: boolean;
  onRequestConfirm: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // "Done" is a third, transient state (cleared after 2.5s) that also counts
  // as "away from idle" — passed as the hook's swapped override so focus
  // returns to the trigger once "Done" clears, not just on confirm→idle.
  const { triggerRef: triggerBtnRef, cancelRef: cancelBtnRef } = useConfirmFocus(
    isConfirming,
    isConfirming || justDone
  );

  return (
    <div className="px-4 sm:px-5 py-4">
      <p className="text-sm font-medium text-ink mb-1">{title}</p>
      <p className="text-xs text-muted mb-4">{description}</p>

      {justDone ? (
        <p className="flex items-center gap-1.5 text-sm text-success font-medium">
          <Check size={14} strokeWidth={2.5} aria-hidden />
          Done
        </p>
      ) : !isConfirming ? (
        <button
          ref={triggerBtnRef}
          onClick={onRequestConfirm}
          className="text-sm font-semibold bg-error/15 text-error hover:bg-error/25 transition-colors px-3 py-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 min-h-[44px]"
        >
          {actionLabel}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted flex-1 min-w-[160px]">Are you sure? This can&apos;t be undone.</p>
          <button
            onClick={onConfirm}
            className="text-sm font-semibold bg-error/15 text-error hover:bg-error/25 transition-colors px-3 py-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 min-h-[44px]"
          >
            {confirmLabel}
          </button>
          <button
            ref={cancelBtnRef}
            onClick={onCancel}
            className="text-sm text-muted hover:text-ink transition-colors px-3 py-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function SettingsView() {
  const [confirmingAction, setConfirmingAction] = useState<ActionId | null>(null);
  const [justDone, setJustDone] = useState<ActionId | null>(null);

  function handleClearHistory() {
    const clearedSessionIds = clearSessionArchive();
    removeMatchRecordsForSessions(clearedSessionIds);
    setConfirmingAction(null);
    setJustDone("clear-history");
    setTimeout(() => setJustDone((d) => (d === "clear-history" ? null : d)), 2500);
  }

  function handleReset() {
    resetAllData();
    // Full reload (not client-side navigation) so every store re-initializes
    // fresh from empty storage — the same guarantee a first-ever visit gets.
    window.location.href = "/";
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex items-center px-4 sm:px-6 h-14 border-b border-border">
        <h1 className="text-base font-semibold text-ink">Settings</h1>
      </div>

      <div className="p-4 sm:p-6 max-w-lg">
        <section className="border border-error/30 rounded-lg overflow-hidden divide-y divide-error/20">
          <div className="px-4 sm:px-5 py-3 bg-error/5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-error">
              <AlertTriangle size={14} strokeWidth={2} aria-hidden />
              Danger Zone
            </h2>
          </div>

          <DangerAction
            title="Clear session history"
            description="Removes every past session from Sessions. The session currently in progress (if any) keeps running."
            actionLabel="Clear session history"
            confirmLabel="Clear history"
            isConfirming={confirmingAction === "clear-history"}
            justDone={justDone === "clear-history"}
            onRequestConfirm={() => setConfirmingAction("clear-history")}
            onCancel={() => setConfirmingAction(null)}
            onConfirm={handleClearHistory}
          />

          <DangerAction
            title="Reset all data"
            description="Permanently clears everything stored in this browser — the current session, all past sessions, and the full match log. This cannot be undone."
            actionLabel="Reset all data"
            confirmLabel="Reset everything"
            isConfirming={confirmingAction === "reset-all"}
            justDone={false}
            onRequestConfirm={() => setConfirmingAction("reset-all")}
            onCancel={() => setConfirmingAction(null)}
            onConfirm={handleReset}
          />
        </section>

        <footer className="mt-8 px-1">
          <p className="text-sm text-muted italic">&ldquo;Be thankful in all circumstances, for this is God&apos;s will for you who belong to Christ Jesus. <br />1 Thessalonians 5:18 NLT&rdquo;</p>
          <p className="text-xs text-muted/70 mt-1">Developed by Bogs Espinas</p>
        </footer>
      </div>
    </div>
  );
}
