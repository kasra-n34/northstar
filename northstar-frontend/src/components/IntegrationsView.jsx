import { useState, useRef, useCallback } from "react";
import { callClaude, parseJSON } from "../api";
import { Mono, Tag, Spinner } from "./ui";
import InstagramSection from "./InstagramIntegration";

// ─── Re-export Instagram helpers so other modules keep the same import paths ──

export {
  parseInstagramConnectionsZip,
  parseInstagramSnapshotRaw,
  compareInstagramSnapshots,
  buildInstagramContext,
  buildIgSnapshot,
  buildInstagramSnapshotContext,
} from "./instagramHelpers";


// ─── Hevy CSV Parser ──────────────────────────────────────────────────────────

// Proper CSV line parser that handles quoted fields with internal commas and empty fields
function parseCSVLine(line) {
  const result = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  result.push(field);
  return result;
}

export function parseHevyCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return null;
  const clean = (s) => (s || "").trim();
  const header = parseCSVLine(lines[0]).map(clean);
  const idx = {
    title: header.indexOf("title"), start_time: header.indexOf("start_time"),
    exercise: header.indexOf("exercise_title"), set_index: header.indexOf("set_index"),
    weight: header.indexOf("weight_lbs"), reps: header.indexOf("reps"),
  };
  if (idx.exercise === -1 || idx.title === -1) return null;

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]).map(clean);
    const get = (ci) => cols[ci] || "";
    const weight = parseFloat(get(idx.weight));
    const reps   = parseInt(get(idx.reps));
    if (isNaN(weight) && isNaN(reps)) continue;
    rows.push({ workout: get(idx.title), date: get(idx.start_time), exercise: get(idx.exercise), setIndex: parseInt(get(idx.set_index)) || 0, weight: isNaN(weight) ? null : weight, reps: isNaN(reps) ? null : reps });
  }
  if (!rows.length) return null;

  const parseDate = (s) => { try { return new Date(s.replace(/(\d+) (\w+) (\d+), (\d+:\d+)/, "$2 $1 $3 $4")); } catch { return new Date(s); } };

  const sessionMap = {};
  rows.forEach(r => {
    const key = `${r.workout}||${r.date}`;
    if (!sessionMap[key]) sessionMap[key] = { workout: r.workout, date: parseDate(r.date), exercises: {} };
    if (!sessionMap[key].exercises[r.exercise]) sessionMap[key].exercises[r.exercise] = [];
    sessionMap[key].exercises[r.exercise].push({ set: r.setIndex, weight: r.weight, reps: r.reps });
  });

  const sessions = Object.values(sessionMap).sort((a, b) => b.date - a.date);
  const exerciseHistory = {};
  sessions.forEach(s => {
    Object.entries(s.exercises).forEach(([ex, sets]) => {
      if (!exerciseHistory[ex]) exerciseHistory[ex] = [];
      const weightSets  = sets.filter(x => x.weight !== null && x.reps !== null);
      const repOnlySets = sets.filter(x => x.weight === null && x.reps !== null);
      const bestSet = weightSets.reduce((best, x) => (!best || x.weight > best.weight) ? x : best, null);
      const bestVolSet = weightSets.reduce((best, x) => {
        const vol = x.weight * x.reps;
        return (!best || vol > best.weight * best.reps) ? x : best;
      }, null);
      const sessionVolume = weightSets.length > 0 ? weightSets.reduce((sum, x) => sum + x.weight * x.reps, 0) : null;
      const bestReps = repOnlySets.reduce((best, x) => Math.max(best, x.reps), 0) || null;
      exerciseHistory[ex].push({
        date: s.date, workout: s.workout,
        bestSet, bestVolSet, sessionVolume,
        totalVolume: sessionVolume,
        setCount: sets.length, bestReps,
        sets: weightSets.sort((a, b) => a.set - b.set),
      });
    });
  });
  Object.keys(exerciseHistory).forEach(ex => exerciseHistory[ex].sort((a, b) => a.date - b.date));

  return {
    sessions, exerciseHistory,
    totalSessions: sessions.length,
    dateRange: sessions.length > 0 ? { from: sessions[sessions.length - 1].date, to: sessions[0].date } : null,
    uniqueExercises: Object.keys(exerciseHistory).length,
    workoutTypes: [...new Set(sessions.map(s => s.workout))],
  };
}

// Trend arrow: compares first vs last value in an array of numbers
function trendArrow(first, last) {
  if (first == null || last == null) return "";
  return last > first ? "↑" : last < first ? "↓" : "→";
}

// Compares the most recent 3-session window to the prior 3-session window for each exercise.
// Exported so PhysicalityTrends in PillarView can reuse the same logic.
// Returns { improving: { volume, bestSet }, declining: { volume, bestSet } }
// where each list is [{ ex, pct|diff }] sorted by magnitude.
export function computeTrends(exerciseHistory) {
  const SKIP = new Set(["Stretching"]);
  const WINDOW = 3;
  const improving = { volume: [], bestSet: [] };
  const declining  = { volume: [], bestSet: [] };

  Object.entries(exerciseHistory).forEach(([ex, hist]) => {
    if (SKIP.has(ex)) return;
    const wHist = hist.filter(h => h.sessionVolume != null);
    if (wHist.length < WINDOW * 2) return; // need at least 6 sessions for a fair comparison

    const recent = wHist.slice(-WINDOW);
    const older  = wHist.slice(-WINDOW * 2, -WINDOW);

    const avg = (arr, key) => arr.reduce((s, h) => s + (h[key] ?? 0), 0) / arr.length;

    // Session volume
    const recentVol = avg(recent, "sessionVolume");
    const olderVol  = avg(older,  "sessionVolume");
    if (olderVol > 0) {
      const pct = ((recentVol - olderVol) / olderVol) * 100;
      if (pct >= 5)  improving.volume.push({ ex, pct: Math.round(pct) });
      if (pct <= -5) declining.volume.push({ ex, pct: Math.round(Math.abs(pct)) });
    }

    // Best set weight
    const recentWeights = recent.filter(h => h.bestSet).map(h => h.bestSet.weight);
    const olderWeights  = older.filter(h => h.bestSet).map(h => h.bestSet.weight);
    if (recentWeights.length > 0 && olderWeights.length > 0) {
      const recentAvg = recentWeights.reduce((s, v) => s + v, 0) / recentWeights.length;
      const olderAvg  = olderWeights.reduce((s, v) => s + v, 0) / olderWeights.length;
      const diff = recentAvg - olderAvg;
      if (diff >= 2.5)  improving.bestSet.push({ ex, diff: Math.round(diff) });
      if (diff <= -2.5) declining.bestSet.push({ ex, diff: Math.round(Math.abs(diff)) });
    }
  });

  improving.volume.sort((a, b) => b.pct - a.pct);
  declining.volume.sort((a, b) => b.pct - a.pct);
  improving.bestSet.sort((a, b) => b.diff - a.diff);
  declining.bestSet.sort((a, b) => b.diff - a.diff);

  return { improving, declining };
}

export function buildWorkoutContext(workoutData) {
  if (!workoutData) return "";
  const { sessions, exerciseHistory, totalSessions, dateRange, workoutTypes } = workoutData;

  const dateStr = dateRange
    ? `${new Date(dateRange.from).toLocaleDateString("en-CA", { month: "short", year: "numeric" })} – ${new Date(dateRange.to).toLocaleDateString("en-CA", { month: "short", year: "numeric" })}`
    : "";

  // ── THIS WEEK section ──────────────────────────────────────────────────────
  // Surface the last 7 days of sessions explicitly so the AI focuses on
  // recent activity rather than summarising all-time stats.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentSessions = (sessions || []).filter(s => new Date(s.date) >= weekAgo);

  let thisWeekStr = "";
  if (recentSessions.length === 0) {
    thisWeekStr = "THIS WEEK: no sessions logged in the past 7 days.";
  } else {
    const sessionSummaries = recentSessions.map(s => {
      const day  = new Date(s.date).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
      const exes = Object.entries(s.exercises).map(([ex, sets]) => {
        const weightSets = sets.filter(x => x.weight !== null && x.reps !== null).sort((a, b) => a.set - b.set);
        if (weightSets.length === 0) return ex;
        const setsStr = weightSets.map(x => `${x.weight}×${x.reps}`).join(", ");
        return `${ex} [${setsStr}]`;
      }).join(" | ");
      return `${day} [${s.workout}]: ${exes}`;
    });
    thisWeekStr = `THIS WEEK (${recentSessions.length} session${recentSessions.length !== 1 ? "s" : ""}): ${sessionSummaries.join(" || ")}`;
  }

  // Skip non-exercise entries
  const SKIP = new Set(["Stretching"]);

  const exerciseLines = [];
  Object.entries(exerciseHistory).forEach(([ex, hist]) => {
    if (SKIP.has(ex) || hist.length === 0) return;

    const first = hist[0];
    const last  = hist[hist.length - 1];
    const n     = hist.length;

    if (last.bestSet) {
      const peakWeight  = Math.max(...hist.map(h => h.bestSet?.weight  ?? 0));
      const peakVolSet  = Math.max(...hist.map(h => h.bestVolSet ? h.bestVolSet.weight * h.bestVolSet.reps : 0));
      const peakSessVol = Math.max(...hist.map(h => h.sessionVolume ?? 0));
      const wTrend      = trendArrow(first.bestSet?.weight,       last.bestSet?.weight);
      const vTrend      = trendArrow(first.sessionVolume,         last.sessionVolume);
      const volSetStr = last.bestVolSet
        ? ` | bestVolSet=${last.bestVolSet.weight}×${last.bestVolSet.reps}=${last.bestVolSet.weight * last.bestVolSet.reps}lbs peak:${peakVolSet}`
        : "";
      exerciseLines.push(
        `${ex} (${n}x): weight=${last.bestSet.weight}lbs×${last.bestSet.reps}${wTrend} peak:${peakWeight}lbs` +
        volSetStr +
        ` | sessVol=${last.sessionVolume}${vTrend} peak:${peakSessVol}`
      );
    } else if (last.bestReps) {
      const peakReps = Math.max(...hist.map(h => h.bestReps ?? 0));
      const rTrend   = trendArrow(first.bestReps, last.bestReps);
      exerciseLines.push(`${ex} (${n}x): reps=${last.bestReps}${rTrend} peak:${peakReps}`);
    }
  });

  // ── TRENDS section ────────────────────────────────────────────────────────
  const trends = computeTrends(exerciseHistory);
  const trendParts = [];
  if (trends.improving.volume.length)
    trendParts.push(`session-volume RISING: ${trends.improving.volume.map(t => `${t.ex} +${t.pct}%`).join(", ")}`);
  if (trends.declining.volume.length)
    trendParts.push(`session-volume FALLING: ${trends.declining.volume.map(t => `${t.ex} -${t.pct}%`).join(", ")}`);
  if (trends.improving.bestSet.length)
    trendParts.push(`best-set RISING: ${trends.improving.bestSet.map(t => `${t.ex} +${t.diff}lbs`).join(", ")}`);
  if (trends.declining.bestSet.length)
    trendParts.push(`best-set FALLING: ${trends.declining.bestSet.map(t => `${t.ex} -${t.diff}lbs`).join(", ")}`);
  const trendsStr = trendParts.length
    ? `TRENDS (recent 3 sessions vs prior 3): ${trendParts.join(" | ")}`
    : "TRENDS: not enough data yet (need ≥6 sessions per exercise)";

  const header = `Workout history: ${totalSessions} total sessions (${dateStr}), split: ${(workoutTypes || []).join("/")}`;
  return [thisWeekStr, trendsStr, header, ...exerciseLines].join(" | ");
}

// ─── Trend chart ─────────────────────────────────────────────────────────────

function TrendChart({ points, color = "var(--y)", height = 80 }) {
  if (!points || points.length < 2) return null;
  const W = 100; // percentage-based viewBox width
  const H = height;
  const PAD = 4;
  const vals = points.map(p => p.y);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const toX = (i) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const toY = (v) => H - PAD - ((v - minV) / range) * (H - PAD * 2);

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.y)}`).join(" ");
  const areaD = `${pathD} L ${toX(points.length - 1)} ${H} L ${toX(0)} ${H} Z`;

  const latest = points[points.length - 1];
  const oldest = points[0];
  const delta = latest.y - oldest.y;
  const deltaColor = delta > 0 ? "var(--g)" : delta < 0 ? "var(--r)" : "var(--text3)";

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
        <defs>
          <linearGradient id={`grad_${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={areaD} fill={`url(#grad_${color.replace(/[^a-z0-9]/gi, "")})`} />
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.y)} r="2" fill={i === points.length - 1 ? color : "var(--bg2)"} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {/* Baseline */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {/* Min / max labels */}
        <text x={PAD} y={PAD + 6} fontSize="5" fill="var(--text3)" fontFamily="monospace">{maxV % 1 === 0 ? maxV : maxV.toFixed(1)}</text>
        <text x={PAD} y={H - PAD - 2} fontSize="5" fill="var(--text3)" fontFamily="monospace">{minV % 1 === 0 ? minV : minV.toFixed(1)}</text>
      </svg>
      {/* X-axis date labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <Mono s={{ fontSize: 7, color: "var(--text3)" }}>{new Date(oldest.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</Mono>
        <Mono s={{ fontSize: 7, color: deltaColor }}>{delta > 0 ? "▲" : delta < 0 ? "▼" : "→"} {Math.abs(delta) % 1 === 0 ? Math.abs(delta) : Math.abs(delta).toFixed(1)}</Mono>
        <Mono s={{ fontSize: 7, color: "var(--text3)" }}>{new Date(latest.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</Mono>
      </div>
    </div>
  );
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({ name, history }) {
  const [exp,    setExp]    = useState(false);
  const [metric, setMetric] = useState("weight"); // weight | volume | sets | reps

  const latest = history[history.length - 1];
  const oldest = history[0];

  // Normalise history entries — handle legacy data where sessionVolume may be
  // stored as `totalVolume`, or bestVolSet may be absent. Compute on the fly if needed.
  const norm = history.map(h => {
    const sv = h.sessionVolume ?? h.totalVolume ?? null;
    const bvs = h.bestVolSet ?? null;
    return { ...h, sessionVolume: sv, bestVolSet: bvs };
  });

  // Derived series
  const weightSeries = norm.filter(h => h.bestSet?.weight != null).map(h => ({ date: h.date, y: h.bestSet.weight }));
  const volumeSeries = norm.filter(h => h.sessionVolume != null && h.sessionVolume > 0).map(h => ({ date: h.date, y: Math.round(h.sessionVolume) }));
  const setsSeries   = norm.map(h => ({ date: h.date, y: h.setCount || 0 }));
  const repsSeries   = norm.filter(h => h.bestReps != null).map(h => ({ date: h.date, y: h.bestReps }));

  const isBodyweight = latest.bestSet?.weight == null && (latest.bestReps != null || repsSeries.length > 0);
  const hasWeight    = weightSeries.length >= 2;
  const hasVolume    = volumeSeries.length >= 2;
  const hasSets      = setsSeries.length >= 2;
  const hasReps      = repsSeries.length >= 2;

  // Summary stats
  const peakWeight   = hasWeight ? Math.max(...weightSeries.map(p => p.y)) : null;
  const latestWeight = latest.bestSet?.weight ?? null;
  const latestReps   = latest.bestSet?.reps ?? latest.bestReps ?? null;
  const latestNorm   = norm[norm.length - 1];
  const totalVol     = latestNorm.sessionVolume != null && latestNorm.sessionVolume > 0
    ? Math.round(latestNorm.sessionVolume).toLocaleString()
    : null;
  const peakVol      = hasVolume ? Math.max(...volumeSeries.map(p => p.y)) : null;

  // Overall trend (weight or reps)
  const trendBase  = hasWeight ? weightSeries : repsSeries;
  const trendDelta = trendBase.length >= 2 ? trendBase[trendBase.length - 1].y - trendBase[0].y : null;
  const trendColor = trendDelta == null ? "var(--text3)" : trendDelta > 0 ? "var(--g)" : trendDelta < 0 ? "var(--r)" : "var(--text3)";
  const trendLabel = trendDelta == null ? null : trendDelta > 0 ? `+${trendDelta}` : `${trendDelta}`;

  // Active metric data
  const chartData = metric === "weight" ? weightSeries : metric === "volume" ? volumeSeries : metric === "sets" ? setsSeries : repsSeries;
  const chartColor = metric === "weight" ? "var(--y)" : metric === "volume" ? "var(--p)" : metric === "sets" ? "var(--c)" : "var(--g)";

  // Mini sparkline for the collapsed row
  const sparkData = hasWeight ? weightSeries : repsSeries;
  let miniSparkline = null;
  if (sparkData.length >= 2) {
    const W = 64, H = 20;
    const vals = sparkData.map(p => p.y);
    const minV = Math.min(...vals), maxV = Math.max(...vals);
    const r = maxV - minV || 1;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - minV) / r) * H}`).join(" ");
    const lx = W, ly = H - ((vals[vals.length - 1] - minV) / r) * H;
    miniSparkline = (
      <svg width={W} height={H} style={{ overflow: "visible", flexShrink: 0 }}>
        <polyline points={pts} fill="none" stroke="var(--y)" strokeWidth="1.5" strokeOpacity="0.7" />
        <circle cx={lx} cy={ly} r={2.5} fill="var(--y)" />
      </svg>
    );
  }

  const METRICS = [
    hasWeight && { id: "weight", label: "WEIGHT" },
    hasVolume && { id: "volume", label: "VOLUME" },
    hasSets   && { id: "sets",   label: "SETS"   },
    hasReps   && { id: "reps",   label: "REPS"   },
  ].filter(Boolean);

  const activeMetric = METRICS.find(m => m.id === metric) ? metric : METRICS[0]?.id || "weight";

  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", marginBottom: 6 }}>
      {/* Collapsed row */}
      <button
        onClick={() => setExp(e => !e)}
        style={{ width: "100%", background: "none", border: "none", padding: "11px 14px", display: "flex", gap: 12, alignItems: "center", textAlign: "left", cursor: "pointer" }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {latestWeight != null
              ? <Mono s={{ fontSize: 10, color: "var(--y)" }}>{latestWeight}lbs × {latestReps}</Mono>
              : latestReps != null
                ? <Mono s={{ fontSize: 10, color: "var(--g)" }}>BW × {latestReps}</Mono>
                : null
            }
            {totalVol && <Mono s={{ fontSize: 9, color: "var(--text3)" }}>{totalVol} vol</Mono>}
            {trendLabel && <Tag color={trendColor}>{trendLabel}{hasWeight ? "lbs" : " reps"}</Tag>}
            <Mono s={{ fontSize: 9, color: "var(--text3)" }}>{history.length}×</Mono>
          </div>
        </div>
        {miniSparkline}
        <span style={{ color: "var(--text3)", fontSize: 11, flexShrink: 0, marginLeft: 4 }}>{exp ? "▲" : "▼"}</span>
      </button>

      {/* Expanded panel */}
      {exp && (
        <div style={{ borderTop: "1px solid var(--border)" }}>

          {/* ── Summary stat tiles ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, borderBottom: "1px solid var(--border)" }}>
            {[
              latestWeight != null && { label: "LATEST",    value: `${latestWeight}lbs`,       sub: `× ${latestReps} reps`,  color: "var(--y)" },
              peakWeight   != null && { label: "PEAK WT",   value: `${peakWeight}lbs`,          sub: "all time",              color: "var(--o)" },
              peakVol      != null && { label: "PEAK VOL",  value: peakVol.toLocaleString(),    sub: "lbs in one session",    color: "var(--p)" },
              isBodyweight && latestReps != null && { label: "LATEST", value: `BW × ${latestReps}`, sub: "reps",             color: "var(--g)" },
                             { label: "SESSIONS",  value: history.length,                      sub: "logged",                color: "var(--c)" },
              latest.setCount != null && { label: "LAST SETS", value: latest.setCount,         sub: "sets this session",     color: "var(--text2)" },
            ].filter(Boolean).slice(0, 4).map((s, i) => (
              <div key={i} style={{ padding: "10px 12px", borderRight: i < 3 ? "1px solid var(--border)" : "none" }}>
                <Mono s={{ fontSize: 7, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 3 }}>{s.label}</Mono>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <Mono s={{ fontSize: 7, color: "var(--text3)", display: "block", marginTop: 2 }}>{s.sub}</Mono>
              </div>
            ))}
          </div>

          {/* ── Metric tab switcher ── */}
          {METRICS.length > 1 && (
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
              {METRICS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMetric(m.id)}
                  style={{ flex: 1, background: activeMetric === m.id ? "var(--bg3)" : "none", border: "none", borderRight: "1px solid var(--border)", padding: "7px 0", fontFamily: "'DM Mono',monospace", fontSize: 8, letterSpacing: 1, color: activeMetric === m.id ? (m.id === "weight" ? "var(--y)" : m.id === "volume" ? "var(--p)" : m.id === "sets" ? "var(--c)" : "var(--g)") : "var(--text3)", cursor: "pointer" }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Trend chart ── */}
          {chartData.length >= 2 && (
            <div style={{ padding: "14px 14px 10px" }}>
              <TrendChart points={chartData} color={chartColor} height={90} />
            </div>
          )}

          {/* ── Session history table ── */}
          <div style={{ borderTop: "1px solid var(--border)", maxHeight: 260, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "var(--bg3)" }}>
                  {["DATE", "BEST SET", "BEST VOL SET", "SESSION VOL", "SETS"].map((h, i) => (
                    <th key={i} style={{ padding: "5px 10px", textAlign: i === 0 ? "left" : "right", fontFamily: "'DM Mono',monospace", fontSize: 7, letterSpacing: 1, color: "var(--text3)", fontWeight: 400, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {norm.slice().reverse().map((h, i) => {
                  const isLatest = i === 0;
                  // Compare to the chronologically previous session (next in reversed array)
                  const prevH = norm.slice().reverse()[i + 1];
                  const weightDelta = (h.bestSet?.weight != null && prevH?.bestSet?.weight != null)
                    ? h.bestSet.weight - prevH.bestSet.weight
                    : null;
                  const bvs = h.bestVolSet;
                  const bvsVol = bvs?.weight != null && bvs?.reps != null ? Math.round(bvs.weight * bvs.reps).toLocaleString() : null;
                  const sv = h.sessionVolume;
                  return (
                    <tr key={i} style={{ background: isLatest ? "var(--o)08" : i % 2 === 0 ? "var(--bg2)" : "var(--bg1)", borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "7px 10px", color: isLatest ? "var(--text)" : "var(--text2)", fontFamily: "'DM Mono',monospace", fontSize: 9, whiteSpace: "nowrap" }}>
                        {new Date(h.date).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "2-digit" })}
                        {isLatest && <span style={{ marginLeft: 5, color: "var(--o)", fontSize: 7 }}>LATEST</span>}
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 10, color: isLatest ? "var(--y)" : "var(--text2)", whiteSpace: "nowrap" }}>
                        {h.bestSet?.weight != null
                          ? <>{h.bestSet.weight}<span style={{ color: "var(--text3)", fontSize: 8 }}>lbs</span> × {h.bestSet.reps}
                              {weightDelta != null && weightDelta !== 0 && (
                                <span style={{ marginLeft: 5, fontSize: 8, color: weightDelta > 0 ? "var(--g)" : "var(--r)" }}>{weightDelta > 0 ? "▲" : "▼"}{Math.abs(weightDelta)}</span>
                              )}
                            </>
                          : h.bestReps != null
                            ? <>BW × {h.bestReps}</>
                            : <span style={{ color: "var(--text3)" }}>—</span>}
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--text2)", whiteSpace: "nowrap" }}>
                        {bvs?.weight != null
                          ? <>{bvs.weight}<span style={{ color: "var(--text3)", fontSize: 8 }}>lbs</span> × {bvs.reps}
                              {bvsVol && <span style={{ color: "var(--text3)", fontSize: 8 }}> = {bvsVol}</span>}
                            </>
                          : <span style={{ color: "var(--text3)" }}>—</span>}
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 10, color: isLatest ? "var(--p)" : "var(--text2)" }}>
                        {sv != null && sv > 0
                          ? Math.round(sv).toLocaleString()
                          : <span style={{ color: "var(--text3)" }}>—</span>}
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--text3)" }}>
                        {h.setCount ?? <span style={{ color: "var(--text3)" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Reusable drop zone ───────────────────────────────────────────────────────

function DropZone({ accept, onFile, loading, loadingLabel, emptyLabel, hasData, accentColor }) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const color = accentColor || "var(--c)";
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files[0]); }}
      onClick={() => fileRef.current?.click()}
      style={{ border: `2px dashed ${dragOver ? color : hasData ? "var(--border2)" : "var(--border)"}`, padding: "20px", textAlign: "center", cursor: "pointer", background: dragOver ? color + "0D" : "var(--bg2)", transition: "all 0.15s" }}
    >
      <input ref={fileRef} type="file" accept={accept} onChange={e => onFile(e.target.files[0])} style={{ display: "none" }} />
      {loading
        ? <><div style={{ width: 22, height: 22, border: `2px solid ${color}33`, borderTop: `2px solid ${color}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} /><Mono s={{ fontSize: 10, color }}>{loadingLabel}</Mono></>
        : <><div style={{ fontSize: 20, marginBottom: 6 }}>📂</div><Mono s={{ fontSize: 10, color: hasData ? "var(--text3)" : "var(--text2)", letterSpacing: 1 }}>{hasData ? `DROP NEW ${emptyLabel} TO UPDATE` : `DROP ${emptyLabel} HERE`}</Mono><div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>or click to browse</div></>
      }
    </div>
  );
}

// ─── Workout Trends (4-week) ──────────────────────────────────────────────────

function WorkoutTrends({ exerciseHistory }) {
  const [trendTab, setTrendTab] = useState("bestset"); // bestset | sessVol
  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const trends = [];
  Object.entries(exerciseHistory).forEach(([ex, hist]) => {
    const recent = hist
      .map(h => ({ ...h, date: new Date(h.date) }))
      .filter(h => h.date >= fourWeeksAgo)
      .sort((a, b) => a.date - b.date);

    if (recent.length < 2) return;

    const earliest = recent[0];
    const latest   = recent[recent.length - 1];

    // Best set: prefer bestVolSet, fall back to bestSet
    const oldBVS = earliest.bestVolSet ?? earliest.bestSet ?? null;
    const newBVS = latest.bestVolSet   ?? latest.bestSet   ?? null;
    if (!oldBVS || !newBVS) return;

    const oldBestVol = oldBVS.weight * oldBVS.reps;
    const newBestVol = newBVS.weight * newBVS.reps;
    const bsDelta    = newBestVol - oldBestVol;
    const bsPct      = oldBestVol > 0 ? (bsDelta / oldBestVol) * 100 : 0;

    // Session volume
    const oldSV = earliest.sessionVolume ?? null;
    const newSV = latest.sessionVolume   ?? null;
    const svDelta = oldSV != null && newSV != null ? newSV - oldSV : null;
    const svPct   = svDelta != null && oldSV > 0 ? (svDelta / oldSV) * 100 : null;

    // Latest session sets for breakdown display
    const latestSets = latest.sets ?? null;

    trends.push({ ex, oldBVS, newBVS, oldBestVol, newBestVol, bsDelta, bsPct, oldSV, newSV, svDelta, svPct, latestSets, sessions: recent.length });
  });

  const bsImproved  = trends.filter(t => t.bsDelta > 0).sort((a, b) => b.bsPct - a.bsPct);
  const bsDeclined  = trends.filter(t => t.bsDelta < 0).sort((a, b) => a.bsPct - b.bsPct);
  const bsUnchanged = trends.filter(t => t.bsDelta === 0 && t.oldBVS);

  const svImproved  = trends.filter(t => t.svDelta != null && t.svDelta > 0).sort((a, b) => b.svPct - a.svPct);
  const svDeclined  = trends.filter(t => t.svDelta != null && t.svDelta < 0).sort((a, b) => a.svPct - b.svPct);
  const svUnchanged = trends.filter(t => t.svDelta === 0 && t.oldSV != null);

  const BestSetRow = ({ t, dir }) => {
    const color = dir === "up" ? "var(--g)" : dir === "down" ? "var(--r)" : "var(--text3)";
    const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "→";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg2)" }}>
        <span style={{ color, fontSize: 11, flexShrink: 0 }}>{arrow}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.ex}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center" }}>
            <Mono s={{ fontSize: 9, color: "var(--text3)" }}>
              {t.oldBVS.reps}×{Math.round(t.oldBVS.weight)}lbs → {t.newBVS.reps}×{Math.round(t.newBVS.weight)}lbs
            </Mono>
            <Mono s={{ fontSize: 9, color: "var(--text3)" }}>· {t.sessions}× in 4W</Mono>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <Mono s={{ fontSize: 11, color }}>{dir === "up" ? "+" : ""}{Math.round(t.bsDelta).toLocaleString()}</Mono>
          <Mono s={{ fontSize: 8, color: "var(--text3)", display: "block" }}>{t.bsPct > 0 ? "+" : ""}{t.bsPct.toFixed(1)}%</Mono>
        </div>
      </div>
    );
  };

  const SessVolRow = ({ t, dir }) => {
    const color = dir === "up" ? "var(--g)" : dir === "down" ? "var(--r)" : "var(--text3)";
    const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "→";
    const setsStr = t.latestSets?.length
      ? t.latestSets.map(s => `${s.weight}×${s.reps}`).join(", ")
      : null;
    return (
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg2)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ color, fontSize: 11, flexShrink: 0, marginTop: 1 }}>{arrow}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.ex}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center", flexWrap: "wrap" }}>
              <Mono s={{ fontSize: 9, color: "var(--text3)" }}>
                {Math.round(t.oldSV).toLocaleString()} → {Math.round(t.newSV).toLocaleString()} lbs
              </Mono>
              <Mono s={{ fontSize: 9, color: "var(--text3)" }}>· {t.sessions}× in 4W</Mono>
            </div>
            {setsStr && (
              <Mono s={{ fontSize: 8, color: "var(--text3)", marginTop: 3, display: "block", lineHeight: 1.6 }}>
                latest: {setsStr}
              </Mono>
            )}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <Mono s={{ fontSize: 11, color }}>{dir === "up" ? "+" : ""}{Math.round(t.svDelta).toLocaleString()}</Mono>
            <Mono s={{ fontSize: 8, color: "var(--text3)", display: "block" }}>{t.svPct > 0 ? "+" : ""}{t.svPct.toFixed(1)}%</Mono>
          </div>
        </div>
      </div>
    );
  };

  if (trends.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)", fontSize: 12 }}>
        Not enough data in the last 4 weeks to compute trends.<br />
        <span style={{ fontSize: 11 }}>Need at least 2 sessions per exercise in the past 28 days.</span>
      </div>
    );
  }

  const isBestSet = trendTab === "bestset";
  const improved  = isBestSet ? bsImproved  : svImproved;
  const declined  = isBestSet ? bsDeclined  : svDeclined;
  const unchanged = isBestSet ? bsUnchanged : svUnchanged;
  const RowComp   = isBestSet ? BestSetRow  : SessVolRow;
  const sectionLabel = isBestSet ? "BEST SET" : "SESSION VOL";

  return (
    <div>
      {/* Sub-tab: best set vs session volume */}
      <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: "1px solid var(--border)" }}>
        {[["bestset", "BEST SET"], ["sessVol", "SESSION VOLUME"]].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTrendTab(v)}
            style={{ padding: "7px 16px", background: "none", border: "none", borderBottom: trendTab === v ? "2px solid var(--p)" : "2px solid transparent", fontFamily: "'DM Mono',monospace", fontSize: 8, letterSpacing: 1.5, color: trendTab === v ? "var(--p)" : "var(--text3)", cursor: "pointer", marginBottom: -1 }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { label: "IMPROVING", value: improved.length, color: "var(--g)" },
          { label: "DECLINING", value: declined.length, color: "var(--r)" },
          { label: "UNCHANGED", value: unchanged.length, color: "var(--text3)" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: "var(--bg2)", padding: "10px 12px", border: "1px solid var(--border)" }}>
            <Mono s={{ fontSize: 7, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 3 }}>{s.label}</Mono>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {improved.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Mono s={{ fontSize: 8, color: "var(--g)", letterSpacing: 2, display: "block", marginBottom: 6, paddingLeft: 2 }}>▲ IMPROVING — {sectionLabel}</Mono>
          <div style={{ border: "1px solid var(--g)33", overflow: "hidden" }}>
            {improved.map((t, i) => <RowComp key={i} t={t} dir="up" />)}
          </div>
        </div>
      )}

      {declined.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Mono s={{ fontSize: 8, color: "var(--r)", letterSpacing: 2, display: "block", marginBottom: 6, paddingLeft: 2 }}>▼ DECLINING — {sectionLabel}</Mono>
          <div style={{ border: "1px solid var(--r)33", overflow: "hidden" }}>
            {declined.map((t, i) => <RowComp key={i} t={t} dir="down" />)}
          </div>
        </div>
      )}

      {unchanged.length > 0 && (
        <div>
          <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 6, paddingLeft: 2 }}>→ UNCHANGED — {sectionLabel}</Mono>
          <div style={{ border: "1px solid var(--border)", overflow: "hidden" }}>
            {unchanged.map((t, i) => <RowComp key={i} t={t} dir="flat" />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main IntegrationsView ────────────────────────────────────────────────────

export default function IntegrationsView({ state, onSave }) {
  const [integrations, setIntegrations] = useState(state.integrations || {});

  // Hevy CSV
  const [hevyImporting, setHevyImporting] = useState(false);
  const [hevyError,     setHevyError]     = useState(null);
  const [hevyView,      setHevyView]      = useState("exercises"); // exercises | trends
  const [filter,        setFilter]        = useState("all");
  const [search,        setSearch]        = useState("");
  const [sort,          setSort]          = useState("name");

  const save = (next) => { setIntegrations(next); onSave(next); };

  const workoutData = integrations.workoutData || null;

  // ── Hevy CSV ────────────────────────────────────────────────────────────────
  const handleHevyFile = useCallback((file) => {
    if (!file || !file.name.endsWith(".csv")) { setHevyError("Please upload a .csv file."); return; }
    setHevyImporting(true); setHevyError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseHevyCSV(e.target.result);
        if (!parsed) { setHevyError("Couldn't parse this CSV. Make sure it's a Hevy workout export."); setHevyImporting(false); return; }
        const next = { ...integrations, workoutData: { ...parsed, uploadedAt: new Date().toISOString() } };
        next.workoutData.sessions = parsed.sessions.map(s => ({ ...s, date: s.date.toISOString() }));
        Object.keys(next.workoutData.exerciseHistory).forEach(ex => {
          next.workoutData.exerciseHistory[ex] = parsed.exerciseHistory[ex].map(h => ({ ...h, date: h.date.toISOString() }));
        });
        next.workoutData.dateRange = parsed.dateRange ? { from: parsed.dateRange.from.toISOString(), to: parsed.dateRange.to.toISOString() } : null;
        save(next); setHevyImporting(false);
      } catch (err) { setHevyError("Parse error: " + err.message); setHevyImporting(false); }
    };
    reader.readAsText(file);
  }, [integrations]);

  // ── Exercise browser helpers ────────────────────────────────────────────────
  const exerciseHistory = workoutData ? Object.fromEntries(
    Object.entries(workoutData.exerciseHistory).map(([ex, hist]) => [ex, hist.map(h => ({ ...h, date: new Date(h.date) }))])
  ) : {};
  const dateRange = workoutData?.dateRange ? { from: new Date(workoutData.dateRange.from), to: new Date(workoutData.dateRange.to) } : null;
  const filteredExercises = Object.keys(exerciseHistory).filter(ex => {
    const matchesSearch = !search.trim() || ex.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" ? true : filter === "push" ? /bench|press|fly|pushdown|dip|lateral|tricep/i.test(ex) : filter === "pull" ? /row|pulldown|curl|pull.up|deadlift|shrug|face.pull/i.test(ex) : filter === "legs" ? /squat|lunge|leg|calf|glute|hip|rdl|romanian/i.test(ex) : true;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    if (sort === "sessions") return exerciseHistory[b].length - exerciseHistory[a].length;
    if (sort === "trend" || sort === "regression") {
      const getDelta = (ex) => {
        const hist = exerciseHistory[ex];
        const ws = hist.filter(h => h.bestSet?.weight != null);
        if (ws.length >= 2) return ws[ws.length - 1].bestSet.weight - ws[0].bestSet.weight;
        const rs = hist.filter(h => h.bestReps != null);
        if (rs.length >= 2) return rs[rs.length - 1].bestReps - rs[0].bestReps;
        return 0;
      };
      return sort === "trend" ? getDelta(b) - getDelta(a) : getDelta(a) - getDelta(b);
    }
    return a.localeCompare(b); // name
  });

  // ── Section header helper ───────────────────────────────────────────────────
  const sectionHeader = (icon, name, tag, tagColor) => (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <Mono s={{ fontSize: 12, color: "var(--text)", letterSpacing: 1 }}>{name}</Mono>
      {tag && <Tag color={tagColor || "var(--text3)"}>{tag}</Tag>}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 24, paddingBottom: 18, borderBottom: "1px solid var(--border)" }}>
        <div style={{ color: "var(--c)", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 3, marginBottom: 5 }}>⊕ CONNECT</div>
        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 1, color: "var(--text)" }}>Integrations</h2>
        <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 7 }}>Connect your data sources. All data is stored locally in <Mono s={{ fontSize: 11, color: "var(--text3)" }}>northstar-backend/data/northstar_data.json</Mono>.</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 770 }}>

        {/* ── Instagram Connections ─────────────────────────────────────────── */}
        <InstagramSection integrations={integrations} onSave={save} />

        {/* ── Hevy CSV ──────────────────────────────────────────────────────── */}
        <div style={{ background: "var(--bg1)", border: `1px solid ${workoutData ? "var(--o)55" : "var(--border)"}`, padding: 20, position: "relative" }}>
          {workoutData && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, background: "var(--o)88" }} />}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              {sectionHeader("🏋️", "Hevy Workout Data", workoutData ? "IMPORTED" : "CSV IMPORT", workoutData ? "var(--o)" : "var(--text3)")}
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
                Export from Hevy: <Mono s={{ fontSize: 11, color: "var(--text3)" }}>Profile → Settings → Export Workout Data</Mono>. Your lifts, trends, and volume feed into your Physicality analysis.
              </div>
            </div>
            {workoutData && <button onClick={() => save({ ...integrations, workoutData: undefined })} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "6px 12px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, flexShrink: 0 }}>CLEAR</button>}
          </div>

          {workoutData && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
              {[
                { label: "SESSIONS",  value: workoutData.totalSessions },
                { label: "EXERCISES", value: workoutData.uniqueExercises },
                { label: "SPLIT",     value: (workoutData.workoutTypes || []).join("/") },
                { label: "UPLOADED",  value: new Date(workoutData.uploadedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" }) },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--bg2)", padding: "10px 12px" }}>
                  <Mono s={{ fontSize: 7, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 4 }}>{s.label}</Mono>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: "var(--o)", lineHeight: 1 }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          <DropZone accept=".csv" onFile={handleHevyFile} loading={hevyImporting} loadingLabel="PARSING CSV..." emptyLabel="HEVY CSV" hasData={!!workoutData} accentColor="var(--o)" />
          {hevyError && <div style={{ fontSize: 11, color: "var(--r)", marginTop: 8, fontFamily: "'DM Mono',monospace" }}>{hevyError}</div>}
        </div>

        {/* ── Exercise Browser / Trends ─────────────────────────────────────── */}
        {workoutData && Object.keys(exerciseHistory).length > 0 && (
          <div style={{ background: "var(--bg1)", border: "1px solid var(--o)44", padding: 20, position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, background: "var(--o)66" }} />

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
              {[["exercises", "EXERCISES"], ["trends", "TRENDS  4W"]].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setHevyView(v)}
                  style={{ padding: "8px 18px", background: "none", border: "none", borderBottom: hevyView === v ? "2px solid var(--o)" : "2px solid transparent", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1.5, color: hevyView === v ? "var(--o)" : "var(--text3)", cursor: "pointer", marginBottom: -1 }}
                >
                  {l}
                </button>
              ))}
              {dateRange && hevyView === "exercises" && (
                <Mono s={{ fontSize: 9, color: "var(--text3)", marginLeft: "auto", alignSelf: "center" }}>
                  {dateRange.from.toLocaleDateString("en-CA", { month: "short", year: "numeric" })} – {dateRange.to.toLocaleDateString("en-CA", { month: "short", year: "numeric" })}
                </Mono>
              )}
            </div>

            {hevyView === "exercises" && (
              <>
                <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                  {[["all","ALL"],["push","PUSH"],["pull","PULL"],["legs","LEGS"]].map(([v,l]) => (
                    <button key={v} onClick={() => setFilter(v)} style={{ background: filter===v?"var(--o)22":"none", border:`1px solid ${filter===v?"var(--o)66":"var(--border)"}`, color:filter===v?"var(--o)":"var(--text3)", padding:"4px 12px", fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:1 }}>{l}</button>
                  ))}
                  <select value={sort} onChange={e => setSort(e.target.value)} style={{ background:"var(--bg2)", border:"1px solid var(--border)", color:"var(--text2)", padding:"4px 10px", fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:1, cursor:"pointer" }}>
                    <option value="name">SORT: A–Z</option>
                    <option value="sessions">SORT: SESSIONS</option>
                    <option value="trend">SORT: TRENDING ↑</option>
                    <option value="regression">SORT: REGRESSING ↓</option>
                  </select>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercise..." style={{ marginLeft:"auto", padding:"4px 10px", fontSize:11, width:180 }} />
                </div>
                <div>
                  {filteredExercises.length === 0
                    ? <div style={{ textAlign:"center", padding:"30px 0", color:"var(--text3)", fontSize:12 }}>No exercises match.</div>
                    : filteredExercises.map(ex => <ExerciseCard key={ex} name={ex} history={exerciseHistory[ex]} />)
                  }
                </div>
              </>
            )}

            {hevyView === "trends" && (
              <WorkoutTrends exerciseHistory={exerciseHistory} />
            )}
          </div>
        )}


      </div>
    </div>
  );
}