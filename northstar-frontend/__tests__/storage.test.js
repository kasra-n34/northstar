import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pruneAndCompressLogs } from "../src/storage.js";

// pruneAndCompressLogs(logs, retentionWeeks) — pure logic, no I/O
describe("pruneAndCompressLogs", () => {
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  function makeLog(daysAgo, extra = {}) {
    const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    return { id: `log-${daysAgo}`, date, answers: { q: "answer" }, ...extra };
  }

  it("returns empty array for empty input", () => {
    expect(pruneAndCompressLogs([], 4)).toEqual([]);
  });

  it("keeps logs within retention window", () => {
    const logs = [makeLog(3), makeLog(10), makeLog(20)];
    const result = pruneAndCompressLogs(logs, 4); // 28-day window
    expect(result).toHaveLength(3);
  });

  it("drops logs older than retention window", () => {
    const logs = [makeLog(3), makeLog(10), makeLog(35)]; // 35 days > 4 weeks
    const result = pruneAndCompressLogs(logs, 4);
    expect(result).toHaveLength(2);
    expect(result.find(l => l.id === "log-35")).toBeUndefined();
  });

  it("compresses logs older than 1 week by nulling answers", () => {
    const logs = [makeLog(2), makeLog(10)]; // 10 days > 1 week
    const result = pruneAndCompressLogs(logs, 4);
    const recent = result.find(l => l.id === "log-2");
    const old    = result.find(l => l.id === "log-10");
    expect(recent.answers).not.toBeNull();
    expect(old.answers).toBeNull();
    expect(old.compressed).toBe(true);
  });

  it("does not re-compress already compressed logs", () => {
    const log = makeLog(10, { compressed: true, answers: null });
    const result = pruneAndCompressLogs([log], 4);
    expect(result[0].compressed).toBe(true);
    expect(result[0].answers).toBeNull();
  });

  it("respects custom retentionWeeks", () => {
    const logs = [makeLog(3), makeLog(10), makeLog(20)];
    const result = pruneAndCompressLogs(logs, 1); // 7-day window only
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("log-3");
  });
});
