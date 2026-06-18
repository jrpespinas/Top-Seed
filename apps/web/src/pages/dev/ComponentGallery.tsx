import type { ChangeEvent, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CourtCard } from "../../components/domain/court-card.js";
import { MatchCard } from "../../components/domain/match-card.js";
import { MetricCard } from "../../components/domain/metric-card.js";
import { OfflineBanner } from "../../components/domain/offline-banner.js";
import { PaymentBadge } from "../../components/domain/payment-badge.js";
import { PlayerRow } from "../../components/domain/player-row.js";
import { StatusBadge } from "../../components/domain/status-badge.js";
import { SyncStatusBadge } from "../../components/domain/sync-status-badge.js";
import { Button } from "../../components/ui/button.js";
import { Card, CardBody, CardHeader } from "../../components/ui/card.js";
import { ConfirmAction } from "../../components/ui/confirm-action.js";
import { DataList } from "../../components/ui/data-list.js";
import { Drawer } from "../../components/ui/drawer.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import { FormField } from "../../components/ui/form-field.js";
import { SearchInput } from "../../components/ui/search-input.js";
import { Select } from "../../components/ui/select.js";
import { Tabs } from "../../components/ui/tabs.js";
import { useToast } from "../../components/ui/toast.js";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-card border border-border bg-surface p-4">
      <h2 className="text-heading font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function ComponentGallery() {
  const { showToast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [queueMode, setQueueMode] = useState("suggested");

  return (
    <div className="space-y-8 pb-12">
      <header>
        <p className="text-caption text-muted-foreground">
          <Link to="/organizer/sessions" className="text-primary hover:underline">
            ← Back to sessions
          </Link>
        </p>
        <h1 className="mt-2 text-heading font-semibold">Component gallery</h1>
        <p className="mt-1 text-body text-muted-foreground">
          DEV-only showcase for Phase 4 primitives and domain components. Large buttons use{" "}
          <code className="text-caption">min-h-touch</code> (2.75rem) for courtside tap targets.
        </p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="large">Large courtside</Button>
          <Button isLoading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Form & search">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Player search" htmlFor="gallery-search">
            <SearchInput
              id="gallery-search"
              placeholder="Search players…"
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
            />
          </FormField>
          <FormField label="Queue mode" hint="Used on session create (Phase 5)">
            <Select
              value={queueMode}
              onValueChange={setQueueMode}
              options={[
                { value: "suggested", label: "Suggested" },
                { value: "manual", label: "Manual" },
              ]}
            />
          </FormField>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open drawer
          </Button>
          <ConfirmAction
            triggerLabel="Complete session"
            title="Complete this session?"
            description="Players still waiting will be marked done."
            confirmLabel="Complete"
            variant="danger"
            onConfirm={async () => {
              await new Promise((resolve) => setTimeout(resolve, 300));
            }}
          />
          <Button
            onClick={() =>
              showToast({ title: "Player checked in", description: "Saved locally.", variant: "success" })
            }
          >
            Show toast
          </Button>
        </div>
      </Section>

      <Section title="Tabs (mobile pegboard preview)">
        <Tabs
          items={[
            { value: "now", label: "Now", content: <p className="text-body">Court board content</p> },
            { value: "next", label: "Next", content: <p className="text-body">Queue lanes content</p> },
            {
              value: "available",
              label: "Available",
              content: <p className="text-body">Player pool content</p>,
            },
          ]}
          defaultValue="now"
        />
      </Section>

      <Section title="Badges & banners">
        <div className="flex flex-wrap gap-2">
          <StatusBadge type="queue" status="waiting" />
          <StatusBadge type="queue" status="playing" />
          <PaymentBadge status="unpaid" amountDue={150} />
          <PaymentBadge status="paid" amountDue={150} />
          <SyncStatusBadge status="pending" />
          <SyncStatusBadge status="synced" />
          <SyncStatusBadge status="failed" lastError="Network timeout" />
        </div>
        <OfflineBanner
          connectionStatus="offline"
          syncStatus="pending"
          pendingCount={2}
          failedCount={0}
        />
      </Section>

      <Section title="Metrics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Waiting" value="8" tone="neutral" />
          <MetricCard label="Open courts" value="2" tone="success" />
          <MetricCard label="Unpaid" value="3" tone="warning" actionLabel="View" onAction={() => undefined} />
          <MetricCard label="Active matches" value="4" tone="info" />
        </div>
      </Section>

      <Section title="Player rows">
        <DataList<{ id: string; name: string; status: string }>
          items={[
            { id: "1", name: "Alex Chen", status: "waiting" },
            { id: "2", name: "Jordan Lee", status: "resting" },
          ]}
          keyExtractor={(item) => item.id}
          renderItem={(item) => (
            <PlayerRow
              player={{ id: item.id, displayName: item.name }}
              checkIn={{
                queueStatus: item.status,
                sessionSkillRating: 3.4,
                checkedInAt: new Date(Date.now() - 12 * 60_000).toISOString(),
                matchesPlayed: 2,
              }}
              payment={{ status: "unpaid", amountDue: 150 }}
              actions={[{ label: "Add to next match", onSelect: () => undefined }]}
            />
          )}
        />
      </Section>

      <Section title="Court & match cards">
        <div className="grid gap-4 lg:grid-cols-2">
          <CourtCard
            court={{ id: "c1", name: "Court 1" }}
            uiStatus="inProgress"
            teamSlots={{
              teamA: [
                { id: "p1", displayName: "Alex Chen", slotLabel: "A1" },
                { id: "p2", displayName: "Jordan Lee", slotLabel: "A2" },
              ],
              teamB: [
                { id: "p3", displayName: "Sam Rivera", slotLabel: "B1" },
                { id: "p4", displayName: "Casey Park", slotLabel: "B2" },
              ],
            }}
            primaryAction={{ label: "Finish match", onClick: () => undefined }}
          />
          <MatchCard
            variant="queued"
            queueLaneName="Lane A"
            match={{
              id: "m1",
              status: "queued",
              teams: [
                { name: "Team A", players: ["Alex Chen", "Jordan Lee"] },
                { name: "Team B", players: ["Sam Rivera", "Casey Park"] },
              ],
            }}
            actions={[{ label: "Send to court", onClick: () => undefined }]}
          />
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState
          title="No players checked in"
          description="Check in walk-ins to start building the queue."
          action={<Button size="large">Check in player</Button>}
        />
      </Section>

      <Drawer
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Player details"
        description="Drawer footer actions stay reachable on mobile."
        side="bottom"
        footerActions={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
              Close
            </Button>
            <Button>Mark paid</Button>
          </div>
        }
      >
        <Card>
          <CardHeader>
            <h3 className="text-title font-semibold">Alex Chen</h3>
          </CardHeader>
          <CardBody>
            <p className="text-body text-muted-foreground">Session skill rating 3.4 · Unpaid ₱150</p>
          </CardBody>
        </Card>
      </Drawer>
    </div>
  );
}
