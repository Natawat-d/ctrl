"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPage() {
  const [loginId, setLoginId] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null); // { message, dev_link? }
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await api("/auth/forgot", { method: "POST", body: JSON.stringify({ login_id: loginId.trim() }) });
      setDone(r);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo-lg">CT</div>
        <h2>ลืมรหัสผ่าน</h2>
        <p className="sub">กรอกอีเมลหรือไอดีเข้าระบบของเจ้าของ ระบบจะส่งลิงก์ตั้งรหัสใหม่ไปที่อีเมล</p>

        {done ? (
          <>
            <div className="ok-msg">{done.message}</div>
            {done.dev_link && (
              <div className="hint" style={{ marginTop: 12 }}>
                โหมดทดสอบ (ยังไม่ตั้งอีเมลจริง) — เปิดลิงก์นี้เพื่อตั้งรหัสใหม่ได้เลย:
                <div style={{ marginTop: 6 }}>
                  <a href={done.dev_link} style={{ color: "var(--primary)", wordBreak: "break-all", fontSize: 12.5 }}>{done.dev_link}</a>
                </div>
              </div>
            )}
            <div style={{ textAlign: "center", marginTop: 16 }}><Link href="/login" className="hint">← กลับไปเข้าสู่ระบบ</Link></div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="field"><label>อีเมล หรือ ไอดีเข้าระบบ</label><input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="เช่น owner@example.com หรือ arkara@owner" autoFocus /></div>
            {err && <div className="err">{err}</div>}
            <button className="btn primary block" style={{ marginTop: 6 }} disabled={busy || !loginId.trim()}>{busy ? "..." : "ส่งลิงก์ตั้งรหัสใหม่"}</button>
            <div style={{ textAlign: "center", marginTop: 12 }}><Link href="/login" className="hint">← กลับไปเข้าสู่ระบบ</Link></div>
          </form>
        )}
      </div>
    </div>
  );
}
