// Real implementation lives in JobHuntView.local.jsx, which is gitignored and only
// present on dev machines that opt in. If it's not there, this falls back to a
// simple "coming soon" placeholder so the tab still renders in the shipped repo.
const localModules = import.meta.glob("./JobHuntView.local.jsx", { eager: true });
const LocalJobHuntView = localModules["./JobHuntView.local.jsx"]?.default;

function ComingSoon() {
  return (
    <div style={{ textAlign: "center", padding: "70px 0" }}>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 38, color: "var(--border2)", marginBottom: 14 }}>COMING SOON</div>
      <div style={{ color: "var(--text3)", fontSize: 13 }}>Tailored resumes, cover letters, and application tracking — in progress.</div>
    </div>
  );
}

export default function JobHuntView(props) {
  if (LocalJobHuntView) return <LocalJobHuntView {...props} />;
  return <ComingSoon />;
}
