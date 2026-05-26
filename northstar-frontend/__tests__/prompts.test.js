import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getLastSunday,
  getNextSunday,
  isSunday,
  checkinDoneThisWeek,
  buildInterviewQuestions,
} from "../src/prompts.js";

// ─── Date helpers ─────────────────────────────────────────────────────────────

describe("getLastSunday", () => {
  afterEach(() => vi.useRealTimers());

  it("returns today at midnight when today is Sunday", () => {
    // 2024-01-07 is a Sunday
    vi.setSystemTime(new Date("2024-01-07T14:30:00"));
    const result = getLastSunday();
    expect(result.getDay()).toBe(0);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it("returns the most recent Sunday when today is mid-week", () => {
    // 2024-01-10 is a Wednesday — last Sunday was 2024-01-07
    vi.setSystemTime(new Date("2024-01-10T10:00:00"));
    const result = getLastSunday();
    expect(result.getDay()).toBe(0);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(7);
  });

  it("returns the most recent Sunday when today is Saturday", () => {
    // 2024-01-13 is Saturday — last Sunday was 2024-01-07
    vi.setSystemTime(new Date("2024-01-13T23:59:59"));
    const result = getLastSunday();
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(7);
  });
});

describe("getNextSunday", () => {
  afterEach(() => vi.useRealTimers());

  it("returns a future Sunday (not today) when today is Sunday", () => {
    vi.setSystemTime(new Date("2024-01-07T10:00:00")); // Sunday
    const result = getNextSunday();
    expect(result.getDay()).toBe(0);
    // Should be 7 days ahead, not today
    expect(result.getDate()).toBe(14);
  });

  it("returns the upcoming Sunday when today is mid-week", () => {
    vi.setSystemTime(new Date("2024-01-10T10:00:00")); // Wednesday
    const result = getNextSunday();
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(14);
  });
});

describe("isSunday", () => {
  afterEach(() => vi.useRealTimers());

  it("returns true on a Sunday", () => {
    vi.setSystemTime(new Date("2024-01-07T12:00:00"));
    expect(isSunday()).toBe(true);
  });

  it("returns false on a non-Sunday", () => {
    vi.setSystemTime(new Date("2024-01-10T12:00:00")); // Wednesday
    expect(isSunday()).toBe(false);
  });
});

describe("checkinDoneThisWeek", () => {
  afterEach(() => vi.useRealTimers());

  it("returns false when lastInterviewDate is null", () => {
    expect(checkinDoneThisWeek(null)).toBe(false);
  });

  it("returns false when last check-in was before this Sunday", () => {
    vi.setSystemTime(new Date("2024-01-10T12:00:00")); // Wednesday
    // Last Sunday was Jan 7 — check-in on Jan 6 (Saturday before) is stale
    expect(checkinDoneThisWeek("2024-01-06T20:00:00.000Z")).toBe(false);
  });

  it("returns true when last check-in was after this Sunday", () => {
    vi.setSystemTime(new Date("2024-01-10T12:00:00")); // Wednesday
    // Last Sunday was Jan 7 — check-in on Jan 8 (Monday) counts
    expect(checkinDoneThisWeek("2024-01-08T10:00:00.000Z")).toBe(true);
  });

  it("returns true when last check-in was on Sunday itself", () => {
    vi.setSystemTime(new Date("2024-01-07T22:00:00")); // Sunday evening
    expect(checkinDoneThisWeek("2024-01-07T18:00:00.000Z")).toBe(true);
  });
});

// ─── buildInterviewQuestions ──────────────────────────────────────────────────

describe("buildInterviewQuestions", () => {
  const analyses = {
    physicality: { priorityScore: 60 },
    affluence:   { priorityScore: 55 },
    network:     { priorityScore: 50 },
    social:      { priorityScore: 45 },
  };

  it("always includes the opening week_overall question", () => {
    const qs = buildInterviewQuestions(analyses);
    expect(qs.some(q => q.key === "week_overall")).toBe(true);
  });

  it("includes physicality questions when physicality has an analysis", () => {
    const qs = buildInterviewQuestions(analyses);
    expect(qs.some(q => q.pillar === "physicality")).toBe(true);
  });

  it("includes affluence questions when affluence has an analysis", () => {
    const qs = buildInterviewQuestions(analyses);
    expect(qs.some(q => q.pillar === "affluence")).toBe(true);
  });

  it("excludes questions for pillars with no analysis", () => {
    const qs = buildInterviewQuestions({ physicality: { priorityScore: 60 } });
    expect(qs.some(q => q.pillar === "affluence")).toBe(false);
    expect(qs.some(q => q.pillar === "network")).toBe(false);
    expect(qs.some(q => q.pillar === "social")).toBe(false);
  });

  it("does not include job_search_active question (removed feature)", () => {
    const qs = buildInterviewQuestions(analyses);
    expect(qs.some(q => q.key === "job_search_active")).toBe(false);
  });

  it("returns an array", () => {
    expect(Array.isArray(buildInterviewQuestions({}))).toBe(true);
  });
});
