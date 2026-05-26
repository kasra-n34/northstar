import { useState } from "react";
import { PILLARS } from "../constants";
import { Mono } from "./ui";

const LS_KEY = "northstar_onboarding_v1_done";

export function shouldShowOnboarding() {
  return !localStorage.getItem(LS_KEY);
}

export function markOnboardingDone() {
  localStorage.setItem(LS_KEY, "1");
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--c)", letterSpacing: 4, marginBottom: 16 }}>⬡ NORTHSTAR OS</div>
      <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: 52, letterSpacing: 3, color: "var(--text)", lineHeight: 1, marginBottom: 10 }}>
        Your Personal<br />Development OS
      </h1>
      <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.8, maxWidth: 420, margin: "0 auto 24px" }}>
        Northstar tracks your life across four pillars — physical, financial, network, and social — uses AI to analyze where you stand, and generates specific weekly missions to move each one forward.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, maxWidth: 420, margin: "0 auto" }}>
        {[
          { icon: "◎", label: "100% LOCAL",   sub: "No cloud. No accounts." },
          { icon: "⟳", label: "WEEKLY RITUAL", sub: "~5 min every Sunday." },
          { icon: "◉", label: "AI MISSIONS",   sub: "Specific, ranked actions." },
        ].map(c => (
          <div key={c.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 16, color: "var(--c)", marginBottom: 5 }}>{c.icon}</div>
            <Mono s={{ fontSize: 8, color: "var(--c)", letterSpacing: 1.5, display: "block", marginBottom: 3 }}>{c.label}</Mono>
            <div style={{ fontSize: 10, color: "var(--text3)", lineHeight: 1.4 }}>{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepPillars() {
  return (
    <div>
      <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 6 }}>THE FOUR PILLARS</Mono>
      <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 2, color: "var(--text)", marginBottom: 8, lineHeight: 1 }}>Everything tracked in one place</h2>
      <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, marginBottom: 18 }}>
        Each pillar has its own score (1–100), AI analysis, action plan, and score history. They feed into each other — better training sharpens focus, income expands network access, social energy affects everything.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {PILLARS.map(p => (
          <div key={p.id} style={{ background: "var(--bg2)", border: `1px solid ${p.color}33`, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: p.color + "88" }} />
            <div style={{ color: p.color, fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 2, marginBottom: 5 }}>{p.icon} {p.label}</div>
            <div style={{ fontSize: 11, color: "var(--text)", fontWeight: 500, marginBottom: 3 }}>{p.sub}</div>
            <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>{p.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepFirstSteps() {
  const steps = [
    {
      n: "01", color: "var(--p)",
      title: "Add your Anthropic API key in Settings",
      desc: (
        <>
          Open <strong style={{ color: "var(--text)" }}>Settings</strong> and paste your{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: "var(--c)", textDecoration: "none", borderBottom: "1px solid var(--c)55" }}>
            Anthropic API key
          </a>{" "}
          — this is required for all AI features. Anthropic requires a minimum $5 credit top-up to activate API access. In practice, a weekly sync costs a few cents, so $5 lasts a long time.
        </>
      ),
    },
    {
      n: "02", color: "var(--c)",
      title: "Set up your Profile",
      desc: "Add your name, current job, and goals. This context helps the AI give advice specific to your actual situation — not generic tips.",
    },
    {
      n: "03", color: "var(--y)",
      title: "Fill in each Pillar's Core Goals",
      desc: "Each pillar has a Core Goals section — stable facts about your situation, targets, and constraints. Fill these in once. The Current Status section is updated automatically each week from your check-in.",
    },
    {
      n: "04", color: "var(--o)",
      title: "Hit ⟳ Sync Northstar",
      desc: "Your first sync runs AI analysis on all four pillars and loads your Pending mission queue. Takes 20–60 seconds.",
    },
    {
      n: "05", color: "var(--g)",
      title: "Accept your first missions",
      desc: "Go to Missions and review what Northstar generated. Accept the ones that resonate, decline the rest. Your queue refreshes every Sunday after the weekly check-in.",
    },
  ];

  return (
    <div>
      <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 6 }}>GETTING STARTED</Mono>
      <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 2, color: "var(--text)", marginBottom: 8, lineHeight: 1 }}>Five steps to your first week</h2>
      <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, marginBottom: 18 }}>
        Setup takes about 15 minutes. After that, all you need is 10 minutes every Sunday.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((s, i) => (
          i === 0 ? (
            <div key={s.n} style={{ background: "var(--r)0D", border: "1px solid var(--r)55", padding: "14px 16px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--r)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Mono s={{ fontSize: 8, color: "var(--r)", letterSpacing: 2, background: "var(--r)18", padding: "2px 8px" }}>DO THIS FIRST</Mono>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ) : (
            <div key={s.n} style={{ display: "flex", gap: 14, background: "var(--bg2)", border: `1px solid ${s.color}22`, padding: "12px 14px", alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: s.color + "18", border: `1px solid ${s.color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Mono s={{ fontSize: 9, color: s.color, fontWeight: 600 }}>{s.n}</Mono>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function StepSundayFlow() {
  const flow = [
    { icon: "⊕", color: "var(--c)", label: "Upload fresh data",        desc: "Optionally upload your latest Hevy workout CSV or Instagram connections ZIP before starting." },
    { icon: "?", color: "var(--y)", label: "Answer status questions",   desc: "Two focused questions per active pillar, plus bookends: how your week went and what you're committing to next." },
    { icon: "⬡", color: "var(--o)", label: "NORTHSTAR analyzes",        desc: "Scores your week, adjusts pillar scores, generates 2 urgent missions, and saves a digest to memory." },
    { icon: "⟳", color: "var(--g)", label: "Save & sync",               desc: "Your answers are saved directly to your pillar profiles, then a full sync re-analyzes all pillars and refreshes your mission queue." },
  ];

  return (
    <div>
      <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 6 }}>THE WEEKLY RITUAL</Mono>
      <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 2, color: "var(--text)", marginBottom: 8, lineHeight: 1 }}>Every Sunday, ~5 minutes</h2>
      <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, marginBottom: 16 }}>
        The Sunday check-in is the heartbeat of northstar. It keeps every pillar's current status up to date, scores your week against prior ones, and reloads your mission queue. The dashboard shows a live countdown and shows a <strong style={{ color: "var(--c)" }}>Begin →</strong> button when Sunday arrives.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {flow.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", background: "var(--bg2)", border: `1px solid ${f.color}22` }}>
            <div style={{ width: 26, height: 26, background: f.color + "18", border: `1px solid ${f.color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, color: f.color }}>{f.icon}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: f.color, marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepPrivacy() {
  return (
    <div>
      <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 6 }}>YOUR DATA</Mono>
      <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 2, color: "var(--text)", marginBottom: 8, lineHeight: 1 }}>Stays on your machine</h2>
      <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, marginBottom: 16 }}>
        Northstar is designed so you never have to wonder what happens to your personal data. There's no account, no server, no subscription.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {[
          { icon: "◎", color: "var(--g)", title: "Stored locally", body: "All your data lives in one file on your computer: northstar-backend/data/northstar_data.json. Only you can access it." },
          { icon: "⬡", color: "var(--c)", title: "AI calls are private", body: "Your pillar answers are sent to Anthropic's Claude API (your own API key) to generate analysis and missions. Anthropic deletes API call data within 7 days and doesn't use it to train models." },
          { icon: "◉", color: "var(--y)", title: "Protected locally too", body: "The backend requires a secret auth token on every request. Your data file is set to owner-only permissions. Nothing personal is written to logs." },
        ].map(item => (
          <div key={item.title} style={{ display: "flex", gap: 14, background: "var(--bg2)", border: `1px solid ${item.color}22`, padding: "12px 14px", alignItems: "flex-start" }}>
            <div style={{ fontSize: 16, color: item.color, flexShrink: 0, marginTop: 1 }}>{item.icon}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: "var(--c)0D", border: "1px solid var(--c)33", padding: "12px 16px" }}>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.7 }}>
          <strong style={{ color: "var(--c)" }}>Bottom line:</strong> the only thing that ever leaves your computer is the AI prompt when you hit Sync — and only to Anthropic, using your own API key. Everything else stays here.
        </div>
      </div>
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: "welcome",    label: "Welcome",       component: StepWelcome },
  { id: "pillars",    label: "Four Pillars",  component: StepPillars },
  { id: "first",      label: "First Steps",   component: StepFirstSteps },
  { id: "sunday",     label: "Sunday Flow",   component: StepSundayFlow },
  { id: "privacy",    label: "Your Data",     component: StepPrivacy },
];

export default function OnboardingModal({ onDone }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const StepContent = STEPS[step].component;

  const next = () => isLast ? finish() : setStep(s => s + 1);
  const back = () => setStep(s => s - 1);
  const finish = () => { markOnboardingDone(); onDone(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", width: "100%", maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

        {/* Top accent line */}
        <div style={{ height: 2, background: "linear-gradient(90deg,var(--c),var(--p),transparent)", flexShrink: 0 }} />

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                style={{
                  height: 3,
                  width: i === step ? 24 : 8,
                  background: i === step ? "var(--c)" : i < step ? "var(--c)55" : "var(--border2)",
                  transition: "all 0.3s ease",
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
          <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>{step + 1} / {STEPS.length}</Mono>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <StepContent />
        </div>

        {/* Footer nav */}
        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "var(--bg1)" }}>
          <div>
            {step > 0 ? (
              <button
                onClick={back}
                style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "8px 16px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1.5 }}
              >
                ← BACK
              </button>
            ) : (
              <button
                onClick={finish}
                style={{ background: "none", border: "none", color: "var(--text3)", padding: "8px 0", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, cursor: "pointer" }}
              >
                SKIP TUTORIAL
              </button>
            )}
          </div>
          <button
            onClick={next}
            style={{ background: isLast ? "var(--c)" : "var(--bg3)", color: isLast ? "#000" : "var(--text)", border: `1px solid ${isLast ? "var(--c)" : "var(--border2)"}`, padding: "9px 22px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1.5, fontWeight: isLast ? 600 : 400, transition: "all 0.2s" }}
          >
            {isLast ? "LET'S GO →" : "NEXT →"}
          </button>
        </div>
      </div>
    </div>
  );
}
