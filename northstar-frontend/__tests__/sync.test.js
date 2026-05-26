import { describe, it, expect } from "vitest";
import { computeAlgorithmicScore } from "../src/sync.js";

// computeAlgorithmicScore(pillarId, prevScore, missions, completedMissions, missionCompletedAt, recurringMissions)

describe("computeAlgorithmicScore", () => {
  const PILLAR = "physicality";

  it("returns null when prevScore is null (first sync — no baseline)", () => {
    expect(computeAlgorithmicScore(PILLAR, null, [], [], {}, [])).toBeNull();
  });

  it("returns unchanged score when no missions exist", () => {
    const result = computeAlgorithmicScore(PILLAR, 50, [], [], {}, []);
    expect(result).not.toBeNull();
    expect(result.baseScore).toBe(50);
    expect(result.delta).toBe(0);
    expect(result.prevScore).toBe(50);
  });

  it("adds delta for a completed mission this week", () => {
    const now = new Date().toISOString();
    const missions = [{ id: "m1", pillar: PILLAR, missionType: "standard" }];
    const result = computeAlgorithmicScore(PILLAR, 50, missions, ["m1"], { m1: now }, []);
    expect(result.delta).toBeGreaterThan(0);
    expect(result.baseScore).toBeGreaterThan(50);
  });

  it("penalises an overdue mission", () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const missions = [{ id: "m1", pillar: PILLAR, missionType: "standard", deadlineDate: pastDate }];
    const result = computeAlgorithmicScore(PILLAR, 50, missions, [], {}, []);
    expect(result.delta).toBeLessThan(0);
    expect(result.baseScore).toBeLessThan(50);
  });

  it("does not count missions from other pillars", () => {
    const now = new Date().toISOString();
    const missions = [{ id: "m1", pillar: "affluence", missionType: "standard" }];
    const result = computeAlgorithmicScore(PILLAR, 50, missions, ["m1"], { m1: now }, []);
    expect(result.delta).toBe(0);
  });

  it("adds delta for a fully completed recurring habit", () => {
    const recurring = [{ id: "r1", pillar: PILLAR, targetCount: 3, progressCount: 3 }];
    const result = computeAlgorithmicScore(PILLAR, 50, [], [], {}, recurring);
    expect(result.delta).toBeGreaterThan(0);
  });

  it("penalises a recurring habit with no progress", () => {
    const recurring = [{ id: "r1", pillar: PILLAR, targetCount: 3, progressCount: 0 }];
    const result = computeAlgorithmicScore(PILLAR, 50, [], [], {}, recurring);
    expect(result.delta).toBeLessThan(0);
  });

  it("caps score at 100 regardless of positive delta", () => {
    const recurring = Array.from({ length: 10 }, (_, i) => ({
      id: `r${i}`, pillar: PILLAR, targetCount: 3, progressCount: 3,
    }));
    const result = computeAlgorithmicScore(PILLAR, 98, [], [], {}, recurring);
    expect(result.baseScore).toBeLessThanOrEqual(100);
  });

  it("floors score at 1 regardless of negative delta", () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const missions = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`, pillar: PILLAR, missionType: "standard", deadlineDate: pastDate,
    }));
    const result = computeAlgorithmicScore(PILLAR, 2, missions, [], {}, []);
    expect(result.baseScore).toBeGreaterThanOrEqual(1);
  });

  it("caps the total delta swing at ±10", () => {
    const recurring = Array.from({ length: 20 }, (_, i) => ({
      id: `r${i}`, pillar: PILLAR, targetCount: 3, progressCount: 3,
    }));
    const result = computeAlgorithmicScore(PILLAR, 50, [], [], {}, recurring);
    expect(result.delta).toBeLessThanOrEqual(10);
  });

  it("counts a counted mission by completion percentage", () => {
    const missions = [{ id: "m1", pillar: PILLAR, missionType: "counted", targetCount: 4, progressCount: 3 }];
    const result = computeAlgorithmicScore(PILLAR, 50, missions, [], {}, []);
    // 75% complete → +2
    expect(result.delta).toBe(2);
  });
});
