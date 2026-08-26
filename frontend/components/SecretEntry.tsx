"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

// Hidden owner-platform entrance. Reveal by pressing Alt+1, Alt+2, Alt+3 in order
// (uses e.code so it is keyboard-layout independent). Esc / backdrop closes it.
const SEQ = ["Digit1", "Digit2", "Digit3"];

export default function SecretEntry() {
  const [open, setOpen] = useState(false);
  const idx = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  // /login gates itself with the same combo — don't also pop this modal there
  const disabled = !!pathname && pathname.startsWith("/login");

  useEffect(() => {
    if (disabled) return;
    const reset = () => {
      idx.current = 0;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (!e.altKey) return;
      if (e.code === SEQ[idx.current]) {
        e.preventDefault();
        idx.current += 1;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(reset, 1500); // sequence must complete within 1.5s between keys
        if (idx.current === SEQ.length) { reset(); setOpen(true); }
      } else if (e.code === SEQ[0]) {
        idx.current = 1; // restart from the first key
      } else {
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [disabled]);

  if (disabled || !open) return null;
  const goOwner = () => {
    try { sessionStorage.setItem("ctrl_owner", "1"); } catch {}
    setOpen(false);
  };
  return (
    <div className="secret-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
      <div className="secret-card" onClick={(e) => e.stopPropagation()}>
        <span className="secret-kbd">Alt + 1 · 2 · 3</span>
        <h3>แพลตฟอร์มเจ้าของอาคาร</h3>
        <p>ทางเข้าระบบจัดการสำหรับเจ้าของ / ผู้ดูแลอาคาร</p>
        <Link href="/login" className="btn primary on-dark secret-go" onClick={goOwner}>
          เข้าสู่ระบบเจ้าของ <span className="uni-arrow">→</span>
        </Link>
        <button className="secret-close" onClick={() => setOpen(false)}>ปิด (Esc)</button>
      </div>
    </div>
  );
}
