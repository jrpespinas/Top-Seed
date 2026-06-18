import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "../../components/ui/button.js";
import { FormField } from "../../components/ui/form-field.js";
import { Select } from "../../components/ui/select.js";
import { createSessionLocal } from "../../mutations/createSession.js";
import { flushOutbox } from "../../sync/syncEngine.js";
import { getConnectionStatus } from "../../sync/connection.js";
import {
  defaultSessionFormValues,
  defaultStartsAtLocal,
  sessionFormSchema,
  toIsoDateTime,
  type SessionFormValues,
} from "./session-form.js";

export function NewSessionPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<SessionFormValues>({
    ...defaultSessionFormValues,
    startsAtLocal: defaultStartsAtLocal(),
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SessionFormValues, string>>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  function updateField<K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);

    const parsed = sessionFormSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof SessionFormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SessionFormValues;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setBusy(true);
    try {
      const sessionId = crypto.randomUUID();
      const startsAt = toIsoDateTime(parsed.data.startsAtLocal);
      await createSessionLocal({
        id: sessionId,
        name: parsed.data.name,
        venueName: parsed.data.venueName,
        startsAt,
        feeAmount: parsed.data.feeAmount,
        currency: parsed.data.currency,
        courtCount: parsed.data.courtCount,
        queueMode: parsed.data.queueMode,
        ratingMode: parsed.data.ratingMode,
        startImmediately: true,
      });

      if (getConnectionStatus()) {
        await flushOutbox(sessionId);
      }

      await navigate({
        to: "/organizer/sessions/$sessionId/dashboard",
        params: { sessionId },
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link to="/organizer/sessions" className="text-caption text-primary hover:underline">
          ← Back to sessions
        </Link>
        <h1 className="mt-2 text-heading font-semibold">New session</h1>
        <p className="mt-1 text-body text-muted-foreground">
          Set up courts, fee, and queue rules for tonight&apos;s open play.
        </p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 rounded-card border border-border bg-surface p-4">
        <FormField label="Session name" htmlFor="session-name" error={errors.name}>
          <input
            id="session-name"
            className="min-h-touch w-full rounded-control border border-border px-3 py-2 text-body"
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Tuesday Open Play"
          />
        </FormField>

        <FormField label="Venue" htmlFor="venue-name" error={errors.venueName}>
          <input
            id="venue-name"
            className="min-h-touch w-full rounded-control border border-border px-3 py-2 text-body"
            value={values.venueName}
            onChange={(event) => updateField("venueName", event.target.value)}
            placeholder="Courts 1–4"
          />
        </FormField>

        <FormField label="Start time" htmlFor="starts-at" error={errors.startsAtLocal}>
          <input
            id="starts-at"
            type="datetime-local"
            className="min-h-touch w-full rounded-control border border-border px-3 py-2 text-body"
            value={values.startsAtLocal}
            onChange={(event) => updateField("startsAtLocal", event.target.value)}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Session fee" htmlFor="fee-amount" error={errors.feeAmount}>
            <input
              id="fee-amount"
              type="number"
              min={0}
              className="min-h-touch w-full rounded-control border border-border px-3 py-2 text-body tabular-nums"
              value={values.feeAmount}
              onChange={(event) => updateField("feeAmount", Number(event.target.value))}
            />
          </FormField>
          <FormField label="Currency" htmlFor="currency" error={errors.currency}>
            <input
              id="currency"
              className="min-h-touch w-full rounded-control border border-border px-3 py-2 text-body"
              value={values.currency}
              onChange={(event) => updateField("currency", event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Court count" htmlFor="court-count" error={errors.courtCount}>
          <input
            id="court-count"
            type="number"
            min={2}
            max={8}
            className="min-h-touch w-full rounded-control border border-border px-3 py-2 text-body tabular-nums"
            value={values.courtCount}
            onChange={(event) => updateField("courtCount", Number(event.target.value))}
          />
        </FormField>

        <FormField
          label="Queue mode"
          hint={
            values.queueMode === "manual"
              ? "Manual queue hides match suggestions on the dashboard (Phase 6). Lanes still work."
              : "Suggested matches help the queue master stage fair doubles."
          }
        >
          <Select
            value={values.queueMode}
            onValueChange={(value) => updateField("queueMode", value as SessionFormValues["queueMode"])}
            options={[
              { value: "suggested", label: "Suggested matches" },
              { value: "manual", label: "Manual queue only" },
            ]}
          />
        </FormField>

        <FormField
          label="Rating mode"
          hint={
            values.ratingMode === "rated"
              ? "Wins and draws can change player ratings. Unscored and cancelled matches do not."
              : "Casual mode tracks stats without changing ratings."
          }
        >
          <Select
            value={values.ratingMode}
            onValueChange={(value) => updateField("ratingMode", value as SessionFormValues["ratingMode"])}
            options={[
              { value: "casual", label: "Casual" },
              { value: "rated", label: "Rated" },
            ]}
          />
        </FormField>

        {formError ? <p className="text-caption text-danger">{formError}</p> : null}

        <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-3 border-t border-border bg-surface px-4 py-3">
          <Button type="submit" size="large" isLoading={busy}>
            Create session
          </Button>
          <Link to="/organizer/sessions">
            <Button type="button" variant="ghost" size="large">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </section>
  );
}
