import { describe, it, expect } from "vitest";
import { appendSampleTo, pruneStore, type WaitSample, type WaitTrendStore } from "./wait-trend";

const T0 = Date.parse("2026-09-04T19:00:00.000Z");
const sample = (offsetSec: number, avgMin = 4, waiting = 5): WaitSample => ({
  at: new Date(T0 + offsetSec * 1000).toISOString(),
  avgMs: avgMin * 60_000,
  waiting,
});

describe("appendSampleTo", () => {
  it("appends to an empty series", () => {
    expect(appendSampleTo([], sample(0))).toHaveLength(1);
  });

  it("appends once a full interval has passed", () => {
    const series = appendSampleTo([], sample(0));
    expect(appendSampleTo(series, sample(60))).toHaveLength(2);
  });

  // The recorder is mounted app-wide and must stay safe if it ever mounts
  // twice: two live copies produce one series, not two interleaved ones.
  it("ignores a sample taken moments after the last", () => {
    const series = appendSampleTo([], sample(0));
    expect(appendSampleTo(series, sample(1))).toBe(series);
    expect(appendSampleTo(series, sample(30))).toBe(series);
  });

  it("caps the series rather than growing without bound", () => {
    let series: WaitSample[] = [];
    for (let i = 0; i < 600; i++) series = appendSampleTo(series, sample(i * 60));
    expect(series).toHaveLength(480);
    // The oldest are dropped, not the newest.
    expect(series[series.length - 1].at).toBe(sample(599 * 60).at);
  });

  it("never mutates the series it is given", () => {
    const series = appendSampleTo([], sample(0));
    const before = [...series];
    appendSampleTo(series, sample(120));
    expect(series).toEqual(before);
  });
});

describe("pruneStore", () => {
  it("keeps only sessions the app still knows about", () => {
    const store: WaitTrendStore = {
      live: [sample(0)],
      archived: [sample(0)],
      forgotten: [sample(0)],
    };
    expect(Object.keys(pruneStore(store, ["live", "archived"])).sort()).toEqual([
      "archived",
      "live",
    ]);
  });

  // A store that only ever grew would be a quiet localStorage leak across
  // months of play.
  it("caps how many sessions it will retain", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `s${i}`);
    const store: WaitTrendStore = Object.fromEntries(ids.map((id) => [id, [sample(0)]]));
    expect(Object.keys(pruneStore(store, ids))).toHaveLength(8);
  });

  it("survives an empty store and an empty keep list", () => {
    expect(pruneStore({}, ["a"])).toEqual({});
    expect(pruneStore({ a: [sample(0)] }, [])).toEqual({});
  });
});
