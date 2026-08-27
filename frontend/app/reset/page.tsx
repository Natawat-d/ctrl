"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState<any>(null);

  useEffect(() => { if (!token) setErr("ลิงก์ไม่ถูกต้อง — ไม่มี token"); }, [token]);

  async function submit(e) {
    e.preventDefault();
    if (pw.length < 6) { setErr("รหัสผ่านอย่างน้อย 6 ตัว"); return; }
    if (pw !== pw2) { setErr("รหัสผ่านสองช่องไม่ตรงกัน"); return; }
    setErr(""); setBusy(true);
    try {
      const r = await api("/auth/reset", { method: "POST", body: JSON.stringify({ token, password: pw }) });
      setOk(r);
      setTimeout(() => router.push("/login"), 2500);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img className="logo-lg-img" src="/logo.jpg" alt="CTRL" />
        <h2>ตั้งรหัสผ่านใหม่</h2>
        <p className="sub">ตั้งรหัสผ่านใหม่สำหรับบัญชีเจ้าของ</p>

        {ok ? (
          <>
            <div className="ok-msg">{ok.message} ({ok.login_id})</div>
            <div style={{ textAlign: "center", marginTop: 16 }}><Link href="/login" className="btn primary">ไปหน้าเข้าสู่ระบบ</Link></div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="field"><label>รหัสผ่านใหม่</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="อย่างน้อย 6 ตัว" autoFocus disabled={!token} /></div>
            <div className="field"><label>ยืนยันรหัสผ่านใหม่</label><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} disabled={!token} /></div>
            {err && <div className="err">{err}</div>}
            <button className="btn primary block" style={{ marginTop: 6 }} disabled={busy || !token || !pw || !pw2}>{busy ? "..." : "บันทึกรหัสใหม่"}</button>
            <div style={{ textAlign: "center", marginTop: 12 }}><Link href="/login" className="hint">← กลับไปเข้าสู่ระบบ</Link></div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPage() {
  return <Suspense fallback={<div className="auth-wrap"><div className="auth-card">กำลังโหลด…</div></div>}><ResetInner /></Suspense>;
}
