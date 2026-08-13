"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function SignupPage() {
  const [form, setForm] = useState({ display_name: "", email: "", password: "", site_name: "", site_type: "condo", accept_terms: false });
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await api("/auth/signup", { method: "POST", body: JSON.stringify(form) });
      setDone(r);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="logo-lg">✅</div>
          <h2>สมัครสำเร็จ</h2>
          <p className="sub">เราส่งลิงก์ยืนยันไปที่ <strong>{form.email}</strong> แล้ว</p>
          {done.verify_url && (
            <div className="ok-msg" style={{ textAlign: "left", wordBreak: "break-all" }}>
              โหมดทดสอบ (ยังไม่ตั้ง SMTP) — คลิกยืนยันได้เลย:<br />
              <a href={done.verify_url} style={{ color: "var(--accent)", fontWeight: 600 }}>ยืนยันอีเมลตอนนี้ →</a>
            </div>
          )}
          <Link className="btn primary block" href="/login" style={{ marginTop: 12 }}>ไปหน้าเข้าสู่ระบบ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo-lg">⚡</div>
        <h2>สมัครเจ้าของไซต์</h2>
        <p className="sub">หอพัก · อพาร์ตเมนต์ · คอนโด</p>
        <form onSubmit={submit}>
          <div className="field"><label>ชื่ออาคาร/หอพัก</label><input value={form.site_name} onChange={(e) => set("site_name", e.target.value)} placeholder="เช่น หอพักอารการ่า" required /></div>
          <div className="field">
            <label>ประเภท</label>
            <select value={form.site_type} onChange={(e) => set("site_type", e.target.value)}>
                            <option value="condo">คอนโด / ห้องเช่า (อาคาร-ชั้น-ห้อง)</option>
            </select>
          </div>
          <div className="field"><label>ชื่อผู้ดูแล</label><input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder="ชื่อของคุณ" /></div>
          <div className="field"><label>อีเมล (ใช้เข้าสู่ระบบ)</label><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></div>
          <div className="field"><label>รหัสผ่าน</label><input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="อย่างน้อย 6 ตัว" required /></div>
          <label className="terms-row">
            <input type="checkbox" checked={form.accept_terms} onChange={(e) => set("accept_terms", e.target.checked)} />
            <span>ฉันยอมรับ <Link href="/terms" target="_blank" style={{ color: "var(--accent)" }}>เงื่อนไขการใช้งาน</Link></span>
          </label>
          {err && <div className="err">{err}</div>}
          <button className="btn primary block" style={{ marginTop: 6 }} disabled={busy || !form.accept_terms}>{busy ? "..." : "สมัครและสร้างไซต์"}</button>
        </form>
        <div style={{ textAlign: "center", marginTop: 12 }}><Link href="/login" className="hint">มีบัญชีแล้ว? เข้าสู่ระบบ</Link></div>
      </div>
    </div>
  );
}
