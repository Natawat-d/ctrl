"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/hooks";
import Link from "next/link";
import { loginThunk } from "@/store/authSlice";
import { LoginBlueprint } from "@/components/Blueprint";

const ROLES = [
  { label: "Platform Admin", id: "admin", pw: "admin1234" },
  { label: "เจ้าของอาคาร", id: "arkara@owner", pw: "owner1234" },
  { label: "ผู้เช่า", id: "arkara@a-101", pw: "test1234" },
];

// owner platform is gated: the login form only appears after Alt + 1 · 2 · 3
const SEQ = ["Digit1", "Digit2", "Digit3"];

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [loginId, setLoginId] = useState("arkara@owner");
  const [password, setPassword] = useState("owner1234");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const idx = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // auto-unlock when arriving from the hidden entry on the landing
    try {
      if (sessionStorage.getItem("ctrl_owner") === "1") {
        sessionStorage.removeItem("ctrl_owner");
        setUnlocked(true);
      }
    } catch {}
    const q = new URLSearchParams(window.location.search);
    if (q.get("verified") === "1") setNotice("ยืนยันอีเมลเรียบร้อย เข้าสู่ระบบได้เลย");
    else if (q.get("verify") === "invalid") setErr("ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ");
  }, []);

  // secret combo (Alt held + 1 → 2 → 3, e.code so it is layout-independent) reveals the form
  useEffect(() => {
    if (unlocked) return;
    const reset = () => { idx.current = 0; if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.code === SEQ[idx.current]) {
        e.preventDefault();
        idx.current += 1;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(reset, 1500);
        if (idx.current === SEQ.length) { reset(); setUnlocked(true); }
      } else if (e.code === SEQ[0]) {
        idx.current = 1;
      } else {
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (timer.current) clearTimeout(timer.current); };
  }, [unlocked]);

  async function doLogin(id, pw) {
    setErr(""); setBusy(true);
    try {
      const res = await dispatch(loginThunk({ login_id: id, password: pw })).unwrap();
      router.push(res.user.role === "platform_admin" ? "/admin" : res.user.role === "tenant_user" ? "/me" : "/dashboard");
    } catch (e: any) { setErr(typeof e === "string" ? e : e.message); } finally { setBusy(false); }
  }

  // locked state — minimal, non-revealing (no form, no combo hint)
  if (!unlocked) {
    return (
      <div className="login-locked">
        <img className="ll-logo logo-invert" src="/logo.png" alt="CTRL" />
        <div className="ll-msg">แพลตฟอร์มสำหรับเจ้าของอาคาร</div>
        <div className="ll-sub">เข้าถึงเฉพาะผู้ได้รับสิทธิ์</div>
        <Link href="/" className="ll-back">← กลับหน้าแรก</Link>
      </div>
    );
  }

  return (
    <div className="login-split">
      <aside className="login-hero">
        <LoginBlueprint />
        <div className="lh-top">
          <img className="lh-logo" src="/logo.png" alt="CTRL" />
        </div>
        <div className="lh-body">
          <div className="lh-eyebrow">Water · Electric · Billing</div>
          <h1>มอนิเตอร์น้ำ-ไฟ<br />รายห้อง แบบเรียลไทม์</h1>
          <p>CTRL รวมมิเตอร์น้ำและไฟของทุกห้องไว้ที่เดียว อ่านค่าอัตโนมัติ ออกบิลรายเดือน และตรวจสอบย้อนหลังได้ทั้งระบบ</p>
        </div>
        <div className="lh-meta">
          <div>
            <div className="m-k">มิเตอร์</div>
            <div className="m-v">Real-time</div>
          </div>
          <div>
            <div className="m-k">บิล</div>
            <div className="m-v">อัตโนมัติ</div>
          </div>
          <div>
            <div className="lh-dot"><span className="e" /> ไฟฟ้า</div>
            <div className="lh-dot"><span className="w" /> น้ำประปา</div>
          </div>
        </div>
      </aside>
      <div className="login-form-side">
      <div className="auth-card">
        <img className="logo-lg-img" src="/logo.png" alt="CTRL" />
        <h2>เข้าสู่ระบบ</h2>
        <p className="sub">CTRL — มอนิเตอร์น้ำ-ไฟ และบิลรายเดือน</p>
        {notice && <div className="ok-msg">{notice}</div>}

        <div className="hint" style={{ fontWeight: 600, color: "var(--muted)" }}>เข้าดูแบบ demo (คลิกได้เลย)</div>
        <div className="role-btns">
          {ROLES.map((r) => (
            <div key={r.id} className="role-btn" onClick={() => !busy && doLogin(r.id, r.pw)}>{r.label}</div>
          ))}
        </div>

        <div className="divider">หรือกรอกเอง</div>
        <form onSubmit={(e) => { e.preventDefault(); doLogin(loginId, password); }}>
          <div className="field"><label>ไอดีเข้าระบบ (Login ID)</label><input value={loginId} onChange={(e) => setLoginId(e.target.value)} /></div>
          <div className="field"><label>รหัสผ่าน</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {err && <div className="err">{err}</div>}
          <button className="btn primary block" style={{ marginTop: 6 }} disabled={busy}>{busy ? "..." : "เข้าสู่ระบบ"}</button>
        </form>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <Link href="/forgot" className="hint" style={{ color: "var(--muted)" }}>ลืมรหัสผ่าน?</Link>
        </div>
        <div style={{ textAlign: "center", marginTop: 10, display: "flex", justifyContent: "space-between" }}>
          <Link href="/" className="hint">← หน้าแรก</Link>
          <Link href="/signup" className="hint signup-link" style={{ color: "var(--ink)", fontWeight: 700 }}>สมัครเจ้าของไซต์ →</Link>
        </div>
      </div>
      </div>
    </div>
  );
}
