import { useEffect } from "react";
import { app } from "../state/app";
import { useStore } from "../state/store";

export function Toast() {
  const toast = useStore(app, (s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => app.patch({ toast: null }), 3200);
    return () => clearTimeout(id);
  }, [toast]);
  return (
    <div className={`toast ${toast ? "on" : ""}`} role="status" aria-live="polite">
      {toast}
    </div>
  );
}
