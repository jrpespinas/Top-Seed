"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkillLevelSelect } from "@/components/ui/SkillLevelSelect";
import { GenderToggle } from "@/components/ui/GenderToggle";
import { useConfirmFocus } from "@/hooks/useConfirmFocus";
import type { SkillLevel, Gender } from "@/types";

interface DraftRow {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  gender?: Gender;
}

function makeBlankRow(): DraftRow {
  return {
    id: `draft-${Math.random().toString(36).slice(2)}`,
    name: "",
    skillLevel: "C",
    gender: undefined,
  };
}

type DuplicateReason = "existing" | "batch";

// Case-sensitive on purpose — "Alex" and "alex" are treated as different
// names, not normalized to the same identity. Flags a row if its trimmed
// name exactly matches either an existing session player or an earlier row
// in this same batch (both rows in an in-batch collision get flagged, not
// just the second one, so it's clear which two are in conflict) — the
// reason is kept per-row so the UI can explain which case it is.
function findDuplicateRowIds(
  rows: DraftRow[],
  existingNames: Set<string>
): Map<string, DuplicateReason> {
  const seenInBatch = new Map<string, string>();
  const duplicates = new Map<string, DuplicateReason>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    if (existingNames.has(name)) {
      duplicates.set(row.id, "existing");
      continue;
    }
    const firstId = seenInBatch.get(name);
    if (firstId) {
      duplicates.set(row.id, "batch");
      duplicates.set(firstId, "batch");
    } else {
      seenInBatch.set(name, row.id);
    }
  }
  return duplicates;
}

export interface NewPlayerInput {
  name: string;
  skillLevel: SkillLevel;
  gender?: Gender;
}

interface AddPlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (players: NewPlayerInput[]) => void;
  existingPlayerNames: Set<string>;
}

export function AddPlayersModal({ isOpen, onClose, onSubmit, existingPlayerNames }: AddPlayersModalProps) {
  const [rows, setRows] = useState<DraftRow[]>([makeBlankRow()]);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const isSubmittingRef = useRef(false);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [lastRemoved, setLastRemoved] = useState<{ row: DraftRow; index: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const lastRemovedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "Keep editing" is the safe default focused on entering confirm mode;
  // the footer's own Cancel button is what regains focus on exit.
  const { triggerRef: cancelBtnRef, cancelRef: keepEditingBtnRef } = useConfirmFocus(discardConfirm);

  const isDirty = rows.some((r) => r.name.trim().length > 0);

  // Portal target (document.body) only exists client-side; avoids an SSR/hydration mismatch.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const initialRow = makeBlankRow();
    setRows([initialRow]);
    setError("");
    setDiscardConfirm(false);
    setIsSaving(false);
    setAttemptedSubmit(false);
    isSubmittingRef.current = false;
    setLastRemoved(null);
    if (lastRemovedTimerRef.current) clearTimeout(lastRemovedTimerRef.current);
    const id = setTimeout(() => nameInputRefs.current.get(initialRow.id)?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  // Focus a row's name input once it's rendered (e.g. right after it's created).
  useEffect(() => {
    if (!pendingFocusId) return;
    nameInputRefs.current.get(pendingFocusId)?.focus();
    setPendingFocusId(null);
  }, [pendingFocusId, rows]);

  useEffect(() => {
    return () => {
      if (lastRemovedTimerRef.current) clearTimeout(lastRemovedTimerRef.current);
    };
  }, []);

  const handleClose = () => {
    if (isDirty) {
      setDiscardConfirm(true);
      return;
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (discardConfirm) {
          setDiscardConfirm(false);
        } else {
          handleClose();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const el = dialogRef.current;
      if (!el) return;
      const focusable = Array.from(
        el.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, discardConfirm, isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (error) setError("");
  }

  function addRow(afterId?: string) {
    const row = makeBlankRow();
    setRows((prev) => {
      const idx = afterId ? prev.findIndex((r) => r.id === afterId) : -1;
      if (idx === -1) return [...prev, row];
      const next = [...prev];
      next.splice(idx + 1, 0, row);
      return next;
    });
    setPendingFocusId(row.id);
  }

  function removeRow(id: string) {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;
      const row = prev[idx];
      if (row.name.trim().length > 0) {
        if (lastRemovedTimerRef.current) clearTimeout(lastRemovedTimerRef.current);
        setLastRemoved({ row, index: idx });
        lastRemovedTimerRef.current = setTimeout(() => setLastRemoved(null), 6000);
      }
      return prev.filter((r) => r.id !== id);
    });
  }

  function undoRemoveRow() {
    if (!lastRemoved) return;
    if (lastRemovedTimerRef.current) clearTimeout(lastRemovedTimerRef.current);
    const { row, index } = lastRemoved;
    setRows((prev) => {
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, row);
      return next;
    });
    setLastRemoved(null);
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>, row: DraftRow, idx: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (idx < rows.length - 1) {
      nameInputRefs.current.get(rows[idx + 1].id)?.focus();
    } else {
      addRow(row.id);
    }
  }

  function handleNamePaste(e: React.ClipboardEvent<HTMLInputElement>, row: DraftRow) {
    const lines = e.clipboardData
      .getData("text")
      .split(/\r\n|\r|\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length <= 1) return;
    e.preventDefault();
    const newRows = lines.slice(1).map((name) => ({ ...makeBlankRow(), name }));
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === row.id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], name: lines[0] };
      next.splice(idx + 1, 0, ...newRows);
      return next;
    });
  }

  async function handleSubmit() {
    // Synchronous re-entrancy guard: `disabled={isSaving}` only blocks a second
    // tap once React re-renders and commits, which lags a fast double-tap by a
    // frame or more (this modal is used courtside on a tablet — see PRD "Speed
    // over completeness"). This ref check has no such gap, so it can't submit
    // the same batch of rows twice.
    if (isSubmittingRef.current) return;
    const validRows = rows.filter((r) => r.name.trim().length > 0);
    if (validRows.length === 0) {
      setError("Enter at least one player's name");
      nameInputRefs.current.get(rows[0]?.id)?.focus();
      return;
    }
    const duplicateRowIds = findDuplicateRowIds(rows, existingPlayerNames);
    if (duplicateRowIds.size > 0) {
      setAttemptedSubmit(true);
      setError("Two players can't share the same name");
      const firstDuplicateId = duplicateRowIds.keys().next().value;
      if (firstDuplicateId) nameInputRefs.current.get(firstDuplicateId)?.focus();
      return;
    }
    if (validRows.some((r) => !r.gender)) {
      setAttemptedSubmit(true);
      setError("Select a gender for every player");
      return;
    }
    isSubmittingRef.current = true;
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 300));
    onSubmit(
      validRows.map((r) => ({ name: r.name.trim(), skillLevel: r.skillLevel, gender: r.gender }))
    );
    setIsSaving(false);
    isSubmittingRef.current = false;
    onClose();
  }

  const missingGenderRowIds = new Set(
    attemptedSubmit
      ? rows.filter((r) => r.name.trim().length > 0 && !r.gender).map((r) => r.id)
      : []
  );

  const duplicateNameRowIds = attemptedSubmit
    ? findDuplicateRowIds(rows, existingPlayerNames)
    : new Map<string, DuplicateReason>();

  const validCount = rows.filter((r) => r.name.trim()).length;
  const skippedCount = rows.length - validCount;
  const submitLabel = validCount > 1 ? `Add ${validCount} Players` : "Add Player";

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-bg/70 backdrop-blur-sm z-[var(--z-modal-backdrop)]",
          "transition-opacity duration-200 motion-reduce:transition-none",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
        aria-hidden
      />

      {/* Dialog */}
      <div
        className={cn(
          "fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4",
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Add players"
          aria-hidden={!isOpen}
          className={cn(
            "w-full max-w-[480px] max-h-[85vh] bg-surface border border-border rounded-lg flex flex-col",
            "transition-all duration-200 ease-out motion-reduce:transition-none",
            isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 h-14 border-b border-border flex-shrink-0">
            <h2 className="text-base font-semibold text-ink">Add Players</h2>
            <button
              onClick={handleClose}
              className="text-muted hover:text-ink hover:bg-surface-elevated transition-colors p-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Close"
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
            {rows.map((row, idx) => (
              <div key={row.id} className="flex items-start gap-2">
                <div className="flex-1 min-w-0 space-y-2">
                  {idx === 0 && (
                    <label htmlFor={`player-name-${row.id}`} className="block text-xs font-medium text-muted">
                      Player Name
                    </label>
                  )}
                  <input
                    id={`player-name-${row.id}`}
                    ref={(el) => {
                      if (el) nameInputRefs.current.set(row.id, el);
                      else nameInputRefs.current.delete(row.id);
                    }}
                    type="text"
                    value={row.name}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                    onKeyDown={(e) => handleNameKeyDown(e, row, idx)}
                    onPaste={(e) => handleNamePaste(e, row)}
                    placeholder="Player's full name"
                    aria-label="Player's full name"
                    aria-invalid={duplicateNameRowIds.has(row.id) ? true : undefined}
                    autoComplete="off"
                    className={cn(
                      "w-full bg-bg border rounded-md px-3 py-2.5 text-sm text-ink",
                      "placeholder:text-muted",
                      "focus:outline-none focus:ring-2 focus:border-primary/50",
                      "transition-colors duration-150",
                      duplicateNameRowIds.has(row.id)
                        ? "border-error/50 focus:ring-error/40"
                        : "border-border focus:ring-primary/50"
                    )}
                  />
                  {duplicateNameRowIds.has(row.id) ? (
                    <p className="text-xs text-error">
                      {duplicateNameRowIds.get(row.id) === "existing"
                        ? "Already in this session"
                        : "Matches another row"}
                    </p>
                  ) : (
                    rows.length > 1 &&
                    row.name.trim().length === 0 && (
                      <p className="text-xs text-muted">Blank rows are skipped when you add players</p>
                    )
                  )}
                  {idx === 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted flex-1">Skill Level</span>
                      <span className="text-xs font-medium text-muted">Gender</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <SkillLevelSelect
                      value={row.skillLevel}
                      onChange={(level) => updateRow(row.id, { skillLevel: level })}
                      className="flex-1"
                    />
                    <GenderToggle
                      value={row.gender}
                      onChange={(gender) => updateRow(row.id, { gender })}
                      variant="compact"
                      error={missingGenderRowIds.has(row.id)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  title={rows.length === 1 ? "At least one row is required" : undefined}
                  className="mt-2.5 p-1.5 text-muted hover:text-error hover:bg-error/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:bg-transparent flex-shrink-0"
                  aria-label={`Remove row ${idx + 1}`}
                >
                  <X size={14} strokeWidth={2} aria-hidden />
                </button>
              </div>
            ))}

            {lastRemoved && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-between gap-3 text-xs text-muted bg-surface-elevated/60 border border-border/60 rounded-md px-3 py-2"
              >
                <span className="truncate">Removed &ldquo;{lastRemoved.row.name.trim()}&rdquo;</span>
                <button
                  type="button"
                  onClick={undoRemoveRow}
                  className="flex-shrink-0 font-semibold text-primary hover:text-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm px-1"
                >
                  Undo
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => addRow()}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md px-1 py-1"
            >
              <Plus size={13} strokeWidth={2.5} aria-hidden />
              Add another player
            </button>

            {error && (
              <p className="text-xs text-error" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          {discardConfirm ? (
            <div className="flex items-center gap-3 px-5 py-4 border-t border-border flex-shrink-0">
              <p className="text-sm text-muted flex-1">Discard unsaved players?</p>
              <button
                onClick={onClose}
                className="text-sm text-error hover:text-error/80 transition-colors px-3 py-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 min-h-[44px]"
              >
                Discard
              </button>
              <button
                ref={keepEditingBtnRef}
                onClick={() => setDiscardConfirm(false)}
                className="text-sm font-semibold text-ink bg-surface-elevated hover:bg-surface-elevated/80 transition-colors px-3 py-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[44px]"
              >
                Keep editing
              </button>
            </div>
          ) : (
            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              {isDirty && (
                <p className="flex items-center gap-1.5 text-xs text-muted mb-2.5">
                  <span
                    className="inline-block w-1 h-1 rounded-full bg-primary/70 flex-shrink-0"
                    aria-hidden
                  />
                  {skippedCount > 0
                    ? `${validCount} of ${rows.length} rows will be added — blank rows are skipped`
                    : "Unsaved changes"}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className={cn(
                    "flex-1 bg-primary text-bg text-sm font-semibold py-2.5 rounded-md",
                    "transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    "min-h-[44px]",
                    isSaving ? "opacity-60 cursor-not-allowed" : "hover:bg-primary-hover"
                  )}
                >
                  {isSaving ? "Adding…" : submitLabel}
                </button>
                <button
                  ref={cancelBtnRef}
                  onClick={handleClose}
                  disabled={isSaving}
                  className="text-sm text-muted hover:text-ink transition-colors px-4 py-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[44px] disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
