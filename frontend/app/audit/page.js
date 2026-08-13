"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppTop from "@/components/AppTop";
import Icon from "@/components/Icon";
import { api, getToken, BASE } from "@/lib/api";

// หมวดซ้ายแบบ mailbox — prefix ของ action
const CATS = [
  { v: "", t: "ทั้งหมด", icon: "log" },
  { v: "auth", t: "เข้าสู่ระบบ", icon: "users" },
  { v: "bill", t: "ออกบิล", icon: "receipt" },
  { v: "payment", t: "การชำระเงิน", icon: "check" },
  { v: "tenant_user", t: "ผู้เช่า", icon: "users" },
  { v: "device", t: "อุปกรณ์มิเตอร์", icon: "power" },
  { v: "unit", t: "ห้อง", icon: "home" },
  { v: "zones", t: "ตึก", icon: "home" },
  { v: "site", t: "อาคาร", icon: "home" },
  { v: "markets", t: "ตั้งค่าอาคาร", icon: "settings" },
  { v: "units", t: "ตั้งค่าห้อง", icon: "settings" },
];

const LABEL = {
  "auth.login": "เข้าสู่ระบบ",
  "bill.generate": "ออกบิล", "payment.verify": "ยืนยันการชำระ", "payment.reject": "ปฏิเสธการชำระ",
  "tenant_user.create": "เพิ่มผู้เช่า", "tenant_user.delete": "ลบผู้เช่า", "tenant_user.update": "แก้ไขผู้เช่า",
  "unit.create": "เพิ่มห้อง", "zones.create": "เพิ่มตึก", "site.create": "เพิ่มอาคาร",
  "device.assign": "ผูกอุปกรณ์", "device.unassign": "ปลดอุปกรณ์", "device.register": "ลงทะเบียนอุปกรณ์",
  "device.update": "แก้ไขอุปกรณ์", "device.delete": "ลบอุปกรณ์",
  "owner.create": "สร้างเจ้าของ", "owner.update": "แก้ไขเจ้าของ",
  "markets.update": "แก้ตั้งค่าอาคาร", "units.update": "แก้ตั้งค่าห้อง",
};
const actLabel = (a) => LABEL[a] || a;
const roleLabel = (r) => ({ platform_admin: "แอดมิน", owner: "เจ้าของ", tenant_user: "ผู้เช่า", system: "ระบบ" }[r] || r);

// สี/ไอคอนตามหมวด (สไตล์ inbox)
function catStyle(action = "") {
  const p = action.split(".")[0];
  if (p === "auth") return { cls: "bg-primary", icon: "users" };
  if (p === "bill") return { cls: "bg-orange", icon: "receipt" };
  if (p === "payment") return { cls: "bg-success", icon: "check" };
  if (p === "tenant_user") return { cls: "bg-info", icon: "users" };
  if (p === "device") return { cls: "bg-warning", icon: "power" };
  if (["unit", "zones", "site"].includes(p)) return { cls: "bg-primary", icon: "home" };
  return { cls: "bg-danger", icon: "settings" };
}

const fmtTime = (t) => new Date(t).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
const dayKey = (t) => new Date(t).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function AuditPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    if (cat) p.set("action", cat);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [cat, from, to]);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { setRows((await api(`/audit?${qs()}`)).items || []); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [qs]);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
  }, [load, router]);

  async function exportCsv() {
    const res = await fetch(`${BASE}/api/audit?format=csv&${qs()}`, { headers: { Authorization: "Bearer " + getToken() } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // นับต่อหมวด (จากชุดที่โหลดมา) + ค้นหาข้อความฝั่งหน้าเว็บ
  const countOf = (v) => (v ? rows.filter((r) => (r.action || "").startsWith(v + ".")).length : rows.length);
  const shown = rows.filter((r) => {
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return [r.actor_name, r.actor_login, actLabel(r.action), r.target_label, r.market_name, JSON.stringify(r.detail || "")]
      .join(" ").toLowerCase().includes(t);
  });
  // จัดกลุ่มตามวัน (สไตล์ inbox)
  const groups = [];
  for (const r of shown) {
    const k = dayKey(r.at);
    if (!groups.length || groups[groups.length - 1].day !== k) groups.push({ day: k, items: [] });
    groups[groups.length - 1].items.push(r);
  }

  return (
    <AppTop title="บันทึกการใช้งาน" sub="ใคร ทำอะไร เมื่อไร — เรียงล่าสุดก่อน"
      actions={<button className="btn ghost" onClick={exportCsv} disabled={!rows.length}><Icon name="download" /> ส่งออก CSV</button>}>
      {err && <div className="err">{err}</div>}

      <div className="mbx">
        {/* หมวดซ้าย */}
        <div className="mbx-side">
          <div className="mbx-nav">
            <div className="mn-head">หมวดการกระทำ</div>
            {CATS.map((c) => (
              <button key={c.v} className={cat === c.v ? "active" : ""} onClick={() => setCat(c.v)}>
                <Icon name={c.icon} /> {c.t}
                <span className="mn-badge">{countOf(c.v)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* รายการขวา */}
        <div className="card">
          <div className="card-header">
            <div className="ch-title"><Icon name="log" /> {CATS.find((c) => c.v === cat)?.t || "ทั้งหมด"} <span style={{ color: "var(--faint)", fontWeight: 500, fontSize: 12 }}>({shown.length})</span></div>
            <div className="ch-tools">
              <input style={{ width: 190 }} placeholder="ค้นหาในบันทึก…" value={q} onChange={(e) => setQ(e.target.value)} />
              <input type="date" style={{ width: 140 }} value={from} onChange={(e) => setFrom(e.target.value)} title="ตั้งแต่วันที่" />
              <input type="date" style={{ width: 140 }} value={to} onChange={(e) => setTo(e.target.value)} title="ถึงวันที่" />
              <button className="btn primary sm" onClick={load} disabled={loading}>{loading ? <span className="spin" /> : "กรอง"}</button>
            </div>
          </div>

          {shown.length === 0 && !loading && <div className="card empty" style={{ border: "none", boxShadow: "none" }}>ไม่มีบันทึกในช่วง/หมวดที่เลือก</div>}

          {groups.map((g) => (
            <div key={g.day}>
              <div style={{ padding: "8px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{g.day}</div>
              {g.items.map((r) => {
                const st = catStyle(r.action);
                return (
                  <div className="inbox-row" key={r._id}>
                    <div className={"ir-icon " + st.cls}><Icon name={st.icon} /></div>
                    <div className="ir-main">
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                        {actLabel(r.action)}
                        {r.target_label && <span style={{ fontWeight: 500, color: "var(--muted)" }}> — {r.target_label}</span>}
                      </div>
                      <div className="ir-sub">
                        {r.actor_name || r.actor_login || "ระบบ"} · {roleLabel(r.actor_role)}
                        {r.market_name ? ` · ${r.market_name}` : ""}
                        {r.detail ? ` · ${JSON.stringify(r.detail).slice(0, 80)}` : ""}
                      </div>
                    </div>
                    <div className="ir-actions" style={{ color: "var(--faint)", fontSize: 12, whiteSpace: "nowrap" }}>{fmtTime(r.at)}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </AppTop>
  );
}
