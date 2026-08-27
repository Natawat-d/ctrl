"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import AppTop from "@/components/AppTop";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { api, getToken } from "@/lib/api";
import { planLabel } from "@/lib/labels";
import { selectUser } from "@/store/authSlice";
import type { Json, Tenant, Market, User } from "@/models/types";

// รูปร่างที่ /admin/overview ส่งกลับ — 1 ไซต์ = tenant + อาคาร/เจ้าของ/จำนวนห้อง-ผู้เช่า
type OverviewSite = Json<Tenant> & {
  markets: Json<Market>[];
  owners: Json<User>[];
  unit_count: number;
  tenant_count: number;
};
type OverviewTotals = { tenants?: number; markets?: number; units?: number; users?: number };

function Stat({ k, v }) {
  return <div className="card stat"><div><div className="k">{k}</div><div className="v">{v}</div></div></div>;
}

const ago = (ts) => {
  if (!ts) return "ยังไม่มีข้อมูล";
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 5) return "เมื่อกี้นี้";
  if (s < 60) return `${s} วินาทีที่แล้ว`;
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
};

export default function AdminPage() {
  const router = useRouter();
  const user = useSelector(selectUser);
  const [data, setData] = useState<{ items: OverviewSite[]; totals: OverviewTotals }>({ items: [], totals: {} });
  const [health, setHealth] = useState<any>(null);
  const [form, setForm] = useState({ site_name: "", site_type: "condo", display_name: "", email: "", password: "" });
  const [err, setErr] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const [pwFor, setPwFor] = useState<any>(null); const [newPw, setNewPw] = useState(""); const [pwBusy, setPwBusy] = useState(false); const [copied, setCopied] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setData(await api("/admin/overview"));
  }, []);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load().catch((e) => setErr(e.message));
  }, [load, router]);

  // redirect non-admins once auth state is known (avoids racing Redux hydrate)
  useEffect(() => { if (user && user.role !== "platform_admin") router.push("/dashboard"); }, [user, router]);

  // poll system health every 5s
  useEffect(() => {
    if (!getToken()) return;
    let timer;
    const tick = async () => { try { setHealth(await api("/admin/health")); } catch {} };
    tick();
    timer = setInterval(tick, 5000);
    return () => clearInterval(timer);
  }, []);

  const flash = (m) => toast(m); // animated save confirmation

  async function createOwner(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api("/admin/owners", { method: "POST", body: JSON.stringify(form) });
      flash(`สร้างไซต์ ${form.site_name} แล้ว`);
      setForm({ site_name: "", site_type: "condo", display_name: "", email: "", password: "" });
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function patchOwner(id, body, label) {
    await api(`/admin/owners/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    flash(label); await load();
  }
  function openPw(o) { setPwFor(o); setNewPw(""); setCopied(false); }
  function genPw() {
    const c = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let p = ""; for (let i = 0; i < 10; i++) p += c[Math.floor(Math.random() * c.length)];
    setNewPw(p); setCopied(false);
  }
  async function savePw() {
    if (newPw.length < 6) { setErr("รหัสผ่านอย่างน้อย 6 ตัว"); return; }
    setPwBusy(true); setErr("");
    try {
      await api(`/admin/owners/${pwFor._id}`, { method: "PATCH", body: JSON.stringify({ password: newPw }) });
      flash(`ตั้งรหัสผ่านใหม่ให้ ${pwFor.email || pwFor.login_id} แล้ว`);
      setPwFor(null);
    } catch (e: any) { setErr(e.message); } finally { setPwBusy(false); }
  }
  function copyPw() { try { navigator.clipboard.writeText(newPw); setCopied(true); } catch {} }

  const t: OverviewTotals = data.totals || {};
  return (
    <AppTop title="ผู้ดูแลระบบ" sub="ภาพรวมทุกไซต์ในแพลตฟอร์ม">
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok-msg" style={{ position: "sticky", top: 0, zIndex: 5 }}>{msg}</div>}

      <div className="section-h" style={{ marginTop: 0 }}>สถานะระบบเรียลไทม์ <span style={{ fontWeight: 500, fontSize: 12, color: "var(--faint)" }}>REST ingest · อัปเดตทุก 5 วินาที</span></div>
      <div className="card pad" style={{ marginBottom: 18 }}>
        {!health ? <span className="hint">กำลังโหลด…</span> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(185px,1fr))", gap: 12 }}>
            <div className="hcell">
              <div className="hk">ช่องรับข้อมูล (REST /api/ingest)</div>
              <div className={`dot ${health.ingest.msgs_last_min > 0 ? "on" : "off"}`} style={{ fontSize: 15, fontWeight: 800, margin: "3px 0" }}>{health.ingest.msgs_last_min > 0 ? "มีข้อมูลเข้า" : "ไม่มีข้อมูลเข้า"}</div>
              <div className="hs">POST /api/ingest</div>
            </div>
            <div className="hcell">
              <div className="hk">อัตราข้อมูล (data rate)</div>
              <div className="hv">{health.ingest.rate_per_sec} <span className="hu">ข้อความ/วิ</span></div>
              <div className="hs">{health.ingest.msgs_last_min.toLocaleString()} ข้อความ/นาที · รวม {health.ingest.total_ingested.toLocaleString()}</div>
            </div>
            <div className="hcell">
              <div className="hk">อุปกรณ์ออนไลน์</div>
              <div className="hv">{health.devices.online}<span className="hu">/{health.devices.total}</span></div>
              <div className="hs">ออฟไลน์ {health.devices.offline} เครื่อง</div>
            </div>
            <div className="hcell">
              <div className="hk">ข้อมูลล่าสุดที่รับ</div>
              <div className="hv" style={{ fontSize: 16 }}>{ago(health.ingest.last_ingest)}</div>
              <div className="hs">รับล่าสุด</div>
            </div>
          </div>
        )}
      </div>

      <div className="stats">
        <Stat k="ไซต์ทั้งหมด" v={t.tenants ?? "-"} />
        <Stat k="อาคาร" v={t.markets ?? "-"} />
        <Stat k="ห้อง" v={t.units ?? "-"} />
        <Stat k="ผู้ใช้ทั้งหมด" v={t.users ?? "-"} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,360px) 1fr", alignItems: "start", gap: 22, marginTop: 6 }}>
        <div className="card pad">
          <div className="section-h" style={{ margin: "0 0 12px" }}>สร้างเจ้าของไซต์</div>
          <form onSubmit={createOwner}>
            <div className="field"><label>ชื่อไซต์</label><input value={form.site_name} onChange={(e) => set("site_name", e.target.value)} required /></div>
            <div className="field"><label>ประเภท</label>
              <select value={form.site_type} onChange={(e) => set("site_type", e.target.value)}>
                                <option value="condo">คอนโด/ห้องเช่า</option>
              </select>
            </div>
            <div className="field"><label>ชื่อผู้ดูแล</label><input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} /></div>
            <div className="field"><label>อีเมล (login)</label><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></div>
            <div className="field"><label>รหัสผ่าน</label><input value={form.password} onChange={(e) => set("password", e.target.value)} required /></div>
            <button className="btn primary block" style={{ marginTop: 6 }} disabled={busy}><Icon name="plus" /> สร้างไซต์ + เจ้าของ</button>
          </form>
        </div>

        <div>
          <div className="section-h" style={{ margin: "0 0 12px" }}>ไซต์ทั้งหมด ({data.items.length})</div>
          <div style={{ display: "grid", gap: 10 }}>
            {data.items.map((s) => {
              const o = s.owners?.[0];
              const suspended = s.status === "suspended";
              return (
                <div className="card pad" key={s._id}>
                  <div className="row-between">
                    <div>
                      <strong style={{ fontSize: 15 }}>{s.name}</strong>
                      <span className="pill" style={{ marginLeft: 8, background: "var(--surface-2)", color: "var(--muted)" }}>{planLabel(s.plan || "free")}</span>
                      {suspended && <span className="pill cutoff" style={{ marginLeft: 6 }}>ระงับ</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn ghost sm" onClick={() => openPw(o)} disabled={!o}>เปลี่ยนรหัส</button>
                      {suspended
                        ? <button className="btn ghost sm" onClick={() => patchOwner(o._id, { status: "active" }, "เปิดใช้งานแล้ว")} disabled={!o}>เปิดใช้</button>
                        : <button className="btn ghost sm" onClick={() => patchOwner(o._id, { status: "suspended" }, "ระงับแล้ว")} disabled={!o}>ระงับ</button>}
                    </div>
                  </div>
                  <div className="row-sub" style={{ marginTop: 6 }}>
                    {o ? <>เจ้าของ: {o.display_name} {o.verified === false && <span style={{ color: "var(--accent)" }}>· ยังไม่ยืนยัน</span>}</> : "— ไม่มีเจ้าของ —"}
                  </div>
                  {o && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 8, fontSize: 12.5, alignItems: "center" }}>
                      <span style={{ color: "var(--muted)" }}>ไอดี: <strong style={{ fontFamily: "ui-monospace, monospace" }}>{o.login_id}</strong>
                        <button className="btn ghost sm" style={{ marginLeft: 4, padding: "1px 6px" }} title="คัดลอกไอดี" onClick={() => { try { navigator.clipboard.writeText(o.login_id); flash("คัดลอกไอดีแล้ว"); } catch {} }}>คัดลอก</button>
                      </span>
                      {o.email && <span style={{ color: "var(--faint)" }}>{o.email}</span>}
                    </div>
                  )}
                  <div className="admin-tags">
                    {(s.markets || []).map((m) => (
                      <span key={m._id} className="tag-chip">{m.type === "condo" ? "🏢" : "🏪"} {m.name}</span>
                    ))}
                    <span className="tag-chip ghost">{s.unit_count} ห้อง</span>
                    <span className="tag-chip ghost">{s.tenant_count} ผู้เช่า</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {pwFor && (
        <div className="modal-bg" onClick={() => setPwFor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>เปลี่ยนรหัสผ่านเจ้าของ</h3>
            <div className="m-sub">{pwFor.email || pwFor.login_id}</div>
            <label>รหัสผ่านใหม่</label>
            <div className="pw-field">
              <input value={newPw} onChange={(e) => { setNewPw(e.target.value); setCopied(false); }} placeholder="อย่างน้อย 6 ตัว" autoFocus />
              <button type="button" className="btn ghost sm" onClick={genPw}>สุ่ม</button>
            </div>
            <div className="hint" style={{ marginTop: 8 }}>
              ตั้งรหัสแล้วคัดลอกไปให้ลูกค้าได้เลย {newPw && <button type="button" className="btn ghost sm" style={{ marginLeft: 6 }} onClick={copyPw}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}</button>}
            </div>
            <div className="m-actions">
              <button className="btn ghost" onClick={() => setPwFor(null)}>ยกเลิก</button>
              <button className="btn primary" onClick={savePw} disabled={pwBusy || newPw.length < 6}>{pwBusy ? <span className="spin" /> : "บันทึกรหัสใหม่"}</button>
            </div>
          </div>
        </div>
      )}
    </AppTop>
  );
}
