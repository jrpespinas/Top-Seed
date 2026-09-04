"use client";

import { useEffect } from "react";
import { computeWaitingStats, type QueueWaitSource } from "./player-stats";

export interface WaitSample {
  /** ISO instant the sample was taken. */
  at: string;
  /** Mean wait across everyone queuing at that moment, in ms. */
  avgMs: number;
  /** How many were waiting — an average of one is a different fact to one of ten. */
  waiting: number;
}

export type WaitTrendStore = Record<string, WaitSample[]>;

const STORAGE_KEY = "topseed:wait-trend";

/** One sample a minute is plenty for a three-hour session. */
export const SAMPLE_INTERVAL_MS = 60_000;

/**
 * Slightly under the interval, so a sample isn't skipped by timer drift — but
 * far enough above zero that a second mounted recorder can't double-record.
 * The recorder is deliberately safe to mount more than once for this reason.
 */
const MIN_SAMPLE_GAP_MS = 55_000;

/** Eight hours at one a minute. Longer than any session, bounded regardless. */
const MAX_SAMPLES = 480;

/** Roughly the archive's depth; trends for sessions past it are dead weight. */
const MAX_SESSIONS = 8;

/**
 * Appends a sample unless one was taken moments ago.
 *
 * Pure, and the reason the recorder can be mounted in more than one place: two
 * live copies produce one series, not two interleaved ones.
 */
export function appendSampleTo(series: WaitSample[], sample: WaitSample): WaitSample[] {
  const last = series[series.length - 1];
  if (last) {
    const gap = new Date(sample.at).getTime() - new Date(last.at).getTime();
    if (gap < MIN_SAMPLE_GAP_MS) return series;
  }
  const next = [...series, sample];
  return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next;
}

/**
 * Drops trends for sessions the app no longer knows about.
 *
 * `keepIds` comes from the caller's own session list, so this can never
 * outlive the archive it shadows — a store that only ever grew would be a
 * quiet localStorage leak across months of play.
 */
export function pruneStore(store: WaitTrendStore, keepIds: string[]): WaitTrendStore {
  const keep = new Set(keepIds.slice(0, MAX_SESSIONS));
  const next: WaitTrendStore = {};
  for (const [id, series] of Object.entries(store)) {
    if (keep.has(id)) next[id] = series;
  }
  return next;
}

function readStore(): WaitTrendStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as WaitTrendStore) : {};
  } catch {
    // Unreadable or unparseable storage means no trend, never a crash.
    return {};
  }
}

function writeStore(store: WaitTrendStore) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota or a privacy mode. The live page is unaffected; only the trend is.
  }
}

export function readWaitTrend(sessionId: string | null): WaitSample[] {
  if (!sessionId || typeof window === "undefined") return [];
  return readStore()[sessionId] ?? [];
}

/**
 * Samples the live queue's average wait once a minute.
 *
 * Mounted app-wide rather than on `/players`, because that page is not where an
 * organiser spends a session — sampling only while it was open would leave the
 * trend full of holes exactly when the queue was busiest. It still only covers
 * time the app itself was open; there is no background execution to lean on.
 */
export function useWaitTrendRecorder(
  sessionId: string | null,
  queue: QueueWaitSource[],
  knownSessionIds: string[]
) {
  // Held in a ref-free closure via the effect's own dependency list: the
  // interval reads the latest queue through a ref-like re-subscribe on change,
  // which is cheap because the queue only changes on real roster edits.
  useEffect(() => {
    if (!sessionId || queue.length === 0) return;

    const take = () => {
      const now = Date.now();
      const stats = computeWaitingStats(queue, now);
      if (stats.averageMs === null) return;

      const store = readStore();
      const series = appendSampleTo(store[sessionId] ?? [], {
        at: new Date(now).toISOString(),
        avgMs: stats.averageMs,
        waiting: stats.waiting.length,
      });
      writeStore(pruneStore({ ...store, [sessionId]: series }, [sessionId, ...knownSessionIds]));
    };

    take();
    const id = setInterval(take, SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [sessionId, queue, knownSessionIds]);
}
