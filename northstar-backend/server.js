import express from "express";
import cors from "cors";
import crypto from "crypto";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { readConfig, writeConfig, CONFIG_FILE } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: process.env.NORTHSTAR_ENV_PATH || path.join(__dirname, '.env') });
const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = process.env.NORTHSTAR_DATA_DIR
  ? path.join(process.env.NORTHSTAR_DATA_DIR, "northstar_data.json")
  : path.join(__dirname, "data", "northstar_data.json");

// ─── Middleware ───────────────────────────────────────────────────────────────

// ─── Local auth token (protects API from other local processes) ───────────────

let LOCAL_TOKEN = null;

async function ensureLocalToken() {
  const config = await readConfig();
  if (config.localToken) {
    LOCAL_TOKEN = config.localToken;
    return;
  }
  const token = crypto.randomBytes(32).toString("hex");
  await writeConfig({ localToken: token });
  LOCAL_TOKEN = token;
  console.log("✓ Generated new local auth token");
}

function requireAuth(req, res, next) {
  // Health and token-bootstrap endpoints are public
  if (req.path === "/api/health" || req.path === "/api/local-token") return next();
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !LOCAL_TOKEN || token !== LOCAL_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Middleware ───────────────────────────────────────────────────────────────

const allowedOrigins = ["http://localhost:5173", "http://localhost:4173"]
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin requests (file://) and known dev origins
    callback(null, !origin || allowedOrigins.includes(origin))
  }
}));
app.use(express.json({ limit: "2mb" }));
app.use(requireAuth);

// ─── Ensure data directory exists ─────────────────────────────────────────────

async function ensureDataDir() {
  const dataDir = process.env.NORTHSTAR_DATA_DIR || path.join(__dirname, "data")
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    // File doesn't exist — write the default empty state
    await fs.writeFile(DATA_FILE, JSON.stringify({
      profiles: {},
      analyses: {},
      missions: [],
      completedMissions: [],
      dailyBriefings: {},
      lastBriefingDate: null,
      metaAnalysis: null,
      lastMetaDate: null,
      networkContacts: [],
      networkSuggestions: [],
      integrations: {},
    }, null, 2));
    console.log("✓ Created fresh data/northstar_data.json");
  }
  // Restrict file to owner read/write only
  try { await fs.chmod(DATA_FILE, 0o600); } catch {}
}

// ─── Auth bootstrap (no token required) ──────────────────────────────────────

app.get("/api/local-token", (req, res) => {
  res.json({ token: LOCAL_TOKEN });
});

// ─── Data persistence routes ───────────────────────────────────────────────────

// Load all app state
app.get("/api/state", async (req, res) => {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error("Error reading state:", err);
    res.status(500).json({ error: "Failed to read state" });
  }
});

// Save all app state (full overwrite — simple and reliable for single-user local app)
app.post("/api/state", async (req, res) => {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(req.body, null, 2));
    try { await fs.chmod(DATA_FILE, 0o600); } catch {}
    res.json({ ok: true });
  } catch (err) {
    console.error("Error saving state:", err);
    res.status(500).json({ error: "Failed to save state" });
  }
});

// Backup endpoint — creates a timestamped snapshot in data/backups/
app.post("/api/backup", async (req, res) => {
  try {
    const backupDir = path.join(__dirname, "data", "backups");
    await fs.mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `northstar_backup_${timestamp}.json`);
    const raw = await fs.readFile(DATA_FILE, "utf8");
    await fs.writeFile(backupPath, raw);
    res.json({ ok: true, file: backupPath });
  } catch (err) {
    res.status(500).json({ error: "Backup failed" });
  }
});

// ─── Claude API proxy ─────────────────────────────────────────────────────────

app.post("/api/claude", async (req, res) => {
  const config = await readConfig();
  const apiKey = config.anthropicKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("❌ Missing ANTHROPIC_API_KEY");
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY not set. Add it to your .env file."
    });
  }

  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.warn("⏱️ Claude request timeout (180s)");
      controller.abort();
    }, 180_000);

    try {
      const hasWebSearch =
        Array.isArray(req.body?.tools) &&
        req.body.tools.some(
          t => t.type === "web_search_20250305" || t.name === "web_search"
        );

      const upstreamHeaders = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      };

      if (hasWebSearch) {
        upstreamHeaders["anthropic-beta"] = "web-search-2025-03-05";
      }

      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: upstreamHeaders,
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const raw = await upstream.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.error("❌ Failed to parse Claude response JSON:", e);
        data = { raw };
      }

      // Retry logic
      if (
        (upstream.status === 529 || upstream.status === 503) ||
        data?.error?.type === "overloaded_error"
      ) {
        console.warn(`⚠️ Claude overloaded (attempt ${attempt + 1}) — retrying...`);
        if (attempt < maxRetries) {
          const backoff = Math.min(1000 * 2 ** attempt, 8000);
          const jitter = Math.floor(Math.random() * 300);
          await new Promise(r => setTimeout(r, backoff + jitter));
          continue;
        }
      }

      if (!upstream.ok) {
        console.error("❌ Anthropic API error:", upstream.status, data?.error?.type);
        return res.status(upstream.status).json(data);
      }

      return res.json(data);

    } catch (err) {
      clearTimeout(timeout);

      const isAbort = err.name === "AbortError";

      console.error("❌ Proxy error:", err);

      if (attempt < maxRetries && !isAbort) {
        const backoff = Math.min(1000 * 2 ** attempt, 8000);
        const jitter = Math.floor(Math.random() * 300);
        console.warn(`⚠️ Claude proxy error — retrying after ${backoff + jitter}ms`);
        await new Promise(r => setTimeout(r, backoff + jitter));
        continue;
      }

      return res.status(isAbort ? 504 : 500).json({
        error: isAbort
          ? "Anthropic request timed out"
          : "Failed to reach Anthropic API"
      });
    }
  }
});

// ─── API key config ───────────────────────────────────────────────────────────

app.get("/api/config", async (req, res) => {
  const config = await readConfig();
  res.json({
    hasAnthropicKey: !!(config.anthropicKey || process.env.ANTHROPIC_API_KEY),
  });
});

app.post("/api/config", async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.anthropicKey === "string") updates.anthropicKey = req.body.anthropicKey;
    await writeConfig(updates);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save config" });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/api/health", async (req, res) => {
  const config = await readConfig();
  res.json({
    ok: true,
    apiKeySet: !!(config.anthropicKey || process.env.ANTHROPIC_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

await ensureDataDir();
await ensureLocalToken();
app.listen(PORT, () => {
  console.log(`\n  northstar backend running on http://localhost:${PORT}`);
  console.log(`  API key: ${process.env.ANTHROPIC_API_KEY ? "✓ loaded" : "✗ MISSING — add to .env"}`);
  console.log(`  Data file: ${DATA_FILE}\n`);
});
