import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  componentDidCatch(error, info) {
    this.setState({ error, info });
    console.error("💥 App crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          fontFamily: "monospace", padding: 40, background: "#0a0a0a",
          color: "#ff4444", minHeight: "100vh"
        }}>
          <h2 style={{ color: "#E8FF3B", marginBottom: 8 }}>💥 RENDER ERROR</h2>
          <pre style={{ color: "#ff6b6b", whiteSpace: "pre-wrap", marginBottom: 24 }}>
            {this.state.error.toString()}
          </pre>
          <h3 style={{ color: "#888", marginBottom: 8 }}>Component Stack:</h3>
          <pre style={{ color: "#666", fontSize: 13, whiteSpace: "pre-wrap" }}>
            {this.state.info?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Catch unhandled promise rejections and JS errors
window.addEventListener("error", e => {
  console.error("🔴 Global error:", e.message, e.filename, `line ${e.lineno}`);
  document.getElementById("debug-overlay").style.display = "block";
  document.getElementById("debug-overlay").innerText =
    `🔴 JS Error: ${e.message}\n@ ${e.filename}:${e.lineno}`;
});

window.addEventListener("unhandledrejection", e => {
  console.error("🔴 Unhandled promise rejection:", e.reason);
  document.getElementById("debug-overlay").style.display = "block";
  document.getElementById("debug-overlay").innerText =
    `🔴 Promise rejection: ${e.reason}`;
});

const debugOverlay = document.createElement("div");
debugOverlay.id = "debug-overlay";
debugOverlay.style.cssText = `
  display: none; position: fixed; top: 0; left: 0; right: 0;
  background: #1a0000; color: #ff6b6b; font-family: monospace;
  font-size: 13px; padding: 20px; z-index: 99999;
  white-space: pre-wrap; border-bottom: 2px solid #ff4444;
`;
document.body.appendChild(debugOverlay);

console.log("🟢 main.jsx executing — mounting React...");

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

console.log("🟢 ReactDOM.createRoot render called");