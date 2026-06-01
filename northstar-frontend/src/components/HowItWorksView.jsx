import { PILLARS } from "../constants";
import { Mono, Tag } from "./ui";

function Section({ title, icon, color = "var(--text3)", children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
        {icon && <span style={{ fontSize: 16, color }}>{icon}</span>}
        <Mono s={{ fontSize: 14, color, letterSpacing: 2 }}>{title}</Mono>
      </div>
      {children}
    </div>
  );
}

function P({ children, style = {} }) {
  return <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.8, marginBottom: 10, ...style }}>{children}</p>;
}

function Callout({ color = "var(--c)", icon, children }) {
  return (
    <div style={{ background: color + "0D", border: `1px solid ${color}33`, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
      {icon && <span style={{ color, fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>}
      <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function Step({ n, color, title, desc }) {
  return (
    <div style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: color + "22", border: `1px solid ${color}66`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Mono s={{ fontSize: 14, color, fontWeight: 600 }}>{n}</Mono>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

export default function HowItWorksView({ state }) {
  const toc = [
    { id: "overview",     label: "Overview" },
    { id: "pillars",      label: "The Four Pillars" },
    { id: "scoring",      label: "How Scores Work" },
    { id: "sunday",       label: "Sunday Weekly Flow" },
    { id: "sync",         label: "Sync" },
    { id: "integrations", label: "Integrations" },
    { id: "memory",       label: "Memory & History" },
    { id: "meta",         label: "Meta-Analysis" },
    { id: "privacy",      label: "Privacy" },
    { id: "security",     label: "Local Security" },
  ];

  const scrollTo = (id) => {
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 40, maxWidth: 946 }}>

      <div style={{ position: "sticky", top: 0, alignSelf: "start", paddingTop: 4 }}>
        <Mono s={{ fontSize: 14, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 10 }}>CONTENTS</Mono>
        {toc.map(t => (
          <button key={t.id} onClick={() => scrollTo(t.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "5px 0", fontFamily: "'DM Mono',monospace", fontSize: 13, color: "var(--text3)", letterSpacing: 1, cursor: "pointer", lineHeight: 1.8 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ color: "var(--y)", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 3, marginBottom: 5 }}>? DOCUMENTATION</div>
          <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 1, color: "var(--text)", marginBottom: 8 }}>How Northstar Works</h2>
          <P>Northstar is a local-first personal development OS. Everything runs on your machine — no cloud, no subscriptions, no data leaving your computer except API calls to Anthropic for AI analysis.</P>
        </div>

        <div id="section-overview">
          <Section title="OVERVIEW" icon="▣" color="var(--y)">
            <P>Northstar collects structured information about your life across four domains, uses AI to analyze patterns and generate specific actions, and keeps everything current through a Sunday ritual. The workflow: <strong style={{ color: "var(--text)" }}>set up pillars → every Sunday, answer your check-in, auto-sync generates new missions → repeat.</strong></P>
            <Callout color="var(--y)" icon="▣">
              All AI calls go through your local backend which forwards them to Anthropic using your API key. Nothing is stored server-side.
            </Callout>

            <div style={{ marginTop: 4, marginBottom: 4 }}>
              <Mono s={{ fontSize: 14, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 10 }}>MISSIONS</Mono>
              <P>Missions are the action layer — specific tasks northstar generates from your pillar analyses and weekly check-ins. Every mission belongs to a pillar and has a difficulty, estimated time, and a rationale. There are four types:</P>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  {
                    icon: "◉", color: "var(--c)", label: "Standard",
                    desc: "A one-off task with no repetition. May include 2–5 subtasks for multi-phase work — check them off as you go.",
                    example: "Write a cold outreach email → [Draft, Review, Send]",
                  },
                  {
                    icon: "◎", color: "var(--y)", label: "Counted",
                    desc: "A one-time goal with a clear numeric target. Track progress as you hit each unit — mission completes when you reach the count.",
                    example: "Reach out to 10 new contacts this month",
                  },
                  {
                    icon: "⟳", color: "var(--g)", label: "Recurring",
                    desc: "An ongoing weekly habit with a frequency target. Resets every Sunday — never moves to completed, just tracked against its weekly goal.",
                    example: "Train 4× per week, meditate daily",
                  },
                  {
                    icon: "⬡", color: "var(--p)", label: "Pending → Active",
                    desc: "All new missions land in Pending first. Accept to move them to your active queue, or decline to dismiss. Accepted missions are tracked for scoring.",
                    example: "Review pending after each sync or check-in",
                  },
                ].map(m => (
                  <div key={m.label} style={{ background: "var(--bg2)", border: `1px solid ${m.color}33`, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: m.color + "66" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                      <span style={{ color: m.color, fontSize: 14 }}>{m.icon}</span>
                      <Mono s={{ fontSize: 13, color: m.color, letterSpacing: 1.5 }}>{m.label.toUpperCase()}</Mono>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 7 }}>{m.desc}</div>
                    <div style={{ fontSize: 14, color: "var(--text3)", fontStyle: "italic", borderLeft: `2px solid ${m.color}44`, paddingLeft: 8 }}>{m.example}</div>
                  </div>
                ))}
              </div>
            <Callout color="var(--text3)" icon="⬡">
              <strong style={{ color: "var(--text)" }}>Dynamic mission cap —</strong> Sync checks how many missions are already active or pending (excluding the check-in missions just generated) before generating new ones. 0–2 queued → up to 3 per pillar. 3–4 queued → 2 per pillar. 5 queued → 1 per pillar. 6+ queued → none generated. This keeps your queue from piling up when you already have plenty to do. Check-in missions are always excluded from this count so they never suppress the sync output.
            </Callout>
            </div>
          </Section>
        </div>

        <div id="section-pillars">
          <Section title="THE FOUR PILLARS" icon="◈" color="var(--c)">
            <P>Each pillar has its own analysis, score (1–100), and action plan that evolves over time. They reinforce each other — physical training improves focus, income expands network access, network shapes environment and motivation.</P>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {PILLARS.map(p => (
                <div key={p.id} style={{ background: "var(--bg2)", border: `1px solid ${p.color}33`, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: p.color + "88" }} />
                  <div style={{ color: p.color, fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 2, marginBottom: 5 }}>{p.icon} {p.label}</div>
                  <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 6 }}>{p.description}</div>
                  <Mono s={{ fontSize: 14, color: "var(--text3)" }}>{p.questions.length} setup questions</Mono>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div id="section-scoring">
          <Section title="HOW SCORES WORK" icon="◈" color="var(--y)">
            <P>Every pillar has a score from 1–100. After your first sync, scores are anchored to the previous week and updated by a deterministic algorithm based on mission performance. The AI adds a small qualitative adjustment on top.</P>

            <Step n="1" color="var(--y)" title="First sync — Claude scores freely" desc="No history to anchor to. Claude reads your full profile and sets an initial score (1–100) based on its honest assessment. This is the only time the score is fully free-form." />
            <Step n="2" color="var(--y)" title="Every subsequent sync — algorithmic baseline first" desc="The system computes a mission-performance delta and adds it to your previous score. Claude must then set the score within ±6 of that baseline — its only latitude is a qualitative read on your profile text." />
            <Step n="3" color="var(--y)" title="Score history is tracked" desc="Every sync result is appended to a score history (up to 12 points). With 2+ data points your pillar card shows a sparkline so you can see the trend at a glance." />

            <div style={{ background: "var(--bg2)", border: "1px solid var(--y)33", padding: "16px 18px", marginBottom: 14 }}>
              <Mono s={{ fontSize: 14, color: "var(--y)", letterSpacing: 2, display: "block", marginBottom: 14 }}>MISSION PERFORMANCE → POINT DELTA</Mono>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <Mono s={{ fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>RECURRING HABITS</Mono>
                  {[
                    { label: "100% of target hit",  pts: "+3", color: "var(--g)" },
                    { label: "75% of target hit",   pts: "+2", color: "var(--g)" },
                    { label: "50–74% hit",          pts: "+1", color: "var(--g)" },
                    { label: "25–49% hit",          pts: "−1", color: "var(--o)" },
                    { label: "Under 25% (missed)",  pts: "−2", color: "var(--r)" },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 13, color: "var(--text2)" }}>{r.label}</div>
                      <Mono s={{ fontSize: 13, color: r.color, fontWeight: 600 }}>{r.pts}</Mono>
                    </div>
                  ))}
                </div>

                <div>
                  <Mono s={{ fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>ONE-OFF MISSIONS</Mono>
                  {[
                    { label: "Completed (counted)",        pts: "+3", color: "var(--g)" },
                    { label: "Completed (standard)",       pts: "+2", color: "var(--g)" },
                    { label: "75%+ progress (counted)",    pts: "+2", color: "var(--g)" },
                    { label: "50–74% progress",            pts: "+1", color: "var(--g)" },
                    { label: "50%+ subtasks (standard)",   pts: "+1", color: "var(--g)" },
                    { label: "Overdue, not completed",     pts: "−3", color: "var(--r)" },
                    { label: "<50% progress, not overdue", pts: "−1", color: "var(--o)" },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--border)", gap: 8 }}>
                      <div style={{ fontSize: 13, color: "var(--text2)" }}>{r.label}</div>
                      <Mono s={{ fontSize: 13, color: r.color, fontWeight: 600, flexShrink: 0 }}>{r.pts}</Mono>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--bg3)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 14, color: "var(--text2)" }}>Total algorithmic delta is <strong style={{ color: "var(--text)" }}>capped at ±10 per sync</strong> regardless of mission count.</div>
              </div>
            </div>

            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", padding: "14px 18px", marginBottom: 14 }}>
              <Mono s={{ fontSize: 14, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 10 }}>SCORING FORMULA PER SYNC</Mono>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: "Previous score",             color: "var(--c)" },
                  { label: "+",                          color: "var(--text3)" },
                  { label: "Mission delta (−10 to +10)", color: "var(--y)" },
                  { label: "+",                          color: "var(--text3)" },
                  { label: "AI qualitative (±6)",        color: "var(--p)" },
                  { label: "=",                          color: "var(--text3)" },
                  { label: "New score",                  color: "var(--g)" },
                ].map((part, i) => (
                  <div key={i} style={{ background: part.color === "var(--text3)" ? "transparent" : part.color + "15", border: part.color === "var(--text3)" ? "none" : `1px solid ${part.color}44`, padding: part.color === "var(--text3)" ? "0" : "5px 10px" }}>
                    <Mono s={{ fontSize: part.color === "var(--text3)" ? 14 : 10, color: part.color, fontWeight: 600 }}>{part.label}</Mono>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--text3)", lineHeight: 1.6 }}>Result is clamped to 1–100. The AI qualitative adjustment captures things mission data can't — momentum in your written answers, contextual signals, or progress without a formal mission attached.</div>
            </div>

            <Callout color="var(--c)" icon="⟳">
              After your weekly check-in, the results screen shows a qualitative delta (±6) per pillar based on Claude's read of what you reported. The <strong>actual new score</strong> is computed at sync time using the full formula above.
            </Callout>
          </Section>
        </div>

        <div id="section-sunday">
          <Section title="SUNDAY WEEKLY FLOW" icon="⟳" color="var(--c)">
            <P>Every Sunday, a structured 4-step ritual keeps everything current. The dashboard shows a live countdown and a "Begin →" button on Sundays.</P>

            <Step n="1" color="var(--c)" title="Data Refresh" desc="Upload fresh data — Hevy workout CSV and/or Instagram Connections ZIP. Both optional. Each card shows when data was last uploaded." />
            <Step n="2" color="var(--c)" title="Weekly Check-In" desc="Answer current-status questions for each active pillar — how training went, career developments, who you connected with, your dating and social life — plus an opening rating and a closing commitment for next week. The following Sunday you're asked how that commitment went." />
            <Step n="3" color="var(--c)" title="NORTHSTAR Analyzes Your Week" desc="Your answers, recent log history, pillar scores, and mission progress are sent to Claude. It returns a progress summary, pillar score adjustments, 2 urgent new missions, a per-pillar digest for long-term memory, and a closing insight." />
            <Step n="4" color="var(--c)" title="Save & Auto-Sync" desc="Your check-in answers are saved directly to your pillar profiles. NORTHSTAR then re-analyzes every pillar with fresh data and generates new missions per pillar — how many depends on how full your queue already is (see dynamic mission cap above). You see a 'Week Locked In' screen when complete." />

            <Callout color="var(--c)" icon="⟳">
              One Sunday session produces updated pillar profiles, fresh analyses, adjusted scores, and up to 14 new missions in your Pending queue.
            </Callout>
          </Section>
        </div>

        <div id="section-sync">
          <Section title="SYNC (MANUAL OVERRIDE)" icon="⟳" color="var(--text2)">
            <P>The <strong style={{ color: "var(--text)" }}>⟳ SYNC NORTHSTAR</strong> button is a manual override — under normal use you never need it. Use it when you've changed pillar answers mid-week or connected new integration data. Always shows a confirmation dialog first.</P>
            <Step n="1" color="var(--text2)" title="Re-analyze each pillar" desc="Physicality → Affluence → Network → Social. Each uses your latest answers, integration data, completed missions, and check-in digests. Each produces 3 missions sent to Pending." />
            <Step n="2" color="var(--text2)" title="Generate meta-analysis" desc="Synthesizes all updated pillar scores and check-in history into a full weekly overview." />
            <P style={{ fontSize: 14 }}>A full 4-pillar sync takes 20–55 seconds. There's a 3.5-second gap between calls to stay under rate limits.</P>
          </Section>
        </div>

        <div id="section-integrations">
          <Section title="INTEGRATIONS" icon="⊕" color="var(--c)">
            <P>All parsing happens locally — raw files never leave your machine. Only extracted summaries are sent to the AI.</P>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {[
                {
                  icon: "📸", name: "Instagram Connections", color: "#E1306C",
                  sent: "Follower count, following count, follow-back rate, pending requests",
                  local: "Full follower/following lists, unfollowed accounts",
                },
                {
                  icon: "🏋️", name: "Hevy Workout Data", color: "var(--o)",
                  sent: "Exercise names, best set weights/reps, trend direction per exercise",
                  local: "Full session history, volume data, all individual set records",
                },
              ].map(src => (
                <div key={src.name} style={{ background: "var(--bg2)", border: "1px solid var(--border)", padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 15 }}>{src.icon}</span>
                    <Mono s={{ fontSize: 14, color: src.color, letterSpacing: 1 }}>{src.name}</Mono>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <Mono s={{ fontSize: 7, color: "var(--o)", letterSpacing: 1.5, display: "block", marginBottom: 5 }}>SENT TO AI</Mono>
                      <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{src.sent}</div>
                    </div>
                    <div>
                      <Mono s={{ fontSize: 7, color: "var(--g)", letterSpacing: 1.5, display: "block", marginBottom: 5 }}>STAYS LOCAL</Mono>
                      <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{src.local}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div id="section-memory">
          <Section title="MEMORY & HISTORY" icon="⟳" color="var(--c)">
            <P>Northstar has two types of memory: <strong style={{ color: "var(--text)" }}>pillar score history</strong> (up to 12 data points per pillar, never expires) and <strong style={{ color: "var(--text)" }}>weekly check-in logs</strong> (configurable retention in Settings).</P>

            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", padding: 16, marginBottom: 14 }}>
              <Mono s={{ fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 10 }}>LOG LIFECYCLE</Mono>
              <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
                {[
                  { label: "Check-in done",  sub: "Full answers stored",              color: "var(--c)" },
                  { label: "After 1 week",   sub: "Answers compressed → digest only", color: "var(--y)" },
                  { label: "After N weeks",  sub: "Digest pruned (N = your setting)", color: "var(--o)" },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ background: s.color + "15", border: `1px solid ${s.color}44`, padding: "8px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 13, color: s.color, fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
                      <Mono s={{ fontSize: 14, color: "var(--text3)" }}>{s.sub}</Mono>
                    </div>
                    {i < 2 && <div style={{ color: "var(--text3)", fontSize: 16, margin: "0 4px" }}>→</div>}
                  </div>
                ))}
              </div>
            </div>

            <P>At the end of each check-in, Claude generates two things: a <strong style={{ color: "var(--text)" }}>short overall digest</strong> (1-2 sentences) for log display, and a <strong style={{ color: "var(--text)" }}>per-pillar digest</strong> (2-3 specific sentences per active pillar). After 1 week, raw interview answers are deleted and only these digests are kept.</P>
            <P>During sync, each pillar analysis receives only its own digest history — specific, relevant context without noise from other pillars. The meta-analysis receives the full cross-pillar digest history for all retained weeks, giving it a complete longitudinal picture. Your configured retention weeks controls how many weeks of this history are kept and used.</P>
            <P>After every check-in, your answers to the current-status questions are saved directly to your pillar profiles. These persist indefinitely — they're what every future Sync reads as your current situation.</P>
          </Section>
        </div>

        <div id="section-meta">
          <Section title="META-ANALYSIS" icon="⬡" color="var(--y)">
            <P>The Meta tab synthesizes all four pillars into a weekly overview — cross-pillar patterns, synergy opportunities, bottlenecks, and a day-by-day schedule that individual pillar analyses can't produce.</P>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Overall Score",       desc: "Weighted average across all active pillars" },
                { label: "Dominant Strength",   desc: "The pillar creating the most momentum" },
                { label: "Critical Weakness",   desc: "The biggest drag on overall progress" },
                { label: "Synergy Opportunity", desc: "Where two pillars can amplify each other" },
                { label: "Top Leverage Action", desc: "The single highest-ROI move this week" },
                { label: "Weekly Schedule",     desc: "Optimal day-by-day focus areas" },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--bg2)", padding: "10px 12px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--y)", marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div id="section-privacy">
          <Section title="PRIVACY" icon="◎" color="var(--g)">
            <Callout color="var(--g)" icon="◎">
              <strong>Northstar is local-first.</strong> All data is stored in <code style={{ color: "var(--text3)" }}>northstar-backend/data/northstar_data.json</code> on your machine and never leaves your computer except for AI API calls.
            </Callout>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Sent to Anthropic", color: "var(--o)", items: [
                  "Pillar answers, check-in answers and digests",
                  "Instagram follower/following counts and rates",
                  "Workout context (exercise names, weights, trend direction)",
                  "Your profile stats (age, sex, height, weight) — name is excluded",
                ]},
                { label: "Stays on your machine only", color: "var(--g)", items: [
                  "Raw workout CSV and full session history",
                  "Full check-in answers (first week before compression)",
                  "Your photo, network contacts, all mission history",
                ]},
                { label: "Anthropic's handling", color: "var(--text3)", items: [
                  "API calls retained up to 7 days then permanently deleted",
                  "Not used to train models (API usage)",
                  "Each call is stateless — no persistent user identity",
                ]},
              ].map(section => (
                <div key={section.label} style={{ background: "var(--bg2)", border: `1px solid ${section.color}22`, padding: "12px 14px" }}>
                  <Mono s={{ fontSize: 14, color: section.color, letterSpacing: 1.5, display: "block", marginBottom: 8 }}>{section.label.toUpperCase()}</Mono>
                  {section.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                      <span style={{ color: section.color, fontSize: 14, flexShrink: 0, marginTop: 2 }}>·</span>
                      <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>{item}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <P style={{ fontSize: 14 }}>To back up: copy <code style={{ color: "var(--text3)" }}>northstar-backend/data/northstar_data.json</code> to a safe location. To delete everything: delete that file and restart the backend.</P>
          </Section>
        </div>

        <div id="section-security">
          <Section title="LOCAL SECURITY" icon="◎" color="var(--c)">
            <P>Three layers of protection against local attack surfaces — other processes, port scanners, and malicious browser extensions.</P>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {[
                {
                  icon: "⬡", title: "API Auth Token", color: "var(--c)",
                  body: "On startup the backend generates a random 64-character token stored in data/config.json. Every API request must include it — requests without it are rejected with a 401. Other programs on your machine cannot read your data even if they find the port.",
                },
                {
                  icon: "◎", title: "File Permission Hardening", color: "var(--y)",
                  body: "northstar_data.json is written with chmod 600 — readable and writable only by your user account. Other users on the same machine cannot read your data file directly.",
                },
                {
                  icon: "✦", title: "No Personal Data in Logs", color: "var(--g)",
                  body: "The backend doesn't log your profile answers, pillar content, or AI prompt bodies to the terminal. Only operational events (errors, status codes) are logged.",
                },
              ].map(item => (
                <div key={item.title} style={{ background: "var(--bg2)", border: `1px solid ${item.color}22`, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: item.color + "66" }} />
                  <div style={{ paddingLeft: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ color: item.color, fontSize: 13 }}>{item.icon}</span>
                      <Mono s={{ fontSize: 13, color: item.color, letterSpacing: 1.5 }}>{item.title.toUpperCase()}</Mono>
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.7 }}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <Callout color="var(--text3)" icon="◎">
              These measures don't protect against full-disk access. Enable macOS FileVault (System Settings → Privacy &amp; Security → FileVault) for disk-level encryption.
            </Callout>
          </Section>
        </div>

      </div>
    </div>
  );
}
