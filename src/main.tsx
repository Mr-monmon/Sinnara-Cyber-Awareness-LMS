import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { supabaseConfigured } from "./lib/supabase.ts";
import "./i18n";
import "./index.css";
import "quill/dist/quill.snow.css";

const root = document.getElementById("root")!;

if (!supabaseConfigured) {
  root.innerHTML = `
    <div style="min-height:100vh;background:#12140a;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;">
      <div style="max-width:480px;width:100%;background:#1a1e0e;border:1px solid rgba(255,255,255,0.09);border-radius:16px;padding:32px;">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.25);display:flex;align-items:center;justify-content:center;margin-bottom:20px;font-size:24px;">⚙️</div>
        <h1 style="font-size:20px;font-weight:900;margin:0 0 8px;">Configuration Required</h1>
        <p style="font-size:14px;color:#94a3b8;margin:0 0 20px;line-height:1.6;">
          Missing Supabase environment variables. Create a <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-size:12px;">.env</code> file in the project root with:
        </p>
        <pre style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.09);border-radius:8px;padding:14px;font-size:12px;color:#c8ff00;margin:0;overflow:auto;">VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-key</pre>
      </div>
    </div>`;
} else {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}
