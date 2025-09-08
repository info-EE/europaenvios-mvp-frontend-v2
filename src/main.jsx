// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Pequeño guard para que no quede pantalla blanca si hay runtime error:
function ErrorBoundary({ children }) {
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    const handler = (e) => {
      console.error("Uncaught error:", e?.error || e);
      setErr(e?.error || e);
    };
    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", handler);
    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", handler);
    };
  }, []);

  if (err) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Ocurrió un error</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {String(err?.message || err)}
        </pre>
        <p>Revisá la consola del navegador (F12) para el stacktrace.</p>
      </div>
    );
  }
  return children;
}

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
