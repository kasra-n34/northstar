export const PILLARS = [
  {
    id: "physicality", label: "PHYSICALITY", icon: "⚡", color: "#E8FF3B",
    sub: "Strength & Physical Activity",
    description: "Weightlifting, martial arts training, physical conditioning and performance.",
    questions: [
      { key: "goals",       q: "Key physical goals? (e.g. 225lb bench, BJJ blue belt)",                                     core: true },
      { key: "martialArt",  q: "Do you train or want to train martial arts and/or sports? List each with specific goals.",   core: true },
      { key: "limitations", q: "Any long term injuries?",                                                                    core: true },
      { key: "access",      q: "Gym and facility access?",                                                                   core: true },
      { key: "recovery",    q: "How has your energy, sleep, recovery, and nutrition been this week?" },
      { key: "focus",       q: "What's your main training focus right now — a specific lift, skill, or conditioning goal?" },
    ],
  },
  {
    id: "affluence", label: "AFFLUENCE", icon: "◇", color: "#FF6B35",
    sub: "Income & Ventures",
    description: "High-ROI income moves, career leverage, side ventures and wealth building.",
    questions: [
      { key: "education",    q: "What's your educational background? Include completed degrees, certifications, or anything currently in progress.", core: true },
      { key: "occupation",   q: "Are you currently employed? If so, what's your role and approximate income? Briefly list your relevant work experience.", core: true },
      { key: "assets",       q: "What unique skills, knowledge, or assets do you have that could be monetized or leveraged?", core: true },
      { key: "sideProjects", q: "Do you have any side projects or entrepreneurial goals — active, planned, or just ideas you're serious about?", core: true },
      { key: "vision",       q: "What's your dream job or career outcome, and what's your specific long-term income goal?", core: true },
      { key: "ventures",     q: "What's the most notable development in your work or income this week — and what's the key move you're making right now?" },
      { key: "bottleneck",   q: "What's the biggest obstacle between you and your income target right now?" },
    ],
  },
  {
    id: "network", label: "NETWORK", icon: "○", color: "#B03BFF",
    sub: "Relationships & Resources",
    description: "Meeting high-value people, maintaining relationships, social capital.",
    questions: [
      { key: "targets",     q: "What type of people do you most need in your network?",      core: true },
      { key: "value",       q: "What value can you offer others in your target network?",    core: true },
      { key: "location",    q: "Your city / area?",                                          core: true },
      { key: "circle",      q: "Who are the key people already in your life — long-term friends, mentors, or recurring contacts you have a real relationship with?", core: true },
      { key: "keyRels",     q: "Who did you meet or meaningfully connect with this week — any new people or existing relationships you invested in?" },
      { key: "pipeline",    q: "What networking opportunity or event are you working toward in the next 2 weeks?" },
    ],
  },
  {
    id: "social", label: "SOCIAL", icon: "✦", color: "#E1306C",
    sub: "Personal Social Life",
    description: "Personal social media presence, friendships, dating, and social energy.",
    questions: [
      { key: "socialGoals", q: "Long-term vision for your social life — what does thriving look like for you?",                    core: true },
      { key: "priorities",  q: "What matters most to you personally right now — romantically, socially, and in terms of self-growth?", core: true },
      { key: "instagram",   q: "How do you use Instagram personally? (posting habits, who you follow, how it makes you feel)",     core: true },
      { key: "socialLife",  q: "How was your social life this week — did you get out, see people, and how sharp and confident did you feel socially?" },
      { key: "dating",      q: "What's your current romantic/dating situation and how do you feel about where it's at?" },
    ],
  },
];

export const ONE_WEEK_MS         = 7 * 24 * 60 * 60 * 1000;
export const LOG_RETENTION_WEEKS = 4; // default fallback — actual value stored in state.retentionWeeks
export const BACKEND             = "http://localhost:3001";

export const EMPTY_STATE = {
  userProfile:       {},
  profiles:          {},
  analyses:          {},
  missions:          [],
  recurringMissions: [],  // weekly habit missions — never move to completed, reset each Sunday
  pendingMissions:   [],
  completedMissions: [],
  missionCompletedAt: {}, // { [missionId]: ISO string } — timestamp when each mission was marked done
  deletedMissionLog:  [], // [{ pillarId, deletedAt }] — non-completed missions deleted, for scoring
  metaAnalysis:      null,
  lastMetaDate:      null,
  networkContacts:   [],
  networkSuggestions:[],
  integrations:      {},
  drafts:            {},
  weeklyLogs:        [],
  lastInterviewDate: null,
  retentionWeeks:    4,
  jobHunt: {
    masterResume:       "",
    genericCoverLetter: "",
    applications:       [],
    companyResearch:    [], // saved per-company research docs — reused if <6mo old, searchable in its own sub-tab
  },
};

export const NAV = [
  { id: "dashboard",    label: "DASHBOARD",      icon: "▣" },
  { id: "profile",      label: "PROFILE",         icon: "◎" },
  { id: "physicality",  label: "PHYSICALITY",     icon: "⚡" },
  { id: "affluence",    label: "AFFLUENCE",       icon: "◇" },
  { id: "network",      label: "NETWORK",         icon: "○" },
  { id: "social",       label: "SOCIAL",          icon: "✦" },
  { id: "missions",     label: "MISSIONS",        icon: "◉" },
  { id: "interview",    label: "WEEKLY CHECK-IN", icon: "⟳" },
  { id: "jobhunt",      label: "JOB HUNT",        icon: "✎" },
  { id: "meta",         label: "META",            icon: "⬡" },
  { id: "integrations", label: "CONNECT",         icon: "⊕" },
  { id: "guide",        label: "HOW IT WORKS",    icon: "?" },
  { id: "settings",     label: "SETTINGS",        icon: "⚙" },
  { id: "terms", label: "TERMS OF SERVICE", icon: "§" },
];