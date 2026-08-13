"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppTop from "@/components/AppTop";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { api, getToken } from "@/lib/api";
import { useActiveMarket } from "@/store/hooks";

const maskNid = (n) => (n && n.length === 13 ? `${n[0]}-${n.slice(1, 5)}-${n.slice(5, 10)}-${n.slice(10, 12)}-${n[12]}` : n || "");
const AV_COLORS = ["#0d6efd", "#198754", "#fd7e14", "#6f42c1", "#d63384", "#17a2b8", "#dc3545"];
const avColor = (s) => AV_COLORS[[...String(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];

const EMPTY = { unit_id: "", login_id: "", password: "", first_name: "", last_name: "", national_id: "", phone: "", email: "", line_id: "" };

export default function TenantsPage() {
  const router = useRouter();
  const market = useActiveMarket();
  const [units, setUnits] = useState([]);
  const [zones, setZones] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [q, setQ] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [showPw, setShowPw] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (market) {
      setUnits((await api(`/units?market_id=${market._id}`)).items || []);
      setZones((await api(`/zones?market_id=${market._id}`)).items || []);
    }
    setUsers((await api("/users")).items || []);
  }, [market]);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load().catch((e) => setErr(e.message));
  }, [load, router]);

  // slug ของที่พัก = prefix บังคับของไอดีผู้เช่า (ID = "ชื่อที่พัก@xxxx") · backend enforce ซ้ำอีกชั้น
  const siteSlug = (market?.slug || "site").toLowerCase();
  function pickUnit(unit_id) {
    const u = units.find((x) => x._id === unit_id);
    setForm((f) => ({ ...f, unit_id, login_id: u ? u.code.toLowerCase() : f.login_id })); // เก็บเฉพาะส่วนหลัง @
  }

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const created = await api("/users", { method: "POST", body: JSON.stringify({ ...form, login_id: `${siteSlug}@${form.login_id}` }) });
      toast(`สร้างบัญชี ${created.login_id} แล้ว`);
      setForm(EMPTY); setAddOpen(false);
      await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function resetPw(u) {
    const pw = prompt(`ตั้งรหัสผ่านใหม่ให้ ${u.login_id}:`, "");
    if (!pw) return;
    await api(`/users/${u._id}`, { method: "PATCH", body: JSON.stringify({ password: pw }) });
    toast("รีเซ็ตรหัสผ่านแล้ว");
    await load();
  }
  async function remove(id) {
    if (!confirm("ลบผู้เช่านี้ และปลดออกจากห้อง?")) return;
    await api(`/users/${id}`, { method: "DELETE" });
    toast("ลบผู้เช่าแล้ว");
    await load();
  }

  const unitById = Object.fromEntries(units.map((u) => [String(u._id), u]));
  const unitCode = (id) => unitById[String(id)]?.code || "";
  const userZone = (u) => String(unitById[String((u.unit_ids || [])[0])]?.zone_id || "");
  const taken = new Set(users.flatMap((u) => (u.unit_ids || []).map(String)));
  const vacant = units.filter((u) => !taken.has(String(u._id)));

  const shown = users.filter((u) => {
    if (zoneId && userZone(u) !== String(zoneId)) return false;
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return [u.display_name, u.first_name, u.last_name, u.login_id, u.national_id, u.phone, u.email, (u.unit_ids || []).map(unitCode).join(" ")]
      .join(" ").toLowerCase().includes(t);
  });
  const countZone = (zid) => users.filter((u) => (zid ? userZone(u) === String(zid) : true)).length;

  return (
    <AppTop title="ผู้เช่า" sub="ทะเบียนผู้เช่า: ชื่อจริง-นามสกุล บัตรประชาชน เบอร์โทร อีเมล ผูกกับห้อง">
      {err && <div className="err">{err}</div>}

      {/* info boxes */}
      <div className="info-boxes">
        <div className="info-box"><div className="ib-icon bg-primary"><Icon name="users" /></div><div className="ib-content"><div className="ib-text">ผู้เช่าทั้งหมด</div><div className="ib-number">{users.length}</div></div></div>
        <div className="info-box"><div className="ib-icon bg-success"><Icon name="home" /></div><div className="ib-content"><div className="ib-text">ห้องมีผู้เช่า</div><div className="ib-number">{taken.size}<span className="ib-unit"> / {units.length}</span></div></div></div>
        <div className="info-box"><div className="ib-icon bg-warning"><Icon name="grid" /></div><div className="ib-content"><div className="ib-text">ห้องว่าง</div><div className="ib-number">{vacant.length}</div></div></div>
        <div className="info-box"><div className="ib-icon bg-info"><Icon name="check" /></div><div className="ib-content"><div className="ib-text">มีบัตรประชาชนครบ</div><div className="ib-number">{users.filter((u) => u.national_id?.length === 13).length}<span className="ib-unit"> / {users.length}</span></div></div></div>
      </div>

      <div className="mbx">
        {/* left rail */}
        <div className="mbx-side">
          <button className="btn primary block compose" onClick={() => { setForm(EMPTY); setErr(""); setAddOpen(true); }}><Icon name="plus" /> เพิ่มผู้เช่า</button>
          <div className="mbx-nav">
            <div className="mn-head">กรองตามอาคาร</div>
            <button className={!zoneId ? "active" : ""} onClick={() => setZoneId("")}>
              <Icon name="users" /> ทั้งหมด <span className="mn-badge">{users.length}</span>
            </button>
            {zones.map((z) => (
              <button key={z._id} className={String(zoneId) === String(z._id) ? "active" : ""} onClick={() => setZoneId(z._id)}>
                <Icon name="home" /> {z.name} <span className="mn-badge">{countZone(z._id)}</span>
              </button>
            ))}
          </div>
          {vacant.length > 0 && (
            <div className="mbx-nav" style={{ marginTop: 12 }}>
              <div className="mn-head">ห้องว่าง ({vacant.length})</div>
              {vacant.slice(0, 6).map((u) => (
                <button key={u._id} onClick={() => { setForm({ ...EMPTY }); setErr(""); setAddOpen(true); setTimeout(() => pickUnit(u._id), 0); }}>
                  <Icon name="plus" /> {u.code} <span className="mn-badge">เพิ่มผู้เช่า</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* contact list */}
        <div className="card">
          <div className="card-header">
            <div className="ch-title"><Icon name="users" /> {zoneId ? zones.find((z) => String(z._id) === String(zoneId))?.name : "ทะเบียนผู้เช่า"} <span style={{ color: "var(--faint)", fontWeight: 500, fontSize: 12 }}>({shown.length})</span></div>
            <div className="ch-tools">
              <input style={{ width: 250 }} placeholder="ค้นหา ชื่อ / ห้อง / บัตร / เบอร์…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          <div className="list-colhead">
            <span style={{ width: 38 }} />
            <span className="c-name" style={{ flex: 1.3 }}>ผู้เช่า</span>
            <span className="c-room" style={{ width: 74 }}>ห้อง</span>
            <span className="c-nid" style={{ width: 148 }}>บัตรประชาชน</span>
            <span className="c-phone" style={{ width: 108 }}>เบอร์โทร</span>
            <span className="c-mail" style={{ flex: 1 }}>อีเมล</span>
            <span className="c-pass" style={{ width: 168 }}>รหัสผ่าน</span>
            <span style={{ width: 66 }} />
          </div>

          {shown.length === 0 && <div className="card empty" style={{ border: "none", boxShadow: "none" }}>ไม่พบผู้เช่าตามที่กรอง/ค้นหา</div>}

          {shown.map((u) => {
            const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.display_name;
            return (
              <div className="contact-row" key={u._id}>
                <div className="av-circle" style={{ background: avColor(name) }}>{(u.first_name || name || "?").slice(0, 1)}</div>
                <div className="c-name">
                  <div className="nm">{name}</div>
                  <div className="sub">{u.login_id}{u.line_id ? " · LINE ✓" : ""}</div>
                </div>
                <div className="c-room">{(u.unit_ids || []).length ? <span className="room-chip">{(u.unit_ids || []).map(unitCode).join(", ")}</span> : <span style={{ color: "var(--faint)", fontSize: 12 }}>—</span>}</div>
                <div className="c-col c-nid">{u.national_id ? maskNid(u.national_id) : "—"}</div>
                <div className="c-col c-phone">{u.phone || "—"}</div>
                <div className="c-col c-mail">{u.email || "—"}</div>
                <div className="c-pass">
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{u.password_plain ? (showPw[u._id] ? u.password_plain : "••••••") : "—"}</span>
                  {u.password_plain && <button className="btn ghost sm" onClick={() => setShowPw((m) => ({ ...m, [u._id]: !m[u._id] }))}>{showPw[u._id] ? "ซ่อน" : "ดู"}</button>}
                  <button className="btn ghost sm" onClick={() => resetPw(u)} title="ตั้งรหัสใหม่">รีเซ็ต</button>
                </div>
                <div className="c-actions">
                  <button className="btn ghost sm" onClick={() => remove(u._id)} title="ลบผู้เช่า"><Icon name="trash" /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* modal: เพิ่มผู้เช่า */}
      {addOpen && (
        <div className="modal-bg" onClick={() => setAddOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3>เพิ่มผู้เช่า</h3>
            <div className="m-sub">กรอกข้อมูลตัวตนให้ครบ ใช้ทำสัญญาและออกบิล</div>
            <form onSubmit={submit}>
              <div className="field">
                <label>ห้อง</label>
                <select value={form.unit_id} onChange={(e) => pickUnit(e.target.value)} autoFocus>
                  <option value="">— เลือกห้อง —</option>
                  {units.map((u) => (
                    <option key={u._id} value={u._id} disabled={taken.has(String(u._id))}>
                      {u.code} · {u.name} {taken.has(String(u._id)) ? "(มีผู้เช่าแล้ว)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row-2">
                <div className="field"><label>ชื่อจริง</label><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="เช่น สมชาย" required /></div>
                <div className="field"><label>นามสกุล</label><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="เช่น ใจดี" required /></div>
              </div>
              <div className="field">
                <label>เลขบัตรประชาชน (13 หลัก)</label>
                <input inputMode="numeric" maxLength={13} value={form.national_id}
                  onChange={(e) => setForm({ ...form, national_id: e.target.value.replace(/[^0-9]/g, "") })} placeholder="เช่น 1103700123456" />
                {form.national_id && form.national_id.length !== 13 && <div className="hint" style={{ color: "var(--danger-ink)" }}>ต้องมี 13 หลัก (ตอนนี้ {form.national_id.length})</div>}
              </div>
              <div className="row-2">
                <div className="field"><label>เบอร์โทรศัพท์</label><input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08x-xxx-xxxx" /></div>
                <div className="field"><label>อีเมล</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ไม่บังคับ" /></div>
              </div>
              <div className="row-2">
                <div className="field"><label>ไอดีเข้าระบบ</label>
                  <div style={{ display: "flex", alignItems: "stretch" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "0 10px", background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRight: "none", borderRadius: "6px 0 0 6px", color: "var(--muted)", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>{siteSlug}@</span>
                    <input style={{ borderRadius: "0 6px 6px 0" }} value={form.login_id} onChange={(e) => setForm({ ...form, login_id: e.target.value.replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase() })} placeholder="เช่น a-101" />
                  </div>
                </div>
                <div className="field"><label>รหัสผ่าน</label><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="ตั้งรหัสให้ผู้เช่า" /></div>
              </div>
              <div className="field"><label>LINE userId (แจ้งเตือน)</label><input value={form.line_id} onChange={(e) => setForm({ ...form, line_id: e.target.value })} placeholder="ไม่บังคับ" /></div>
              {err && <div className="err">{err}</div>}
              <div className="m-actions">
                <button type="button" className="btn ghost" onClick={() => setAddOpen(false)}>ยกเลิก</button>
                <button className="btn primary"
                  disabled={busy || !form.unit_id || !form.password || !form.first_name || (form.national_id && form.national_id.length !== 13)}>
                  {busy ? <span className="spin" /> : <Icon name="plus" />} สร้างบัญชีผู้เช่า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppTop>
  );
}
