"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, CornerDownLeft } from "lucide-react";
import { cn, SKILL_LABELS } from "@/lib/utils";
import { SkillLevelSelect } from "@/components/ui/SkillLevelSelect";
import { GenderToggle, GENDER_LABELS } from "@/components/ui/GenderToggle";
import { useToast, ToastViewport } from "@/components/ui/Toast";
import { useConfirmFocus } from "@/hooks/useConfirmFocus";
import type { SkillLevel, Gender } from "@/types";

interface DraftRow {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  gender?: Gender;
}

let draftSeq = 0;
function makeRow(name: string, skillLevel: SkillLevel, gender?: Gender): DraftRow {
  return { id: `draft-${++draftSeq}`, name, skillLevel, gender };
}

// Newline-separated only — a comma inside a pasted name (rare, but real:
// "Smith, John" style lists) shouldn't get misread as two players.
function parseNames(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

type DuplicateReason = "existing" | "batch";

// Case-sensitive on purpose — "Alex" and "alex" are treated as different
// names, not normalized to the same identity. Flags a row if its trimmed
// name exactly matches either an existing session player or another row in
// this same batch (both rows in an in-batch collision get flagged, not just
// the second one, so it's clear which two are in conflict).
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

const DEFAULT_LEVEL: SkillLevel = "INTERMEDIATE";

/**
 * One surface, no wizard.
 *
 * This was a two-step flow — paste a list of names, then review a grid and set
 * every player's level and gender. The split was the problem: you'd type twelve
 * names, transition away, and be shown twelve blank gender toggles with no
 * memory of who was who. Bulk entry isn't hard; *batching* the detail entry
 * away from the names is.
 *
 * So a player is completed one at a time in a single quick-add row, and the
 * staged list sits directly beneath it. Pasting still works and produces rows
 * that need finishing — but staging only appears once you actually paste, so
 * adding one person never costs more than typing a name and pressing Enter.
 */
export function AddPlayersModal({ isOpen, onClose, onSubmit, existingPlayerNames }: AddPlayersModalProps) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [draftName, setDraftName] = useState("");
  // Sticky: the quick-add row inherits whatever the last added player used.
  // Clubs check in as clusters — three intermediate men arrive together — so
  // "same as the one before" is right far more often than any fixed default,
  // and it's what reduces the common case to typing a name and pressing Enter.
  const [draftLevel, setDraftLevel] = useState<SkillLevel>(DEFAULT_LEVEL);
  const [draftGender, setDraftGender] = useState<Gender | undefined>(undefined);
  const [bulkLevel, setBulkLevel] = useState<SkillLevel>(DEFAULT_LEVEL);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const isSubmittingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  // GenderToggle doesn't forward a ref itself — this wraps each row's instance
  // so a failed submit can focus its first pill directly, not just scroll the
  // row into view (a keyboard/screen-reader user needs the former).
  const genderToggleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { triggerRef: cancelBtnRef, cancelRef: keepEditingBtnRef } = useConfirmFocus(discardConfirm);
  const { toast, showToast, dismissAndUndo } = useToast();

  const isDirty = rows.length > 0 || draftName.trim().length > 0;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    setRows([]);
    setDraftName("");
    setDraftLevel(DEFAULT_LEVEL);
    setDraftGender(undefined);
    setBulkLevel(DEFAULT_LEVEL);
    setError("");
    setDiscardConfirm(false);
    setIsSaving(false);
    setAttemptedSubmit(false);
    isSubmittingRef.current = false;
    const id = setTimeout(() => quickAddRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  const handleClose = () => {
    // Guards every caller at once (header Close, backdrop click, Escape) —
    // without this any of them could fire mid-submit.
    if (isSaving) return;
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
        if (discardConfirm) setDiscardConfirm(false);
        else handleClose();
        return;
      }
      if (e.key !== "Tab") return;
      const el = dialogRef.current;
      if (!el) return;
      const focusable = Array.from(
        el.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
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
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, discardConfirm, isDirty, isSaving]); // eslint-disable-line react-hooks/exhaustive-deps

  const duplicateNameRowIds = findDuplicateRowIds(rows, existingPlayerNames);

  // Gender is the one field with no defensible default, so it's the only thing
  // that can hold a submit back — hence the count surfaced on the bulk bar.
  const pendingRows = rows.filter((r) => !r.gender);

  // The bulk controls display the rows' shared value rather than the last
  // value applied, so they read back as "everyone is Male" instead of
  // remembering a sweep the rows may have since diverged from. GenderToggle
  // renders "nothing selected" for a mixed set; SkillLevelSelect always needs
  // a concrete level, so it falls back to the last swept one when mixed.
  const commonGender = useMemo(
    () => (rows.length > 0 && rows.every((r) => r.gender === rows[0].gender) ? rows[0].gender : undefined),
    [rows]
  );
  const commonLevel = useMemo(
    () =>
      rows.length > 0 && rows.every((r) => r.skillLevel === rows[0].skillLevel) ? rows[0].skillLevel : null,
    [rows]
  );

  const draftIsDuplicate = useMemo(() => {
    const n = draftName.trim();
    if (!n) return false;
    return existingPlayerNames.has(n) || rows.some((r) => r.name.trim() === n);
  }, [draftName, rows, existingPlayerNames]);

  function commitDraft(gender: Gender | undefined = draftGender) {
    const name = draftName.trim();
    if (!name) return;
    if (draftIsDuplicate) {
      setError(`${name} is already in this session`);
      return;
    }
    setRows((prev) => [...prev, makeRow(name, draftLevel, gender)]);
    setDraftName("");
    // Level and gender deliberately persist — that's the sticky default. The
    // write-back matters when Enter was pressed on a gender pill: that choice
    // has to carry to the next player like any other.
    setDraftGender(gender);
    setError("");
    quickAddRef.current?.focus();
  }

  /**
   * Enter commits from anywhere in the quick-add row, not just the name field.
   *
   * Capture phase on purpose. Two children claim Enter for themselves and would
   * otherwise win: a gender pill is a `<button>`, so Enter fires its click and
   * toggles the gender you just picked back OFF; `SkillLevelSelect`'s trigger
   * opens its dropdown. Intercepting on the way down suppresses both. The
   * dropdown keeps Enter while it is actually open, where it means "choose this
   * level" — and Space / arrow keys still open it, so nothing becomes
   * unreachable by keyboard.
   */
  function handleQuickAddKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.closest('[role="combobox"]')?.getAttribute("aria-expanded") === "true") return;
    // Nothing to commit — leave the focused control's own Enter alone rather
    // than swallowing it for a no-op.
    if (!draftName.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    // Enter on a gender pill reads as "this one, and add" — including a pill
    // that isn't selected yet, which is otherwise two keystrokes.
    const pillGender = target.closest<HTMLElement>("[data-gender]")?.dataset.gender as
      | Gender
      | undefined;
    commitDraft(pillGender ?? draftGender);
  }

  // Pasting a list can't complete anyone — none of them have a gender — so it
  // lands as pending rows rather than pretending to be done.
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!/[\r\n]/.test(text)) return; // single name: let the input handle it
    e.preventDefault();
    const names = parseNames(text);
    if (names.length === 0) return;
    setRows((prev) => [...prev, ...names.map((n) => makeRow(n, draftLevel, undefined))]);
    setDraftName("");
    setError("");
  }

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (error) setError("");
  }

  function removeRow(id: string) {
    // Toast fires here, not inside the setRows updater — StrictMode invokes
    // updaters twice, which would raise two toasts for one removal.
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const row = rows[idx];
    setRows((prev) => prev.filter((r) => r.id !== id));
    showToast(
      `Removed "${row.name.trim()}"`,
      () =>
        setRows((current) => {
          const next = [...current];
          next.splice(Math.min(idx, next.length), 0, row);
          return next;
        }),
      `Undo remove ${row.name.trim()}`
    );
  }

  /**
   * Bulk controls act on EVERY staged row, and stay available for as long as
   * rows are staged.
   *
   * They used to sweep only the rows still missing a gender, which made them a
   * one-shot: the moment you set a gender for all, every row graduated to
   * "ready" and the control had nothing left to reach. Tap the wrong pill and
   * the only way back was editing each row by hand — the exact work the bulk
   * control exists to avoid. A sweep you can't re-aim isn't a bulk edit.
   *
   * Overwriting a hand-edited row is the accepted cost, and the reason each
   * sweep snapshots the previous rows and offers undo. The two fields sweep
   * independently, so re-aiming gender never disturbs levels.
   */
  function applyBulkLevel(level: SkillLevel) {
    if (rows.length === 0) return;
    const snapshot = rows;
    setBulkLevel(level);
    setRows((prev) => prev.map((r) => ({ ...r, skillLevel: level })));
    showToast(
      `Set ${rows.length} to ${SKILL_LABELS[level]}`,
      () => setRows(snapshot),
      "Undo set level"
    );
  }

  function applyBulkGender(gender: Gender | undefined) {
    // GenderToggle deselects when you tap the pill that's already active. Here
    // that would strip the gender from every row and drop them all back into
    // "needs a gender" — a destructive answer to what reads as a no-op tap.
    if (!gender || rows.length === 0) return;
    const snapshot = rows;
    setRows((prev) => prev.map((r) => ({ ...r, gender })));
    showToast(
      `Set ${rows.length} to ${GENDER_LABELS[gender]}`,
      () => setRows(snapshot),
      "Undo set gender"
    );
  }

  async function handleSubmit() {
    // Synchronous re-entrancy guard: `disabled={isSaving}` only blocks a second
    // tap once React re-renders and commits, which lags a fast double-tap by a
    // frame or more (this modal is used courtside on a tablet). A ref check has
    // no such gap, so the same batch can't be submitted twice.
    if (isSubmittingRef.current) return;

    // An unsubmitted draft in the quick-add row is almost certainly meant to be
    // included — losing it silently on submit would be the worst failure here.
    const pendingDraft = draftName.trim();
    let all = rows;
    if (pendingDraft) {
      if (draftIsDuplicate) {
        setError(`${pendingDraft} is already in this session`);
        quickAddRef.current?.focus();
        return;
      }
      all = [...rows, makeRow(pendingDraft, draftLevel, draftGender)];
      setRows(all);
      setDraftName("");
    }

    if (all.length === 0) {
      setError("Add at least one player");
      quickAddRef.current?.focus();
      return;
    }
    const duplicates = findDuplicateRowIds(all, existingPlayerNames);
    if (duplicates.size > 0) {
      setAttemptedSubmit(true);
      setError("Two players can't share the same name");
      return;
    }
    const firstMissingGender = all.find((r) => !r.gender);
    if (firstMissingGender) {
      setAttemptedSubmit(true);
      setError("Every player needs a gender before they can be added");
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rowRefs.current.get(firstMissingGender.id)?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
      genderToggleRefs.current.get(firstMissingGender.id)?.querySelector("button")?.focus();
      return;
    }

    isSubmittingRef.current = true;
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 300));
    onSubmit(all.map((r) => ({ name: r.name.trim(), skillLevel: r.skillLevel, gender: r.gender })));
    setIsSaving(false);
    isSubmittingRef.current = false;
    onClose();
  }

  const totalCount = rows.length + (draftName.trim() ? 1 : 0);
  const submitLabel = totalCount > 1 ? `Add ${totalCount} Players` : "Add Player";

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 bg-bg/70 backdrop-blur-sm z-[var(--z-modal-backdrop)]",
          "transition-opacity duration-200 motion-reduce:transition-none",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
        aria-hidden
      />

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
            "w-full max-w-xl max-h-[85vh] bg-surface border border-border rounded-lg flex flex-col",
            "transition-all duration-200 ease-out motion-reduce:transition-none",
            isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-5 h-14 border-b border-border flex-shrink-0">
            <h2 className="text-base font-semibold text-ink flex-1 truncate">Add Players</h2>
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="text-muted hover:text-ink hover:bg-surface-elevated transition-colors p-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px] min-w-[36px] flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Close"
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>

          {/* Quick add — the whole flow for a single player */}
          <div className="px-5 pt-4 pb-3 flex-shrink-0 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2" onKeyDownCapture={handleQuickAddKeyDown}>
              <input
                ref={quickAddRef}
                type="text"
                value={draftName}
                onChange={(e) => {
                  setDraftName(e.target.value);
                  if (error) setError("");
                }}
                onPaste={handlePaste}
                placeholder="Player name"
                aria-label="Player name"
                aria-invalid={draftIsDuplicate ? true : undefined}
                autoComplete="off"
                className={cn(
                  "flex-1 min-w-0 bg-bg border rounded-md px-3 py-2 text-base sm:text-sm text-ink",
                  "focus:outline-none focus:ring-2 focus:border-primary/50 transition-colors duration-150",
                  draftIsDuplicate
                    ? "border-error/50 focus:ring-error/40"
                    : "border-border focus:ring-primary/50"
                )}
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                <SkillLevelSelect value={draftLevel} onChange={setDraftLevel} className="flex-1 sm:flex-none sm:w-[150px]" />
                <GenderToggle value={draftGender} onChange={setDraftGender} variant="compact" />
                <button
                  onClick={() => commitDraft()}
                  disabled={!draftName.trim() || draftIsDuplicate}
                  className="flex items-center justify-center gap-1 text-xs font-semibold text-bg bg-primary hover:bg-primary-hover px-2.5 h-9 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary"
                  aria-label="Add this player to the list"
                >
                  <CornerDownLeft size={12} strokeWidth={2.5} aria-hidden />
                  Add
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted mt-1.5">
              {draftIsDuplicate
                ? `${draftName.trim()} is already in this session`
                : "Press Enter to add and keep going — level and gender carry over. Paste a list to add several at once."}
            </p>
          </div>

          {/* Staged players.

              One row shape for everyone, in the order they were added. This
              was two — a form row for anyone missing a gender, a compact
              read-back with an Edit button once complete — split across two
              labelled sections. That meant three states to hold in your head
              (which section, which shape, whether a row is in edit mode), and
              rows physically jumped between sections the moment you set a
              gender. Every row now carries the same persistent controls, so
              editing costs nothing and there is no mode to be in. A row
              missing a gender shows it plainly: neither pill is lit. */}
          <div className="flex-1 overflow-y-auto">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-5 text-center">
                <p className="text-sm text-muted">No one added yet</p>
                <p className="text-xs text-muted/70 mt-1">Type a name above and press Enter</p>
              </div>
            ) : (
              <>
                {/* Sticky so a long list can still be re-swept without
                    scrolling back to the top. Its controls sit in the same
                    columns as each row's below, so it reads as the same pair
                    of controls aimed at everyone at once. */}
                {rows.length >= 2 && (
                  <div className="sticky top-0 z-10 flex items-center gap-2 px-5 py-2.5 bg-surface border-b border-border">
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium text-muted uppercase tracking-wide">
                        Set all {rows.length}
                      </span>
                      {pendingRows.length > 0 && (
                        <span className="block text-[11px] text-muted/70">
                          {pendingRows.length} still need a gender
                        </span>
                      )}
                    </div>
                    <SkillLevelSelect
                      value={commonLevel ?? bulkLevel}
                      onChange={applyBulkLevel}
                      className="w-auto"
                      hideLabel
                    />
                    <GenderToggle value={commonGender} onChange={applyBulkGender} variant="compact" />
                    {/* Holds the remove column so the bulk controls line up
                        with the row controls rather than sitting one slot right. */}
                    <span className="w-8 flex-shrink-0" aria-hidden />
                  </div>
                )}

                <ul className="divide-y divide-border/50">
                  {rows.map((row) => (
                    <StagedRow
                      key={row.id}
                      row={row}
                      isDuplicate={duplicateNameRowIds.has(row.id)}
                      duplicateReason={duplicateNameRowIds.get(row.id)}
                      showGenderError={attemptedSubmit}
                      onChange={(patch) => updateRow(row.id, patch)}
                      onRemove={() => removeRow(row.id)}
                      registerRow={(el) => {
                        if (el) rowRefs.current.set(row.id, el);
                        else rowRefs.current.delete(row.id);
                      }}
                      registerGenderToggle={(el) => {
                        if (el) genderToggleRefs.current.set(row.id, el);
                        else genderToggleRefs.current.delete(row.id);
                      }}
                    />
                  ))}
                </ul>
              </>
            )}

            {error && (
              <p className="text-xs text-error px-5 py-3" role="alert">
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
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={isSaving || totalCount === 0}
                  className={cn(
                    "flex-1 bg-primary text-bg text-sm font-semibold py-2.5 rounded-md",
                    "transition-colors duration-150 min-h-[44px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    isSaving || totalCount === 0
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-primary-hover"
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

      {/* Sibling of the dialog box, not inside it — that box carries a
          `scale-*` transform even at rest, which establishes a containing
          block and would anchor ToastViewport's `fixed` positioning to the
          dialog instead of the viewport. */}
      <ToastViewport toast={toast} onDismissAndUndo={dismissAndUndo} />
    </>,
    document.body
  );
}

const DUPLICATE_COPY: Record<DuplicateReason, string> = {
  existing: "Already in this session",
  batch: "Matches another row",
};

/**
 * The one staged-row shape.
 *
 * The name is a borderless input that only draws its edge on hover and focus.
 * It reads as text, so six of them stacked stay calm rather than looking like
 * a six-field form, but it stays directly editable with no Edit button and no
 * mode to enter.
 */
function StagedRow({
  row,
  isDuplicate,
  duplicateReason,
  showGenderError,
  onChange,
  onRemove,
  registerRow,
  registerGenderToggle,
}: {
  row: DraftRow;
  isDuplicate: boolean;
  duplicateReason?: DuplicateReason;
  showGenderError: boolean;
  onChange: (patch: Partial<DraftRow>) => void;
  onRemove: () => void;
  registerRow: (el: HTMLLIElement | null) => void;
  registerGenderToggle: (el: HTMLDivElement | null) => void;
}) {
  return (
    <li
      ref={registerRow}
      className={cn(
        "flex items-center gap-2 px-5 py-2 transition-colors",
        isDuplicate && "bg-error/[0.06]"
      )}
    >
      <div className="flex-1 min-w-0">
        <input
          type="text"
          value={row.name}
          onChange={(e) => onChange({ name: e.target.value })}
          aria-label={`Name for ${row.name || "player"}`}
          aria-invalid={isDuplicate ? true : undefined}
          autoComplete="off"
          className={cn(
            "w-full bg-transparent rounded-md px-2 py-1.5 text-base sm:text-sm text-ink",
            "border transition-colors duration-150",
            "focus:outline-none focus:bg-bg focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
            isDuplicate ? "border-error/50" : "border-transparent hover:border-border"
          )}
        />
        {isDuplicate && duplicateReason && (
          <span className="block px-2 pt-0.5 text-[11px] text-error">
            {DUPLICATE_COPY[duplicateReason]}
          </span>
        )}
      </div>
      <SkillLevelSelect
        value={row.skillLevel}
        onChange={(level) => onChange({ skillLevel: level })}
        className="w-auto"
        hideLabel
      />
      <div ref={registerGenderToggle}>
        <GenderToggle
          value={row.gender}
          onChange={(gender) => onChange({ gender })}
          variant="compact"
          error={showGenderError && !row.gender}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="w-8 h-9 flex items-center justify-center flex-shrink-0 rounded-md text-muted hover:text-error hover:bg-error/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
        aria-label={`Remove ${row.name.trim() || "player"}`}
      >
        <X size={14} strokeWidth={2} aria-hidden />
      </button>
    </li>
  );
}
