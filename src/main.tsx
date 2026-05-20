import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./lib/sentry"; // Must be first — initialises Sentry before any other code runs
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { supabaseConfigured } from "./lib/supabase.ts";
import "./i18n";
import "./index.css";
import "quill/dist/quill.snow.css";

const root = document.getElementById("root");

function renderConfigError() {
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;background:#12140a;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;">
      <div style="max-width:480px;width:100%;background:#1a1e0e;border:1px solid rgba(255,255,255,0.09);border-radius:16px;padding:32px;">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.25);display:flex;align-items:center;justify-content:center;margin-bottom:20px;font-size:24px;">!</div>
        <h1 style="font-size:20px;font-weight:900;margin:0 0 8px;">Application configuration error</h1>
        <p style="font-size:14px;color:#94a3b8;margin:0 0 8px;line-height:1.6;">
          Please check the deployment environment variables.
        </p>
        <p style="font-size:12px;color:#64748b;margin:0;line-height:1.6;">
          If you are the administrator, verify that the required configuration values are set in the deployment environment.
        </p>
      </div>
    </div>`;
}

function bootstrap() {
  if (!root) return;

  if (!supabaseConfigured) {
    renderConfigError();
    return;
  }

  try {
    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
  } catch (error) {
    console.error("[Sinnara] Fatal startup error:", error);
    renderConfigError();
  }
}

bootstrap();
