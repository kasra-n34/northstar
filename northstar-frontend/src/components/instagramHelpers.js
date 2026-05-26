// ─── Shared JSZip loader ──────────────────────────────────────────────────────

async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.JSZip;
}

// ─── Instagram Connections ZIP Parser ────────────────────────────────────────

function extractUsernames(data) {
  if (Array.isArray(data)) {
    return data.map(e => e.string_list_data?.[0]?.value || e.title || "").filter(Boolean);
  }
  const key = Object.keys(data)[0];
  const arr  = data[key];
  if (!Array.isArray(arr)) return [];
  return arr.map(e =>
    e.title ||
    e.string_list_data?.[0]?.value ||
    ""
  ).filter(Boolean);
}

function extractTimestamps(data) {
  const arr = Array.isArray(data) ? data : data[Object.keys(data)[0]] || [];
  return arr.map(e => e.string_list_data?.[0]?.timestamp || null).filter(Boolean);
}

export async function parseInstagramConnectionsZip(file) {
  const JSZip = await loadJSZip();
  const zip   = await JSZip.loadAsync(file);

  const TARGET_FILES = {
    "followers_1.json":                  "followers",
    "following.json":                    "following",
    "pending_follow_requests.json":      "pendingSent",
    "recently_unfollowed_profiles.json": "recentlyUnfollowed",
    "hide_story_from.json":              "hiddenFrom",
  };

  const parsed = {};

  for (const [filename, key] of Object.entries(TARGET_FILES)) {
    const entry = Object.values(zip.files).find(f =>
      !f.dir && (f.name === filename || f.name.endsWith("/" + filename))
    );
    if (!entry) continue;
    try {
      const text = await entry.async("text");
      const json = JSON.parse(text);
      parsed[key] = {
        usernames:  extractUsernames(json),
        timestamps: extractTimestamps(json),
      };
    } catch (e) {
      console.warn(`Failed to parse ${filename}:`, e);
    }
  }

  if (!Object.keys(parsed).length) return null;

  const now  = Date.now();
  const MS_DAY = 24 * 60 * 60 * 1000;
  const MS_7D  = 7  * MS_DAY;
  const MS_30D = 30 * MS_DAY;

  const followers      = parsed.followers?.usernames    || [];
  const following      = parsed.following?.usernames    || [];
  const pendingSent    = parsed.pendingSent?.usernames  || [];
  const recentlyUnfoll = parsed.recentlyUnfollowed?.usernames || [];
  const hiddenFrom     = parsed.hiddenFrom?.usernames   || [];

  const followerSet      = new Set(followers);
  const notFollowingBack = following.filter(u => !followerSet.has(u));

  const followingSet   = new Set(following);
  const notFollowedBack = followers.filter(u => !followingSet.has(u));

  const followBackRate = following.length > 0
    ? Math.round((followers.length / following.length) * 100)
    : 0;

  const recentFollowers = (parsed.followers?.timestamps || [])
    .filter(ts => ts * 1000 > now - MS_7D).length;

  // ── Pending request deep stats ──────────────────────────────────────────────
  const pendingTs = (parsed.pendingSent?.timestamps || [])
    .map(ts => ts * 1000)
    .sort((a, b) => a - b);

  let pendingStats = null;
  if (pendingTs.length > 0) {
    const oldest        = pendingTs[0];
    const newest        = pendingTs[pendingTs.length - 1];
    const oldestAgeDays = Math.floor((now - oldest) / MS_DAY);
    const newestAgeDays = Math.floor((now - newest) / MS_DAY);
    const spanDays      = Math.max(1, (now - oldest) / MS_DAY);
    const requestsPerDay = Math.round((pendingTs.length / spanDays) * 10) / 10;
    const sentLast7d  = pendingTs.filter(ts => now - ts < MS_7D).length;
    const sentLast30d = pendingTs.filter(ts => now - ts < MS_30D).length;
    const ageBuckets = {
      under1w: pendingTs.filter(ts => now - ts <  7  * MS_DAY).length,
      w1to4:   pendingTs.filter(ts => now - ts >= 7  * MS_DAY && now - ts <  30 * MS_DAY).length,
      m1to3:   pendingTs.filter(ts => now - ts >= 30 * MS_DAY && now - ts <  90 * MS_DAY).length,
      over3m:  pendingTs.filter(ts => now - ts >= 90 * MS_DAY).length,
    };
    const mid = Math.floor(pendingTs.length / 2);
    const medianAgeDays = Math.floor(
      (now - (pendingTs.length % 2 !== 0
        ? pendingTs[mid]
        : (pendingTs[mid - 1] + pendingTs[mid]) / 2)) / MS_DAY
    );
    const ghostRate = Math.round(
      (ageBuckets.m1to3 + ageBuckets.over3m) / pendingTs.length * 100
    );
    pendingStats = {
      total: pendingTs.length,
      oldestAgeDays, newestAgeDays, medianAgeDays,
      requestsPerDay, sentLast7d, sentLast30d,
      ageBuckets, ghostRate,
    };
  }

  // ── Following growth rate ───────────────────────────────────────────────────
  const followingTs = (parsed.following?.timestamps || [])
    .map(ts => ts * 1000)
    .sort((a, b) => a - b);
  let followingGrowth = null;
  if (followingTs.length > 1) {
    const fSpan = Math.max(1, (followingTs[followingTs.length - 1] - followingTs[0]) / MS_DAY);
    followingGrowth = {
      newLast7d:  followingTs.filter(ts => now - ts < MS_7D).length,
      newLast30d: followingTs.filter(ts => now - ts < MS_30D).length,
      avgPerDay:  Math.round((followingTs.length / fSpan) * 10) / 10,
    };
  }

  // ── Unfollow cadence ────────────────────────────────────────────────────────
  const unfollowTs      = (parsed.recentlyUnfollowed?.timestamps || []).map(ts => ts * 1000);
  const unfollowLast30d = unfollowTs.filter(ts => now - ts < MS_30D).length;

  return {
    followers:           followers.length,
    following:           following.length,
    pendingSent:         pendingSent.length,
    recentlyUnfollowed:  recentlyUnfoll.length,
    hiddenFrom:          hiddenFrom.length,
    notFollowingBack:    notFollowingBack.length,
    notFollowedBack:     notFollowedBack.length,
    followBackRate,
    recentFollowers,
    pendingStats,
    followingGrowth,
    unfollowLast30d,
    filesFound:          Object.keys(parsed),
    uploadedAt:          new Date().toISOString(),
    sampleFollowers:          followers.slice(0, 10),
    notFollowingBackList:     notFollowingBack,
    samplePendingSent:        pendingSent.slice(0, 10),
    sampleRecentlyUnfollowed: recentlyUnfoll.slice(0, 10),
  };
}

export function buildInstagramContext(igData) {
  if (!igData) return "";
  const parts = [];
  if (igData.followers  != null) parts.push(`Instagram: ${igData.followers} followers`);
  if (igData.following  != null) parts.push(`following ${igData.following}`);
  if (igData.followBackRate != null) parts.push(`follow-back rate ${igData.followBackRate}%`);
  if (igData.pendingSent > 0)    parts.push(`${igData.pendingSent} pending outreach requests`);
  if (igData.notFollowingBack > 0) parts.push(`${igData.notFollowingBack} accounts not following back`);
  if (igData.recentlyUnfollowed > 0) parts.push(`recently unfollowed ${igData.recentlyUnfollowed}`);
  return parts.join(" | ");
}

// ─── Follow-Back Tracker: raw snapshot extractor ─────────────────────────────

export async function parseInstagramSnapshotRaw(file) {
  const JSZip = await loadJSZip();
  const zip   = await JSZip.loadAsync(file);

  const TARGET = {
    "followers_1.json":             "followers",
    "following.json":               "following",
    "pending_follow_requests.json": "pendingSent",
  };

  const out = { followers: [], following: [], pendingSent: [], takenAt: new Date().toISOString() };

  for (const [filename, key] of Object.entries(TARGET)) {
    const entry = Object.values(zip.files).find(f => !f.dir && f.name.endsWith("/" + filename));
    if (!entry) continue;
    try {
      const json = JSON.parse(await entry.async("text"));
      const arr  = Array.isArray(json) ? json : json[Object.keys(json)[0]] || [];
      out[key] = arr.map(e => ({
        u:  e.title || e.string_list_data?.[0]?.value || "",
        ts: e.string_list_data?.[0]?.timestamp || null,
      })).filter(x => x.u);
    } catch (e) { console.warn(`Snapshot parse failed for ${filename}:`, e); }
  }

  if (!out.followers.length && !out.following.length) return null;
  return out;
}

// ─── Follow-Back Tracker: comparison engine ───────────────────────────────────

export function compareInstagramSnapshots(snap1, snap2) {
  const MS_DAY = 24 * 60 * 60 * 1000;

  const followers1 = new Set(snap1.followers.map(x => x.u));
  const following1 = new Set(snap1.following.map(x => x.u));
  const pending1   = new Set(snap1.pendingSent.map(x => x.u));
  const followers2 = new Set(snap2.followers.map(x => x.u));
  const following2 = new Set(snap2.following.map(x => x.u));

  const snap1Date = new Date(snap1.takenAt);
  const snap2Date = new Date(snap2.takenAt);
  const spanDays  = Math.round((snap2Date - snap1Date) / MS_DAY);

  const outreachPool    = [...following1].filter(u => !followers1.has(u));
  const followedBack    = outreachPool.filter(u => followers2.has(u));
  const didNotFollowBack = outreachPool.filter(u => !followers2.has(u));
  const pendingAccepted = [...pending1].filter(u => followers2.has(u));
  const newFollowers    = [...followers2].filter(u => !followers1.has(u));
  const lostFollowers   = [...followers1].filter(u => !followers2.has(u));

  const followBackTimes = [];
  for (const u of followedBack) {
    const followerEntry  = snap2.followers.find(x => x.u === u);
    const followingEntry = snap1.following.find(x => x.u === u);
    if (followerEntry?.ts && followingEntry?.ts) {
      const diffDays = (followerEntry.ts * 1000 - followingEntry.ts * 1000) / MS_DAY;
      if (diffDays >= 0 && diffDays <= 365) followBackTimes.push(diffDays);
    }
  }

  const avgFollowBackDays = followBackTimes.length > 0
    ? Math.round((followBackTimes.reduce((a, b) => a + b, 0) / followBackTimes.length) * 10) / 10
    : null;

  const followBackRate = outreachPool.length > 0
    ? Math.round((followedBack.length / outreachPool.length) * 100)
    : null;

  const followerGrowth  = snap2.followers.length - snap1.followers.length;
  const followingGrowth = snap2.following.length - snap1.following.length;

  return {
    id:         Date.now(),
    comparedAt: new Date().toISOString(),
    snap1Date:  snap1.takenAt,
    snap2Date:  snap2.takenAt,
    spanDays,
    outreachPool:     outreachPool.length,
    followedBack:     followedBack.length,
    didNotFollowBack: didNotFollowBack.length,
    pendingAccepted:  pendingAccepted.length,
    newFollowers:     newFollowers.length,
    lostFollowers:    lostFollowers.length,
    followerGrowth,
    followingGrowth,
    followBackRate,
    avgFollowBackDays,
    followedBackList:     followedBack.slice(0, 30),
    didNotFollowBackList: didNotFollowBack.slice(0, 30),
    newFollowersList:     newFollowers.slice(0, 30),
    lostFollowersList:    lostFollowers.slice(0, 30),
    snap1Summary: { followers: snap1.followers.length, following: snap1.following.length, pending: snap1.pendingSent.length },
    snap2Summary: { followers: snap2.followers.length, following: snap2.following.length, pending: snap2.pendingSent.length },
  };
}

// ─── Instagram Snapshot ──────────────────────────────────────────────────────

export function buildIgSnapshot(igData, followBackHistory = []) {
  const snap = { updatedAt: new Date().toISOString() };

  if (igData) {
    snap.followers        = igData.followers;
    snap.following        = igData.following;
    snap.followBackRate   = igData.followBackRate;
    snap.notFollowingBack = igData.notFollowingBack;
    snap.recentFollowers  = igData.recentFollowers;

    if (igData.pendingStats) {
      snap.pendingTotal      = igData.pendingStats.total;
      snap.pendingGhostRate  = igData.pendingStats.ghostRate;
      snap.pendingMedianDays = igData.pendingStats.medianAgeDays;
      snap.outreachPerDay    = igData.pendingStats.requestsPerDay;
    }

    if (igData.followingGrowth) {
      snap.newFollowsLast7d  = igData.followingGrowth.newLast7d;
      snap.newFollowsLast30d = igData.followingGrowth.newLast30d;
    }

    snap.unfollowLast30d = igData.unfollowLast30d;
  }

  if (followBackHistory.length > 0) {
    const rates = followBackHistory
      .filter(r => r.followBackRate != null)
      .map(r => r.followBackRate);
    const times = followBackHistory
      .filter(r => r.avgFollowBackDays != null)
      .map(r => r.avgFollowBackDays);

    if (rates.length > 0) {
      snap.avgFollowBackRate = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
      if (rates.length >= 2) {
        const recent = rates[rates.length - 1];
        const older  = rates.slice(0, -1).reduce((a, b) => a + b, 0) / (rates.length - 1);
        snap.followBackTrend = recent > older + 5 ? "improving"
          : recent < older - 5 ? "declining"
          : "stable";
      }
    }
    if (times.length > 0) {
      snap.avgFollowBackDays = Math.round(
        times.reduce((a, b) => a + b, 0) / times.length * 10
      ) / 10;
    }
    snap.followBackSessions = followBackHistory.length;
  }

  return snap;
}

export function buildInstagramSnapshotContext(snap) {
  if (!snap) return "";
  const parts = [];

  if (snap.followers != null) {
    parts.push(`Instagram: ${snap.followers} followers, following ${snap.following}`);
    if (snap.followBackRate != null) parts.push(`follow-back rate ${snap.followBackRate}%`);
    if (snap.notFollowingBack > 0) parts.push(`${snap.notFollowingBack} not following back`);
    if (snap.recentFollowers > 0) parts.push(`${snap.recentFollowers} new followers this week`);
  }

  if (snap.pendingTotal > 0) {
    parts.push(`${snap.pendingTotal} pending outreach requests`);
    if (snap.pendingGhostRate != null) parts.push(`ghost rate ${snap.pendingGhostRate}% (likely unaccepted)`);
    if (snap.outreachPerDay != null) parts.push(`outreach cadence ${snap.outreachPerDay}/day`);
  }
  if (snap.newFollowsLast7d > 0) parts.push(`followed ${snap.newFollowsLast7d} new accounts this week`);
  if (snap.unfollowLast30d > 0) parts.push(`unfollowed ${snap.unfollowLast30d} in last 30 days`);

  if (snap.avgFollowBackRate != null) {
    parts.push(`follow-back history (${snap.followBackSessions} sessions): avg ${snap.avgFollowBackRate}% follow back`);
    if (snap.avgFollowBackDays != null) parts.push(`avg ${snap.avgFollowBackDays}d to follow back`);
    if (snap.followBackTrend) parts.push(`trend: ${snap.followBackTrend}`);
  }

  const date = snap.updatedAt
    ? new Date(snap.updatedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
    : null;
  if (date) parts.push(`(snapshot: ${date})`);

  return parts.join(" | ");
}