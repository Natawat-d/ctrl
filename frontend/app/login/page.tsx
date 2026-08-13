"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/hooks";
import Link from "next/link";
import { loginThunk } from "@/store/authSlice";

const ROLES = [
  { label: "Platform Admin", id: "admin", pw: "admin1234" },
  { label: "เจ้าของอาคาร", id: "arkara@owner", pw: "owner1234" },
  { label: "ผู้เช่า", id: "arkara@a-101", pw: "test1234" },
];

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [loginId, setLoginId] = useState("arkara@owner");
  const [password, setPassword] = useState("owner1234");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("verified") === "1") setNotice("ยืนยันอีเมลเรียบร้อย เข้าสู่ระบบได้เลย");
    else if (q.get("verify") === "invalid") setErr("ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ");
  }, []);

  async function doLogin(id, pw) {
    setErr(""); setBusy(true);
    try {
      const res = await dispatch(loginThunk({ login_id: id, password: pw })).unwrap();
      router.push(res.user.role === "platform_admin" ? "/admin" : res.user.role === "tenant_user" ? "/me" : "/dashboard");
    } catch (e: any) { setErr(typeof e === "string" ? e : e.message); } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo-lg">CT</div>
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
          <Link href="/signup" className="hint" style={{ color: "var(--accent)", fontWeight: 600 }}>สมัครเจ้าของไซต์ →</Link>
        </div>
      </div>
    </div>
  );
}
