"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppTop from "@/components/AppTop";
import Icon from "@/components/Icon";
import { api, getToken, BASE } from "@/lib/api";
import { billStatus } from "@/lib/labels";
import { useActiveMarket } from "@/store/hooks";
import type { Json, Zone, Unit } from "@/models/types";

const money = (n) => "฿" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const num = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const thisCycle = () => new Date().toISOString().slice(0, 7);

function KPI({ icon, cls, k, v, sub = "" }) {
  return (
    <div className="card stat">
      <div className={"ico " + cls}><Icon name={icon} /></div>
      <div>
        <div className="k">{k}</div>
        <div className="v">{v}</div>
        {sub && <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{sub}</div>}
      </div>
    </div>
  );
}

// การ์ดกำไรต่อหมวด: รายได้(เก็บ) − ต้นทุน = กำไร + margin %
function ProfitCard({ title, icon, cls, u, unit = "", total = false }) {
  const margin = u.revenue > 0 ? (u.profit / u.revenue) * 100 : 0;
  const pos = u.profit >= 0;
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-header">
        <div className="ch-title"><Icon name={icon} /> {title}
          {!total && <span style={{ fontWeight: 500, fontSize: 12, color: "var(--faint)" }}> · {num(u.units)} {unit} · ต้นทุน {num(u.cost_rate)} / ขาย {num(u.sell_rate)} ฿</span>}
        </div>
      </div>
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13.5 }}><span style={{ color: "var(--muted)" }}>รายได้ (เก็บผู้เช่า)</span><strong>{money(u.revenue)}</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13.5, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}><span style={{ color: "var(--muted)" }}>ต้นทุน (จ่ายให้รัฐ)</span><strong style={{ color: "var(--danger-ink)" }}>−{money(u.cost)}</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 9 }}>
          <span style={{ fontWeight: 800 }}>กำไร</span>
          <span style={{ textAlign: "right" }}>
            <strong style={{ fontSize: 19, color: pos ? "var(--good-ink)" : "var(--danger-ink)" }}>{money(u.profit)}</strong>
            {u.revenue > 0 && <div style={{ fontSize: 11.5, color: "var(--faint)" }}>margin {margin.toFixed(1)}%</div>}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const market = useActiveMarket();
  const [cycle, setCycle] = useState(thisCycle());
  const [zones, setZones] = useState<Json<Zone>[]>([]);
  const [units, setUnits] = useState<Json<Unit>[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!market) return;
    setLoading(true); setErr("");
    try {
      const [rep, z, u] = await Promise.all([
        api(`/reports?market_id=${market._id}&cycle=${cycle}`),
        api(`/zones?market_id=${market._id}`),
        api(`/units?market_id=${market._id}`),
      ]);
      setD(rep); setZones(z.items || []); setUnits(u.items || []);
    }
    catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [market, cycle]);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
  }, [load, router]);

  async function exportCsv() {
    const res = await fetch(`${BASE}/api/reports?market_id=${market._id}&cycle=${cycle}&format=csv`, { headers: { Authorization: "Bearer " + getToken() } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `report-${cycle}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const zoneName = Object.fromEntries(zones.map((z) => [String(z._id), z.name]));
  const unitZone = Object.fromEntries(units.map((u) => [u.code, String(u.zone_id || "")]));
  const zoneOf = (code) => zoneName[unitZone[code]] || "-";
  const shown = (d?.per_unit || []).filter((r) => {
    if (zoneId && unitZone[r.code] !== String(zoneId)) return false;
    if (status && r.status !== status) return false;
    if (q.trim() && !(`${r.code} ${r.name}`.toLowerCase().includes(q.trim().toLowerCase()))) return false;
    return true;
  });

  return (
    <AppTop title="รายงาน" sub={`${market?.name || ""} · สรุปการใช้ไฟ-น้ำ รายได้ และอุปกรณ์`}
      actions={<button className="btn ghost" onClick={exportCsv} disabled={!d}><Icon name="download" /> ส่งออก CSV</button>}>
      {err && <div className="err">{err}</div>}
      <div className="card pad" style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <div><label>รอบเดือน</label><input type="month" value={cycle} onChange={(e) => setCycle(e.target.value)} /></div>
        <div><label>ตึก</label><select style={{ width: 150 }} value={zoneId} onChange={(e) => setZoneId(e.target.value)}><option value="">ทุกตึก</option>{zones.map((z) => <option key={z._id} value={z._id}>{z.name}</option>)}</select></div>
        <div><label>สถานะบิล</label><select style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">ทุกสถานะ</option><option value="paid">จ่ายแล้ว</option><option value="issued">รอชำระ</option>
          <option value="overdue">เกินกำหนด</option><option value="partially_paid">จ่ายบางส่วน</option><option value="-">ยังไม่ออกบิล</option>
        </select></div>
        <div style={{ flex: 1, minWidth: 160 }}><label>ค้นหาห้อง</label><input placeholder="เช่น B-105" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className="btn primary" onClick={load} disabled={loading}>{loading ? <span className="spin" /> : "ดูรายงาน"}</button>
      </div>

      {d && (
        <>
          <div className="stats" style={{ marginBottom: 6 }}>
            <KPI icon="bolt" cls="elec" k="ไฟฟ้ารวม" v={`${num(d.usage.elec_kwh)} kWh`} />
            <KPI icon="drop" cls="water" k="น้ำรวม" v={`${num(d.usage.water_m3)} m³`} />
            <KPI icon="receipt" cls="ink" k="ออกบิลรวม" v={money(d.revenue.billed)} sub={`${d.revenue.bills} ใบ`} />
            <KPI icon="check" cls="good" k="เก็บได้" v={money(d.revenue.paid)} sub={`${d.revenue.paid_bills} ใบ`} />
            <KPI icon="receipt" cls="bad" k="ค้างชำระ" v={money(d.revenue.outstanding)} />
            <KPI icon="power" cls="ink" k="อุปกรณ์ออนไลน์" v={`${d.devices.online}/${d.devices.total}`} />
          </div>

          {d.utility && (
            <>
              <div className="section-h">กำไรค่าน้ำ-ไฟ — รอบ {d.cycle} <span style={{ fontWeight: 500, fontSize: 12, color: "var(--faint)" }}>(รายได้ที่เก็บจากผู้เช่า − ต้นทุนที่จ่ายให้การไฟฟ้า/ประปา)</span></div>
              {!d.utility.has_cost && <div className="hint" style={{ marginBottom: 10 }}>ℹ️ ยังไม่ได้ตั้ง “ราคาต้นทุน” — กำไรจะเท่ากับรายได้ ตั้งได้ที่หน้า ตั้งค่า → ราคาต่อหน่วย</div>}
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginBottom: 18 }}>
                <ProfitCard title="ไฟฟ้า" icon="bolt" cls="elec" u={d.utility.elec} unit="kWh" />
                <ProfitCard title="น้ำ" icon="drop" cls="water" u={d.utility.water} unit="m³" />
                <ProfitCard title="รวมน้ำ+ไฟ" icon="receipt" cls="ink" u={d.utility.total} total />
              </div>
            </>
          )}

          <div className="section-h">รายละเอียดรายห้อง — รอบ {d.cycle} <span style={{ fontWeight: 500, fontSize: 12, color: "var(--faint)" }}>({shown.length}/{d.per_unit.length} ห้อง · ตัวเลขรวมด้านบนคือทั้งอาคาร)</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>รหัส</th><th>ตึก</th><th className="num">ไฟ (kWh)</th><th className="num">ค่าไฟ (เก็บ)</th><th className="num">น้ำ (m³)</th><th className="num">ค่าน้ำ (เก็บ)</th><th className="num">ยอดบิล</th><th>สถานะ</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.code}>
                    <td><strong>{r.code}</strong><div style={{ fontSize: 11.5, color: "var(--faint)" }}>{r.name}</div></td>
                    <td style={{ color: "var(--muted)" }}>{zoneOf(r.code)}</td>
                    <td className="num">{num(r.elec_kwh)}</td>
                    <td className="num">{money(r.elec_rev)}</td>
                    <td className="num">{num(r.water_m3)}</td>
                    <td className="num">{money(r.water_rev)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{money(r.bill_total)}</td>
                    <td>{r.status === "-" ? <span style={{ color: "var(--faint)" }}>ยังไม่ออกบิล</span> : <span className={`pill ${r.status}`}>{billStatus(r.status)}</span>}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--faint)", padding: 24 }}>ไม่มีข้อมูล</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppTop>
  );
}
