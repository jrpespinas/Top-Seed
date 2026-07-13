"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ArrowLeft } from "lucide-react";
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

function makeRow(name: string): DraftRow {
  return {
    id: `draft-${Math.random().toString(36).slice(2)}`,
    name,
    skillLevel: "C",
    gender: undefined,
  };
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

type Step = "paste" | "review";

export function AddPlayersModal({ isOpen, onClose, onSubmit, existingPlayerNames }: AddPlayersModalProps) {
  const [step, setStep] = useState<Step>("paste");
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  // "Set everyone to X" trigger, not a value the grid stays bound to — once a
  // row is hand-edited it can drift from this without the bulk control trying
  // to reflect or fight that. Matches the per-row default ("C") so its
  // initial state isn't a lie about what's already applied.
  const [bulkLevel, setBulkLevel] = useState<SkillLevel>("C");
  // Same "set everyone to X" trigger as bulkLevel, but starts unset — unlike
  // skill level, no row has a real default gender, so a starting value here
  // would claim a choice nobody made.
  const [bulkGender, setBulkGender] = useState<Gender | undefined>(undefined);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const isSubmittingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nameInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const rowCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // GenderToggle doesn't forward a ref itself — this wraps each row's
  // instance so a failed submit can focus its first pill directly, not just
  // scroll the row into view (a keyboard/screen-reader user needs the former).
  const genderToggleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // "Keep editing" is the safe default focused on entering confirm mode;
  // the footer's own Cancel button is what regains focus on exit.
  const { triggerRef: cancelBtnRef, cancelRef: keepEditingBtnRef } = useConfirmFocus(discardConfirm);
  // Same shared toast every reversible action in the app uses (Dashboard,
  // Matches, Players) — not a bespoke undo bar for this one modal.
  const { toast, showToast, dismissAndUndo } = useToast();

  const isDirty =
    step === "paste" ? pasteText.trim().length > 0 : rows.some((r) => r.name.trim().length > 0);

  // Portal target (document.body) only exists client-side; avoids an SSR/hydration mismatch.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setStep("paste");
    setPasteText("");
    setRows([]);
    setBulkLevel("C");
    setBulkGender(undefined);
    setError("");
    setDiscardConfirm(false);
    setIsSaving(false);
    setAttemptedSubmit(false);
    isSubmittingRef.current = false;
    const id = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  const handleClose = () => {
    // Guards every caller at once (header Close, backdrop click, Escape) —
    // without this, any of them could fire mid-submit and either open a
    // discard-confirm that a moment later gets silently swept away when the
    // pending submit resolves and force-closes the modal underneath it, or
    // close the modal while `onSubmit` is still in flight.
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
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, discardConfirm, isDirty, isSaving]); // eslint-disable-line react-hooks/exhaustive-deps

  function goToReview() {
    const names = parseNames(pasteText);
    if (names.length === 0) {
      setError("Paste at least one player's name");
      textareaRef.current?.focus();
      return;
    }
    // Reconcile against whatever's already in `rows` rather than rebuilding
    // from scratch — this function also runs on the Back→edit→Continue
    // round-trip, not just the first paste, so a name that survives the
    // round-trip keeps the skill/gender already set on it instead of every
    // row silently resetting to the "C"/no-gender defaults. Grouped into
    // per-name queues, not a single name-keyed map — two rows sharing a
    // name (already flagged as a duplicate) must each keep their own
    // distinct skill/gender, not collapse onto whichever was constructed
    // last.
    setRows((prevRows) => {
      const byName = new Map<string, DraftRow[]>();
      for (const r of prevRows) {
        const key = r.name.trim();
        const queue = byName.get(key);
        if (queue) queue.push(r);
        else byName.set(key, [r]);
      }
      return names.map((name) => {
        const prev = byName.get(name)?.shift();
        const row = makeRow(name);
        return prev ? { ...row, skillLevel: prev.skillLevel, gender: prev.gender } : row;
      });
    });
    setError("");
    setAttemptedSubmit(false);
    setStep("review");
  }

  // Fires after the review grid's rows (and their input refs) have committed
  // to the DOM — only on the paste-to-review transition, not on every rows
  // change afterward (e.g. removing a row shouldn't yank focus back to the
  // first one).
  useEffect(() => {
    if (step !== "review") return;
    const firstId = rows[0]?.id;
    if (firstId) nameInputRefs.current.get(firstId)?.focus();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function backToPaste() {
    setPasteText(rows.map((r) => r.name).join("\n"));
    setError("");
    setStep("paste");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      goToReview();
    }
  }

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (error) setError("");
  }

  function applyBulkLevel(level: SkillLevel) {
    // Snapshot taken here, outside the setRows updater — showToast (another
    // state setter) must not run inside an updater function, which React can
    // invoke more than once (e.g. Strict Mode) purely to verify it's pure.
    const snapshot = rows;
    setBulkLevel(level);
    setRows((prev) => prev.map((r) => ({ ...r, skillLevel: level })));
    if (snapshot.length > 0) {
      showToast(
        `Set ${snapshot.length} player${snapshot.length !== 1 ? "s" : ""} to ${SKILL_LABELS[level]}`,
        () => setRows(snapshot),
        "Undo set level for all"
      );
    }
  }

  function applyBulkGender(gender: Gender | undefined) {
    setBulkGender(gender);
    // Clicking the already-selected pill deselects it (GenderToggle's own
    // toggle-off behavior) — that only resets this control's own display,
    // it must not mass-clear every row's gender as a side effect.
    if (!gender) return;
    const snapshot = rows;
    setRows((prev) => prev.map((r) => ({ ...r, gender })));
    if (snapshot.length > 0) {
      showToast(
        `Set ${snapshot.length} player${snapshot.length !== 1 ? "s" : ""} to ${GENDER_LABELS[gender]}`,
        () => setRows(snapshot),
        "Undo set gender for all"
      );
    }
  }

  function removeRow(id: string) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;
      const row = prev[idx];
      if (row.name.trim().length > 0) {
        showToast(
          `Removed "${row.name.trim()}"`,
          () => {
            setRows((current) => {
              const next = [...current];
              next.splice(Math.min(idx, next.length), 0, row);
              return next;
            });
          },
          `Undo remove ${row.name.trim()}`
        );
      }
      return prev.filter((r) => r.id !== id);
    });
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = rows[idx + 1];
    if (next) nameInputRefs.current.get(next.id)?.focus();
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
    const firstMissingGender = validRows.find((r) => !r.gender);
    if (firstMissingGender) {
      setAttemptedSubmit(true);
      setError("Select a gender for every player");
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rowCardRefs.current.get(firstMissingGender.id)?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
      genderToggleRefs.current.get(firstMissingGender.id)?.querySelector("button")?.focus();
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

  // Missing-gender stays gated behind a submit attempt on purpose: every row
  // starts with no gender, so showing this live would ring every single card
  // red the instant the grid renders, before the organizer has touched
  // anything — a wall of errors on an empty form, not a helpful signal.
  const missingGenderRowIds = new Set(
    attemptedSubmit
      ? rows.filter((r) => r.name.trim().length > 0 && !r.gender).map((r) => r.id)
      : []
  );

  // Duplicates are live, not gated — unlike missing gender, most rows are
  // never duplicates, so surfacing a collision the moment it exists (from
  // the paste itself, or from a hand-edit that now matches another row)
  // catches it early instead of only at a failed submit attempt.
  const duplicateNameRowIds = findDuplicateRowIds(rows, existingPlayerNames);

  const validCount = rows.filter((r) => r.name.trim()).length;
  const submitLabel = validCount > 1 ? `Add ${validCount} Players` : "Add Player";
  // A single row has no "everyone" for the bulk controls to act on, and a
  // one-item grid cell just looks like an accident — both get a dedicated,
  // roomier treatment instead of shrinking the many-player layout onto one.
  const isSingle = rows.length === 1;

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
            "w-full max-w-2xl max-h-[85vh] bg-surface border border-border rounded-lg flex flex-col",
            "transition-all duration-200 ease-out motion-reduce:transition-none",
            isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-5 h-14 border-b border-border flex-shrink-0">
            {step === "review" && (
              <button
                onClick={backToPaste}
                className="text-muted hover:text-ink hover:bg-surface-elevated transition-colors p-1.5 -ml-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px] min-w-[36px] flex items-center justify-center flex-shrink-0"
                aria-label="Back to paste list"
              >
                <ArrowLeft size={16} strokeWidth={2} aria-hidden />
              </button>
            )}
            <h2 className="text-base font-semibold text-ink flex-1 truncate">
              {step === "paste"
                ? "Add Players"
                : `Review ${validCount} Player${validCount !== 1 ? "s" : ""}`}
            </h2>
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="text-muted hover:text-ink hover:bg-surface-elevated transition-colors p-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px] min-w-[36px] flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              aria-label="Close"
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>

          {/* Content */}
          {step === "paste" ? (
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3">
              <div>
                <label htmlFor="paste-names" className="block text-xs font-medium text-muted mb-1.5">
                  Player names
                </label>
                <textarea
                  id="paste-names"
                  ref={textareaRef}
                  rows={10}
                  value={pasteText}
                  onChange={(e) => {
                    setPasteText(e.target.value);
                    if (error) setError("");
                  }}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={"Paste a list of names — one per line\n\nAlex Chen\nSam Rivera\nJamie Park"}
                  className={cn(
                    "w-full bg-bg border rounded-md px-3 py-2.5 text-base lg:text-sm text-ink resize-none",
                    "placeholder:text-muted",
                    "focus:outline-none focus:ring-2 focus:border-primary/50",
                    "transition-colors duration-150",
                    error ? "border-error/50 focus:ring-error/40" : "border-border focus:ring-primary/50"
                  )}
                />
              </div>
              <p className="text-xs text-muted">
                One name per line — paste straight from a group chat or spreadsheet column.
              </p>
              {error && (
                <p className="text-xs text-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col">
              {/* Bulk level + gender — "set everyone to X" triggers, not
                  values the grid stays bound to. Rows edited individually
                  afterward can drift from these without the controls fighting
                  that — the caption below is what makes that one-shot
                  behavior visible instead of only living in this comment.
                  Laid out side by side to mirror the same skill+gender pairing
                  each row below has, just acting on all of them at once.
                  Meaningless for a single row (nothing else to apply "all" to),
                  so it's skipped there rather than shown inert. */}
              {!isSingle && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted flex-shrink-0">Set for all</span>
                    <SkillLevelSelect value={bulkLevel} onChange={applyBulkLevel} className="w-auto min-w-[140px]" />
                    <GenderToggle value={bulkGender} onChange={applyBulkGender} variant="compact" />
                  </div>
                  <p className="text-[11px] text-muted mt-1">
                    {"Applies to every row immediately — changing either one again will reset any you've customized."}
                  </p>
                </div>
              )}

              {isSingle ? (
                // Centered and generously spaced rather than stretched to
                // fill — this is the one player the organizer is looking at,
                // not a grid cell that happened to end up alone.
                <div className="flex-1 flex items-center justify-center">
                  {rows.map((row, idx) => (
                    <div
                      key={row.id}
                      ref={(el) => {
                        if (el) rowCardRefs.current.set(row.id, el);
                        else rowCardRefs.current.delete(row.id);
                      }}
                      className={cn(
                        "w-full border rounded-lg p-6 space-y-5",
                        duplicateNameRowIds.has(row.id) ? "border-error/50" : "border-border"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <label
                            htmlFor={`player-name-${row.id}`}
                            className="block text-xs font-medium text-muted"
                          >
                            Player name
                          </label>
                          <input
                            id={`player-name-${row.id}`}
                            ref={(el) => {
                              if (el) nameInputRefs.current.set(row.id, el);
                              else nameInputRefs.current.delete(row.id);
                            }}
                            type="text"
                            value={row.name}
                            onChange={(e) => updateRow(row.id, { name: e.target.value })}
                            onKeyDown={(e) => handleNameKeyDown(e, idx)}
                            aria-invalid={duplicateNameRowIds.has(row.id) ? true : undefined}
                            autoComplete="off"
                            className={cn(
                              "w-full bg-bg border rounded-md px-3.5 py-3 text-base text-ink",
                              "focus:outline-none focus:ring-2 focus:border-primary/50",
                              "transition-colors duration-150",
                              duplicateNameRowIds.has(row.id)
                                ? "border-error/50 focus:ring-error/40"
                                : "border-border focus:ring-primary/50"
                            )}
                          />
                          {duplicateNameRowIds.has(row.id) && (
                            <p className="text-xs text-error">
                              {duplicateNameRowIds.get(row.id) === "existing"
                                ? "Already in this session"
                                : "Matches another row"}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="text-muted hover:text-error hover:bg-error/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0 mt-5"
                          aria-label={`Remove ${row.name.trim() || "player"}`}
                        >
                          <X size={16} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <span className="block text-xs font-medium text-muted">Skill level</span>
                          <SkillLevelSelect
                            value={row.skillLevel}
                            onChange={(level) => updateRow(row.id, { skillLevel: level })}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <span className="block text-xs font-medium text-muted">Gender</span>
                          <div
                            ref={(el) => {
                              if (el) genderToggleRefs.current.set(row.id, el);
                              else genderToggleRefs.current.delete(row.id);
                            }}
                          >
                            <GenderToggle
                              value={row.gender}
                              onChange={(gender) => updateRow(row.id, { gender })}
                              variant="full"
                              error={missingGenderRowIds.has(row.id)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rows.map((row, idx) => (
                    <div
                      key={row.id}
                      ref={(el) => {
                        if (el) rowCardRefs.current.set(row.id, el);
                        else rowCardRefs.current.delete(row.id);
                      }}
                      className={cn(
                        "border rounded-md p-3 space-y-2",
                        duplicateNameRowIds.has(row.id) ? "border-error/50" : "border-border"
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            ref={(el) => {
                              if (el) nameInputRefs.current.set(row.id, el);
                              else nameInputRefs.current.delete(row.id);
                            }}
                            type="text"
                            value={row.name}
                            onChange={(e) => updateRow(row.id, { name: e.target.value })}
                            onKeyDown={(e) => handleNameKeyDown(e, idx)}
                            aria-label={`Player ${idx + 1} name`}
                            aria-invalid={duplicateNameRowIds.has(row.id) ? true : undefined}
                            autoComplete="off"
                            className={cn(
                              "w-full bg-bg border rounded-md px-2.5 py-2 text-base lg:text-sm text-ink",
                              "focus:outline-none focus:ring-2 focus:border-primary/50",
                              "transition-colors duration-150",
                              duplicateNameRowIds.has(row.id)
                                ? "border-error/50 focus:ring-error/40"
                                : "border-border focus:ring-primary/50"
                            )}
                          />
                          {duplicateNameRowIds.has(row.id) && (
                            <p className="text-xs text-error">
                              {duplicateNameRowIds.get(row.id) === "existing"
                                ? "Already in this session"
                                : "Matches another row"}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="text-muted hover:text-error hover:bg-error/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 min-h-[36px] min-w-[36px] flex items-center justify-center flex-shrink-0"
                          aria-label={`Remove ${row.name.trim() || `player ${idx + 1}`}`}
                        >
                          <X size={14} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <SkillLevelSelect
                          value={row.skillLevel}
                          onChange={(level) => updateRow(row.id, { skillLevel: level })}
                          className="flex-1"
                          hideLabel
                        />
                        <div
                          ref={(el) => {
                            if (el) genderToggleRefs.current.set(row.id, el);
                            else genderToggleRefs.current.delete(row.id);
                          }}
                        >
                          <GenderToggle
                            value={row.gender}
                            onChange={(gender) => updateRow(row.id, { gender })}
                            variant="compact"
                            error={missingGenderRowIds.has(row.id)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <p className="text-xs text-error mt-3" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}

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
                {step === "paste" ? (
                  <button
                    onClick={goToReview}
                    className="flex-1 bg-primary text-bg text-sm font-semibold py-2.5 rounded-md transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-h-[44px]"
                  >
                    Continue
                  </button>
                ) : (
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
                )}
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

      {/* Rendered as a sibling of the dialog box, not inside it — that box
          has a `scale-*` transform even at rest, which establishes a new
          containing block and would anchor ToastViewport's `fixed`
          positioning to the dialog instead of the true viewport. */}
      <ToastViewport toast={toast} onDismissAndUndo={dismissAndUndo} />
    </>,
    document.body
  );
}
