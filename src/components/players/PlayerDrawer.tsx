"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkillLevelSelect } from "@/components/ui/SkillLevelSelect";
import { GenderToggle, GENDER_LABELS } from "@/components/ui/GenderToggle";
import { useConfirmFocus } from "@/hooks/useConfirmFocus";
import type { Player, SkillLevel, Gender } from "@/types";

interface PlayerFormData {
  name: string;
  skillLevel: SkillLevel;
  gender?: Gender;
  notes: string;
}

const defaultForm: PlayerFormData = {
  name: "",
  skillLevel: "C",
  gender: undefined,
  notes: "",
};

interface PlayerDrawerProps {
  isOpen: boolean;
  editingPlayer: Player | null;
  onClose: () => void;
  onSave: (data: PlayerFormData) => void;
  onRemove: () => void;
}

export function PlayerDrawer({
  isOpen,
  editingPlayer,
  onClose,
  onSave,
  onRemove,
}: PlayerDrawerProps) {
  const [formData, setFormData] = useState<PlayerFormData>(defaultForm);
  const [isDirty, setIsDirty] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  // "Keep editing" is the safe default focused on entering confirm mode;
  // the footer's own Cancel button is what regains focus on exit.
  const { triggerRef: cancelBtnRef, cancelRef: keepEditingBtnRef } = useConfirmFocus(discardConfirm);

  // Sync form data when drawer opens
  useEffect(() => {
    if (!isOpen) return;
    setFormData(
      editingPlayer
        ? {
            name: editingPlayer.name,
            skillLevel: editingPlayer.skillLevel,
            gender: editingPlayer.gender,
            notes: editingPlayer.notes ?? "",
          }
        : defaultForm
    );
    setError("");
    setIsDirty(false);
    setDiscardConfirm(false);
    setIsSaving(false);
    isSavingRef.current = false;
    // Focus name input after transition
    const id = setTimeout(() => nameInputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen, editingPlayer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key handler + focus trap
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
      const el = drawerRef.current;
      if (!el) return;
      const focusable = Array.from(
        el.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
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

  const handleClose = () => {
    if (isDirty) {
      setDiscardConfirm(true);
      return;
    }
    onClose();
  };

  const handleSave = async () => {
    // Synchronous re-entrancy guard: `disabled={isSaving}` only blocks a second
    // tap once React re-renders and commits, which lags a fast double-tap by a
    // frame or more (this drawer is used courtside on a tablet — see PRD "Speed
    // over completeness"). This ref check has no such gap.
    if (isSavingRef.current) return;
    if (!formData.name.trim()) {
      setError("Name is required");
      nameInputRef.current?.focus();
      return;
    }
    if (formData.name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      nameInputRef.current?.focus();
      return;
    }
    isSavingRef.current = true;
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 300));
    onSave({ ...formData, name: formData.name.trim() });
    setIsDirty(false);
    setIsSaving(false);
    isSavingRef.current = false;
    onClose();
  };

  const handleRemove = () => {
    onRemove();
    onClose();
  };

  const skillChanged =
    editingPlayer && formData.skillLevel !== editingPlayer.skillLevel;

  return (
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

      {/* Drawer panel */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={editingPlayer ? "Edit player" : "Add player"}
        aria-hidden={!isOpen}
        className={cn(
          "fixed top-0 right-0 bottom-0 z-[var(--z-modal)]",
          "w-full sm:w-[440px]",
          "bg-surface border-l border-border",
          "flex flex-col",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-ink">
            {editingPlayer ? "Edit Player" : "Add Player"}
          </h2>
          <button
            onClick={handleClose}
            className="text-muted hover:text-ink hover:bg-surface-elevated transition-colors p-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Close drawer"
          >
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
          {/* Name */}
          <div>
            <label
              htmlFor="player-name"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              Name
            </label>
            <input
              id="player-name"
              ref={nameInputRef}
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData((f) => ({ ...f, name: e.target.value }));
                setIsDirty(true);
                if (error) setError("");
              }}
              placeholder="Player's full name"
              autoComplete="off"
              className={cn(
                "w-full bg-bg border rounded-md px-3 py-2.5 text-base lg:text-sm text-ink",
                "placeholder:text-muted",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                "transition-colors duration-150",
                error ? "border-error" : "border-border"
              )}
            />
            {error && (
              <p className="text-xs text-error mt-1.5" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* Skill Level */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Skill Level
            </label>
            <SkillLevelSelect
              value={formData.skillLevel}
              onChange={(level) => {
                setFormData((f) => ({ ...f, skillLevel: level }));
                setIsDirty(true);
              }}
              className="w-full"
            />
            {skillChanged && (
              <p className="flex items-center gap-1.5 text-xs text-muted mt-2">
                <span
                  className="inline-block w-1 h-1 rounded-full bg-primary flex-shrink-0"
                  aria-hidden
                />
                Changing skill level creates a history entry
              </p>
            )}
          </div>

          {/* Gender */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-ink mb-1.5">
              Gender
              <span className="font-normal text-muted text-xs">· optional</span>
            </label>
            <GenderToggle
              value={formData.gender}
              onChange={(gender) => {
                setFormData((f) => ({ ...f, gender }));
                setIsDirty(true);
              }}
              variant="full"
            />
            <p className="text-xs text-muted mt-1.5">
              {formData.gender
                ? `${GENDER_LABELS[formData.gender]} — click to deselect`
                : "Not specified"}
            </p>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="player-notes"
              className="flex items-center gap-1.5 text-sm font-medium text-ink mb-1.5"
            >
              Notes
              <span className="font-normal text-muted text-xs">· private</span>
            </label>
            <textarea
              id="player-notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => {
                setFormData((f) => ({ ...f, notes: e.target.value }));
                setIsDirty(true);
              }}
              placeholder="Organizer notes about this player…"
              className={cn(
                "w-full bg-bg border border-border rounded-md px-3 py-2.5 text-base lg:text-sm text-ink",
                "placeholder:text-muted",
                "resize-none",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                "transition-colors duration-150"
              )}
            />
          </div>

          {/* Remove from session — edit mode only */}
          {editingPlayer && (
            <div className="pt-5 border-t border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-ink">
                    Remove from session
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Takes them out of the queue or bench. Undo for a few seconds after.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="flex-shrink-0 text-sm font-semibold text-error hover:text-error/80 transition-colors px-3 py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 min-h-[36px]"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {discardConfirm ? (
          <div className="flex items-center gap-3 px-5 py-4 border-t border-border flex-shrink-0">
            <p className="text-sm text-muted flex-1">Discard unsaved changes?</p>
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
                Unsaved changes
              </p>
            )}
            <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "flex-1 bg-primary text-bg text-sm font-semibold py-2.5 rounded-md",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                "min-h-[44px]",
                isSaving
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:bg-primary-hover"
              )}
            >
              {isSaving
                ? "Saving…"
                : editingPlayer
                ? "Save Changes"
                : "Add Player"}
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
      </aside>
    </>
  );
}
