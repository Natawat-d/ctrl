"use client";

import { useEffect, useState } from "react";

// Tiny global toast bus: call toast("บันทึกแล้ว") from anywhere; <Toaster/>
// (mounted once in AppTop) animates it in/out. No store wiring needed.
export function toast(message, type = "ok") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("akr:toast", { detail: { message, type, id: Date.now() + Math.random() } }));
}

export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    function onToast(e) {
      const t = e.detail;
      setItems((arr) => [...arr, t]);
      setTimeout(() => setItems((arr) => arr.filter((x) => x.id !== t.id)), 2400);
    }
    window.addEventListener("akr:toast", onToast);
    return () => window.removeEventListener("akr:toast", onToast);
  }, []);

  return (
    <div className="toast-wrap" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className="tick">{t.type === "err" ? "✕" : "✓"}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
