import { EMPTY_STATE, ONE_WEEK_MS, LOG_RETENTION_WEEKS } from "./constants";
import { initAuth, apiFetch } from "./api";

const LS_KEY = "northstar_os_v3_cache";

export async function loadState() {
  await initAuth();

  try {
    const cached = localStorage.getItem(LS_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}

  try {
    const res = await apiFetch("/api/state");
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      return data;
    }
  } catch {}

  return EMPTY_STATE;
}

let saveTimer = null;
export function scheduleSave(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}

  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await apiFetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
    } catch (e) {
      console.warn("Backend save failed — data is safe in localStorage cache", e);
    }
  }, 800);
}

export function pruneAndCompressLogs(logs = [], retentionWeeks = LOG_RETENTION_WEEKS) {
  const now    = Date.now();
  const cutoff = now - retentionWeeks * ONE_WEEK_MS;
  return logs
    .filter(l => new Date(l.date).getTime() > cutoff)
    .map(l => {
      const age = now - new Date(l.date).getTime();
      if (age > ONE_WEEK_MS && !l.compressed) {
        return { ...l, answers: null, compressed: true };
      }
      return l;
    });
}