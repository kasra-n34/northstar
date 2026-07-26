import { BACKEND } from "./constants";

// ─── Local auth token ─────────────────────────────────────────────────────────

let _token = null;

export async function initAuth() {
  if (_token) return;
  try {
    const res = await fetch(`${BACKEND}/api/local-token`);
    if (res.ok) {
      const data = await res.json();
      _token = data.token || null;
    }
  } catch {}
}

export async function apiFetch(path, options = {}) {
  if (!_token) await initAuth();
  const headers = { ...(options.headers || {}) };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  return fetch(`${BACKEND}${path}`, { ...options, headers });
}

// ─── Claude call ──────────────────────────────────────────────────────────────

export async function callClaude(messages, system, useSearch = false, model = "claude-sonnet-4-5", maxTokens = 2200) {
  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
  };

  if (useSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  const res = await apiFetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = typeof err.error === "string" ? err.error : err.error?.message;
    throw new Error(message || `Backend error ${res.status}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter(b => b.type === "text" && typeof b.text === "string")
    .map(b => b.text)
    .join("\n")
    .trim();

  return text;
}

function stripCodeFences(text) {
  if (!text || typeof text !== "string") return "";
  const fenced  = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced)  return fenced[1].trim();
  const generic = text.match(/```\s*([\s\S]*?)\s*```/);
  if (generic) return generic[1].trim();
  return text.trim();
}

export function parseJSON(text) {
  if (!text || typeof text !== "string") return null;
  const cleaned = stripCodeFences(text);

  try { return JSON.parse(cleaned); } catch {}
  try { const m = cleaned.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {}
  try { const m = cleaned.match(/\[[\s\S]*\]/); if (m) return JSON.parse(m[0]); } catch {}

  console.warn("parseJSON failed. Raw:", cleaned);
  return null;
}

