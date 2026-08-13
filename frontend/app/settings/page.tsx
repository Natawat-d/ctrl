"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppTop from "@/components/AppTop";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { api, getToken } from "@/lib/api";
import { isOnline } from "@/lib/device";
import { useActiveMarket } from "@/store/hooks";
import type { Json, Unit, Zone } from "@/models/types";

const ago = (ts) => {
  if (!ts) return "ยังไม่เคยส่งข้อมูล";
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s} วิที่แล้ว`;
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
  return `${Math.floor(s / 86400)} วันที่แล้ว`;
};
const kindTh = (k) => (k === "water" ? "น้ำ" : k === "electric" ? "ไฟ" : "ไม่ระบุ");

const SECTIONS = [
  { id: "structure", icon: "home", label: "โครงสร้างอาคาร" },
  { id: "devices", icon: "power", label: "อุปกรณ์มิเตอร์" },
  { id: "billing", icon: "receipt", label: "เรท & รอบบิล" },
  { id: "rent", icon: "users", label: "ค่าเช่ารายห้อง" },
];

export default function SettingsPage() {
  const router = useRouter();
  const market = useActiveMarket();
  const [sec, setSec] = useState("structure");
  const [units, setUnits] = useState<Json<Unit>[]>([]);
  const [zones, setZones] = useState<Json<Zone>[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [pool, setPool] = useState<any[]>([]);
  const [rate, setRate] = useState({ elec_per_kwh: "", water_per_m3: "", service_fee: "", elec_cost_per_kwh: "", water_cost_per_m3: "" });
  const [billing, setBilling] = useState({ cycle_day: "", due_days: "", grace_days: "", late_fee_per_day: "", late_fee_type: "fixed" });
  const [err, setErr] = useState("");
  const [zoneModal, setZoneModal] = useState(false);
  const [siteModal, setSiteModal] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [zName, setZName] = useState("");
  const [unitZone, setUnitZone] = useState<any>(null);
  const [uForm, setUForm] = useState({ code: "", name: "", floor: "", rent: "", common_fee: "" });
  const [regModal, setRegModal] = useState(false);
  const [regForm, setRegForm] = useState({ uuid: "", kind: "electric" });
  const [sbusy, setSbusy] = useState(false);

  useEffect(() => { if (!getToken()) router.push("/login"); }, [router]);

  const reload = useCallback(async () => {
    if (!market) return;
    try {
      const [u, z, d, pl] = await Promise.all([
        api(`/units?market_id=${market._id}`),
        api(`/zones?market_id=${market._id}`),
        api(`/devices?market_id=${market._id}`),
        api(`/devices/pool`),
      ]);
      setUnits(u.items || []); setZones(z.items || []); setDevices(d.items || []); setPool(pl.items || []);
    } catch (e: any) { setErr(e.message); }
  }, [market]);

  useEffect(() => {
    const mk = market;
    if (!mk) return;
    setRate({ elec_per_kwh: mk.rate?.elec_per_kwh ?? "", water_per_m3: mk.rate?.water_per_m3 ?? "", service_fee: mk.rate?.service_fee ?? 0, elec_cost_per_kwh: mk.rate?.elec_cost_per_kwh ?? "", water_cost_per_m3: mk.rate?.water_cost_per_m3 ?? "" });
    setBilling({ cycle_day: mk.billing?.cycle_day ?? 1, due_days: mk.billing?.due_days ?? 7, grace_days: mk.billing?.grace_days ?? 3, late_fee_per_day: mk.billing?.late_fee_per_day ?? 20, late_fee_type: mk.billing?.late_fee_type ?? "fixed" });
    reload();
  }, [market?._id]);

  const flash = (m) => toast(m);
  const assigned = devices.filter((d) => d.unit_id);
  const onlineCnt = assigned.filter(isOnline).length;

  // ---------- actions ----------
  async function addSite() {
    if (!siteName.trim()) return;
    setSbusy(true); setErr("");
    try {
      await api("/markets", { method: "POST", body: JSON.stringify({ name: siteName.trim(), type: "condo" }) });
      setSiteModal(false); setSiteName(""); flash("สร้างอาคารแล้ว");
      if (typeof window !== "undefined") setTimeout(() => window.location.reload(), 600);
    } catch (e: any) { setErr(e.message); } finally { setSbusy(false); }
  }
  async function addZone() {
    if (!zName.trim()) return;
    setSbusy(true); setErr("");
    try {
      await api("/zones", { method: "POST", body: JSON.stringify({ market_id: market._id, name: zName.trim(), kind: "building", order: zones.length + 1 }) });
      setZoneModal(false); setZName(""); flash("เพิ่มตึกแล้ว"); await reload();
    } catch (e: any) { setErr(e.message); } finally { setSbusy(false); }
  }
  function openAddUnit(zid) { setUnitZone(zid ?? ""); setUForm({ code: "", name: "", floor: "", rent: "", common_fee: "" }); }
  async function addUnit() {
    if (!uForm.code.trim()) return;
    setSbusy(true); setErr("");
    try {
      await api("/units", { method: "POST", body: JSON.stringify({ market_id: market._id, zone_id: unitZone || null, ...uForm, code: uForm.code.trim(), name: uForm.name.trim() || uForm.code.trim() }) });
      setUnitZone(null); flash("เพิ่มห้องแล้ว"); await reload();
    } catch (e: any) { setErr(e.message); } finally { setSbusy(false); }
  }
  async function registerDev() {
    if (!regForm.uuid.trim()) return;
    setSbusy(true); setErr("");
    try {
      await api("/devices", { method: "POST", body: JSON.stringify(regForm) });
      setRegModal(false); setRegForm({ uuid: "", kind: "electric" }); flash("ลงทะเบียนอุปกรณ์แล้ว — อยู่ในรายการรอผูก"); await reload();
    } catch (e: any) { setErr(e.message); } finally { setSbusy(false); }
  }
  async function saveRate() {
    await api(`/markets/${market._id}`, { method: "PATCH", body: JSON.stringify({ rate: { elec_per_kwh: Number(rate.elec_per_kwh), water_per_m3: Number(rate.water_per_m3), service_fee: Number(rate.service_fee) || 0, elec_cost_per_kwh: Number(rate.elec_cost_per_kwh) || 0, water_cost_per_m3: Number(rate.water_cost_per_m3) || 0 } }) });
    flash("บันทึกเรทแล้ว");
  }
  async function saveBilling() {
    await api(`/markets/${market._id}`, { method: "PATCH", body: JSON.stringify({ billing: { cycle_day: Number(billing.cycle_day), due_days: Number(billing.due_days), grace_days: Number(billing.grace_days), late_fee_per_day: Number(billing.late_fee_per_day), late_fee_type: billing.late_fee_type } }) });
    flash("บันทึกรอบบิลแล้ว");
  }
  async function saveRent(u, patch) {
    await api(`/units/${u._id}`, { method: "PATCH", body: JSON.stringify(patch) });
    setUnits((arr) => arr.map((x) => (x._id === u._id ? { ...x, ...patch } : x)));
    flash(`บันทึกห้อง ${u.code} แล้ว`);
  }

  const secLabel = SECTIONS.find((s) => s.id === sec)?.label;

  return (
    <AppTop title="ตั้งค่า" sub={market?.name || ""}>
      {err && <div className="err">{err}</div>}

      {/* info boxes */}
      <div className="info-boxes">
        <div className="info-box"><div className="ib-icon bg-primary"><Icon name="grid" /></div><div className="ib-content"><div className="ib-text">ห้องทั้งหมด</div><div className="ib-number">{units.length}</div></div></div>
        <div className="info-box"><div className="ib-icon bg-success"><Icon name="power" /></div><div className="ib-content"><div className="ib-text">มิเตอร์ออนไลน์</div><div className="ib-number">{onlineCnt}<span className="ib-unit"> / {assigned.length}</span></div></div></div>
        <div className="info-box"><div className="ib-icon bg-warning"><Icon name="log" /></div><div className="ib-content"><div className="ib-text">อุปกรณ์รอผูก</div><div className="ib-number">{pool.length}</div></div></div>
        <div className="info-box"><div className="ib-icon bg-orange"><Icon name="bolt" /></div><div className="ib-content"><div className="ib-text">ค่าไฟ</div><div className="ib-number">{market?.rate?.elec_per_kwh ?? "-"}<span className="ib-unit"> บ./kWh</span></div></div></div>
        <div className="info-box"><div className="ib-icon bg-info"><Icon name="drop" /></div><div className="ib-content"><div className="ib-text">ค่าน้ำ</div><div className="ib-number">{market?.rate?.water_per_m3 ?? "-"}<span className="ib-unit"> บ./m³</span></div></div></div>
      </div>

      <div className="mbx">
        {/* left rail */}
        <div className="mbx-side">
          <button className="btn primary block compose" onClick={() => setRegModal(true)}><Icon name="plus" /> ลงทะเบียนอุปกรณ์</button>
          <div className="mbx-nav">
            <div className="mn-head">หมวดตั้งค่า</div>
            {SECTIONS.map((it) => (
              <button key={it.id} className={sec === it.id ? "active" : ""} onClick={() => setSec(it.id)}>
                <Icon name={it.icon} /> {it.label}
                {it.id === "structure" && <span className="mn-badge">{units.length}</span>}
                {it.id === "devices" && <span className={"mn-badge" + (pool.length ? " warn" : "")}>{pool.length ? `รอผูก ${pool.length}` : assigned.length}</span>}
                {it.id === "rent" && <span className="mn-badge">{units.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* content */}
        <div>
          {sec === "structure" && (
            <div className="card">
              <div className="card-header">
                <div className="ch-title"><Icon name="home" /> โครงสร้าง — ตึก & ห้อง</div>
                <div className="ch-tools">
                  <button className="btn ghost sm" onClick={() => setSiteModal(true)}><Icon name="plus" /> อาคาร</button>
                  <button className="btn ghost sm" onClick={() => setZoneModal(true)} disabled={!market}><Icon name="plus" /> ตึก</button>
                  <button className="btn primary sm" onClick={() => openAddUnit(zones[0]?._id || "")} disabled={!market}><Icon name="plus" /> ห้อง</button>
                </div>
              </div>
              <table className="tbl">
                <thead><tr><th>ตึก</th><th className="num">จำนวนห้อง</th><th></th></tr></thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z._id}>
                      <td><strong>{z.name}</strong></td>
                      <td className="num">{units.filter((u) => String(u.zone_id) === String(z._id)).length}</td>
                      <td className="tight"><button className="btn ghost sm" onClick={() => openAddUnit(z._id)}><Icon name="plus" /> เพิ่มห้อง</button></td>
                    </tr>
                  ))}
                  {zones.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--faint)", padding: 20 }}>ยังไม่มีตึก — กด "ตึก" เพื่อเริ่ม</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {sec === "devices" && (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <div className="ch-title"><Icon name="log" /> อุปกรณ์รอผูก <span style={{ color: "var(--faint)", fontWeight: 500, fontSize: 12 }}>({pool.length})</span></div>
                  <div className="ch-tools"><button className="btn ghost sm" onClick={reload}>รีเฟรช</button></div>
                </div>
                {pool.length === 0 && <div className="card empty" style={{ border: "none", boxShadow: "none" }}>ไม่มีอุปกรณ์รอผูก — อุปกรณ์ใหม่ที่ส่งค่าเข้าระบบจะโผล่ที่นี่เอง</div>}
                {pool.map((d) => <PoolRow key={d.uuid} d={d} onChanged={reload} onFlash={flash} />)}
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="ch-title"><Icon name="power" /> ผูกอุปกรณ์กับห้อง</div>
                  <div className="ch-tools"><span className="hint">ผูกแล้ว {assigned.length}/{units.length * 2}</span></div>
                </div>
                <table className="tbl">
                  <thead><tr><th>ห้อง</th><th>มิเตอร์ไฟ</th><th>มิเตอร์น้ำ</th></tr></thead>
                  <tbody>
                    {units.map((u) => (
                      <tr key={u._id}>
                        <td><strong>{u.code}</strong><div style={{ color: "var(--faint)", fontSize: 11.5 }}>{u.name}</div></td>
                        <td><MeterCell u={u} kind="electric" dev={devices.find((d) => String(d.unit_id) === String(u._id) && d.kind === "electric")} pool={pool} onChanged={reload} onFlash={flash} /></td>
                        <td><MeterCell u={u} kind="water" dev={devices.find((d) => String(d.unit_id) === String(u._id) && d.kind === "water")} pool={pool} onChanged={reload} onFlash={flash} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {sec === "billing" && (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
              <div className="card">
                <div className="card-header"><div className="ch-title"><Icon name="bolt" /> ราคาต่อหน่วย</div></div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="hint" style={{ marginBottom: 8, fontWeight: 700, color: "var(--muted)" }}>ราคาขาย (เก็บจากผู้เช่า)</div>
                  <div className="row-2">
                    <div className="field"><label>ค่าไฟ (บาท/kWh)</label><input type="number" step="0.01" value={rate.elec_per_kwh} onChange={(e) => setRate({ ...rate, elec_per_kwh: e.target.value })} /></div>
                    <div className="field"><label>ค่าน้ำ (บาท/m³)</label><input type="number" step="0.01" value={rate.water_per_m3} onChange={(e) => setRate({ ...rate, water_per_m3: e.target.value })} /></div>
                  </div>
                  <div className="hint" style={{ margin: "6px 0 8px", fontWeight: 700, color: "var(--muted)" }}>ราคาต้นทุน (จ่ายให้การไฟฟ้า/ประปา)</div>
                  <div className="row-2">
                    <div className="field"><label>ต้นทุนไฟ (บาท/kWh)</label><input type="number" step="0.01" placeholder="เช่น 4.20" value={rate.elec_cost_per_kwh} onChange={(e) => setRate({ ...rate, elec_cost_per_kwh: e.target.value })} /></div>
                    <div className="field"><label>ต้นทุนน้ำ (บาท/m³)</label><input type="number" step="0.01" placeholder="เช่น 12.00" value={rate.water_cost_per_m3} onChange={(e) => setRate({ ...rate, water_cost_per_m3: e.target.value })} /></div>
                  </div>
                  {(() => {
                    const em = Number(rate.elec_per_kwh) - Number(rate.elec_cost_per_kwh);
                    const wm = Number(rate.water_per_m3) - Number(rate.water_cost_per_m3);
                    const showE = rate.elec_cost_per_kwh !== "" && !isNaN(em);
                    const showW = rate.water_cost_per_m3 !== "" && !isNaN(wm);
                    if (!showE && !showW) return null;
                    const chip = (label, v) => <span style={{ fontSize: 12.5 }}>{label} <strong style={{ color: v >= 0 ? "var(--good-ink)" : "var(--danger-ink)" }}>{v >= 0 ? "+" : ""}{v.toFixed(2)} ฿/หน่วย</strong></span>;
                    return <div className="hint" style={{ display: "flex", gap: 16, flexWrap: "wrap", background: "var(--surface-2)", padding: "8px 12px", borderRadius: 6, margin: "2px 0 10px" }}>
                      <span style={{ color: "var(--muted)", fontWeight: 700 }}>กำไรต่อหน่วย:</span>
                      {showE && chip("ไฟ", em)}{showW && chip("น้ำ", wm)}
                    </div>;
                  })()}
                  <div className="field"><label>ค่าบริการคงที่ (บาท)</label><input type="number" value={rate.service_fee} onChange={(e) => setRate({ ...rate, service_fee: e.target.value })} /></div>
                  <button className="btn primary" onClick={saveRate}>บันทึกเรท</button>
                </div>
              </div>
              <div className="card">
                <div className="card-header"><div className="ch-title"><Icon name="receipt" /> รอบบิล & ค่าปรับ</div></div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="row-2">
                    <div className="field"><label>ออกบิลวันที่</label><input type="number" min="1" max="28" value={billing.cycle_day} onChange={(e) => setBilling({ ...billing, cycle_day: e.target.value })} /></div>
                    <div className="field"><label>ครบกำหนดใน (วัน)</label><input type="number" value={billing.due_days} onChange={(e) => setBilling({ ...billing, due_days: e.target.value })} /></div>
                  </div>
                  <div className="row-2">
                    <div className="field"><label>ผ่อนผัน (วัน) ก่อนคิดค่าปรับ</label><input type="number" value={billing.grace_days} onChange={(e) => setBilling({ ...billing, grace_days: e.target.value })} /></div>
                    <div className="field"><label>ค่าปรับ/วัน</label><input type="number" value={billing.late_fee_per_day} onChange={(e) => setBilling({ ...billing, late_fee_per_day: e.target.value })} /></div>
                  </div>
                  <div className="field"><label>ชนิดค่าปรับ</label><select value={billing.late_fee_type} onChange={(e) => setBilling({ ...billing, late_fee_type: e.target.value })}><option value="fixed">บาท/วัน</option><option value="percent">% ต่อวัน</option></select></div>
                  <div className="hint" style={{ marginBottom: 10 }}>ปุ่ม "ออกบิลเดือนนี้" ในหน้า บิล จะกดได้เฉพาะวันที่ {billing.cycle_day || 1} และออกได้ครั้งเดียวต่อเดือน</div>
                  <button className="btn primary" onClick={saveBilling}>บันทึกรอบบิล</button>
                </div>
              </div>
            </div>
          )}

          {sec === "rent" && (
            <div className="card">
              <div className="card-header">
                <div className="ch-title"><Icon name="users" /> ค่าเช่า · ค่าส่วนกลาง · เรทเฉพาะห้อง</div>
                <div className="ch-tools"><span className="hint">เว้นช่องว่าง = ใช้ค่ากลางของอาคาร</span></div>
              </div>
              <div className="rows">
                {units.map((u) => <RentRow key={u._id} u={u} onSave={saveRent} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* modal: เพิ่มอาคาร */}
      {siteModal && (
        <div className="modal-bg" onClick={() => setSiteModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>เพิ่มอาคารใหม่</h3>
            <div className="m-sub">1 บัญชีเป็นเจ้าของได้หลายอาคาร</div>
            <label>ชื่ออาคาร</label>
            <input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="เช่น หอพักสาขา 2" autoFocus />
            <div className="m-actions">
              <button className="btn ghost" onClick={() => setSiteModal(false)}>ยกเลิก</button>
              <button className="btn primary" onClick={addSite} disabled={sbusy || !siteName.trim()}>{sbusy ? <span className="spin" /> : "สร้างอาคาร"}</button>
            </div>
          </div>
        </div>
      )}

      {/* modal: เพิ่มตึก */}
      {zoneModal && (
        <div className="modal-bg" onClick={() => setZoneModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>เพิ่มตึก</h3>
            <div className="m-sub">{market?.name}</div>
            <label>ชื่อตึก</label>
            <input value={zName} onChange={(e) => setZName(e.target.value)} placeholder="เช่น อาคาร B" autoFocus />
            <div className="m-actions">
              <button className="btn ghost" onClick={() => setZoneModal(false)}>ยกเลิก</button>
              <button className="btn primary" onClick={addZone} disabled={sbusy || !zName.trim()}>{sbusy ? <span className="spin" /> : "เพิ่ม"}</button>
            </div>
          </div>
        </div>
      )}

      {/* modal: เพิ่มห้อง */}
      {unitZone !== null && (
        <div className="modal-bg" onClick={() => setUnitZone(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3>เพิ่มห้อง</h3>
            <div className="m-sub">สร้างมิเตอร์ไฟ + น้ำ ให้อัตโนมัติ พร้อมใช้งานทันที</div>
            <label>ตึก</label>
            <select value={unitZone} onChange={(e) => setUnitZone(e.target.value)}>
              <option value="">— ไม่ระบุตึก —</option>
              {zones.map((z) => <option key={z._id} value={z._id}>{z.name}</option>)}
            </select>
            <div className="row-2" style={{ marginTop: 12 }}>
              <div><label>รหัสห้อง</label><input value={uForm.code} onChange={(e) => setUForm({ ...uForm, code: e.target.value })} placeholder="เช่น B-201" autoFocus /></div>
              <div><label>ชื่อ (ไม่บังคับ)</label><input value={uForm.name} onChange={(e) => setUForm({ ...uForm, name: e.target.value })} placeholder="ห้อง..." /></div>
            </div>
            <div className="row-2" style={{ marginTop: 12 }}>
              <div><label>ชั้น</label><input type="number" value={uForm.floor} onChange={(e) => setUForm({ ...uForm, floor: e.target.value })} placeholder="เช่น 2" /></div>
              <div><label>ค่าเช่า/เดือน (บาท)</label><input type="number" value={uForm.rent} onChange={(e) => setUForm({ ...uForm, rent: e.target.value })} placeholder="0" /></div>
            </div>
            <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
              <label>ค่าส่วนกลาง (บาท)</label><input type="number" value={uForm.common_fee} onChange={(e) => setUForm({ ...uForm, common_fee: e.target.value })} placeholder="0" />
            </div>
            <div className="m-actions">
              <button className="btn ghost" onClick={() => setUnitZone(null)}>ยกเลิก</button>
              <button className="btn primary" onClick={addUnit} disabled={sbusy || !uForm.code.trim()}>{sbusy ? <span className="spin" /> : "เพิ่มห้อง"}</button>
            </div>
          </div>
        </div>
      )}

      {/* modal: ลงทะเบียนอุปกรณ์ */}
      {regModal && (
        <div className="modal-bg" onClick={() => setRegModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>ลงทะเบียนอุปกรณ์</h3>
            <div className="m-sub">ปกติอุปกรณ์จะส่งค่าเข้าระบบแล้วมารอใน "รอผูก" เอง — ฟอร์มนี้ใช้ลงทะเบียนล่วงหน้า/ทดสอบ</div>
            <label>UUID อุปกรณ์</label>
            <div className="pw-field">
              <input value={regForm.uuid} onChange={(e) => setRegForm({ ...regForm, uuid: e.target.value })} placeholder="วาง UUID จากตัวเครื่อง" autoFocus />
              <button className="btn ghost" type="button" onClick={() => setRegForm({ ...regForm, uuid: "mock-" + Math.random().toString(16).slice(2, 10) })}>สุ่ม</button>
            </div>
            <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
              <label>ชนิดมิเตอร์</label>
              <select value={regForm.kind} onChange={(e) => setRegForm({ ...regForm, kind: e.target.value })}>
                <option value="electric">ไฟฟ้า</option>
                <option value="water">น้ำ</option>
              </select>
            </div>
            <div className="m-actions">
              <button className="btn ghost" onClick={() => setRegModal(false)}>ยกเลิก</button>
              <button className="btn primary" onClick={registerDev} disabled={sbusy || !regForm.uuid.trim()}>{sbusy ? <span className="spin" /> : "ลงทะเบียน"}</button>
            </div>
          </div>
        </div>
      )}
    </AppTop>
  );
}

// แถวอุปกรณ์ใน pool: แก้ชนิด / ลบ ได้ (CRUD)
function PoolRow({ d, onChanged, onFlash }) {
  const [busy, setBusy] = useState(false);
  async function setKind(kind) {
    setBusy(true);
    try { await api(`/devices/${d.id || d._id}`, { method: "PATCH", body: JSON.stringify({ kind }) }); onFlash("แก้ชนิดแล้ว"); onChanged(); }
    catch (e: any) { onFlash(e.message); } finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm(`ลบอุปกรณ์ ${String(d.uuid).slice(0, 12)}… ออกจากระบบ?`)) return;
    setBusy(true);
    try { await api(`/devices/${d.id || d._id}`, { method: "DELETE" }); onFlash("ลบอุปกรณ์แล้ว"); onChanged(); }
    catch (e: any) { onFlash(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="inbox-row">
      <div className={"ir-icon " + (d.kind === "water" ? "bg-info" : d.kind === "electric" ? "bg-orange" : "bg-warning")}>
        <Icon name={d.kind === "water" ? "drop" : "bolt"} />
      </div>
      <div className="ir-main">
        <div className="ir-title">{d.uuid}</div>
        <div className="ir-sub">มิเตอร์{kindTh(d.kind)} · เห็นล่าสุด {ago(d.last_seen)} {d.online ? "· กำลังส่งข้อมูล" : ""}</div>
      </div>
      <div className="ir-actions">
        <span className={`dot ${d.online ? "on" : "off"}`}>{d.online ? "ออนไลน์" : "ออฟไลน์"}</span>
        <select style={{ width: 90 }} value={d.kind || ""} disabled={busy} onChange={(e) => setKind(e.target.value)}>
          <option value="" disabled>ชนิด…</option>
          <option value="electric">ไฟ</option>
          <option value="water">น้ำ</option>
        </select>
        <button className="btn ghost sm" disabled={busy} onClick={remove} title="ลบออกจากระบบ"><Icon name="trash" /></button>
      </div>
    </div>
  );
}

function MeterCell({ u, kind, dev, pool, onChanged, onFlash }) {
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const online = dev ? isOnline(dev) : false;
  const options = pool.filter((d) => !d.kind || d.kind === kind);

  async function assign() {
    if (!pick) return;
    setBusy(true);
    try { await api(`/units/${u._id}/device`, { method: "POST", body: JSON.stringify({ uuid: pick, kind }) }); onFlash(`ผูกมิเตอร์${kindTh(kind)} ${u.code} แล้ว`); setPick(""); onChanged(); }
    catch (e: any) { onFlash(e.message); } finally { setBusy(false); }
  }
  async function unassign() {
    if (!confirm(`ปลดมิเตอร์${kindTh(kind)}ของ ${u.code} กลับเข้ารายการรอผูก?`)) return;
    setBusy(true);
    try { await api(`/units/${u._id}/device?kind=${kind}`, { method: "DELETE" }); onFlash("ปลดแล้ว — กลับเข้ารายการรอผูก"); onChanged(); }
    catch (e: any) { onFlash(e.message); } finally { setBusy(false); }
  }

  if (dev)
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{String(dev.uuid).slice(0, 8)}…</span>
        <span className={`dot ${online ? "on" : "off"}`}>{online ? "ออนไลน์" : "ออฟไลน์"}</span>
        <button className="btn ghost sm" disabled={busy} onClick={unassign}>ปลด</button>
      </div>
    );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <select style={{ width: 190, fontFamily: "ui-monospace, monospace", fontSize: 12 }} value={pick} onChange={(e) => setPick(e.target.value)}>
        <option value="">— เลือกจากรอผูก ({options.length}) —</option>
        {options.map((d) => <option key={d.uuid} value={d.uuid}>{String(d.uuid).slice(0, 12)}… {d.kind ? "" : "(ไม่ระบุชนิด)"}</option>)}
      </select>
      <button className="btn primary sm" disabled={busy || !pick} onClick={assign}>{busy ? <span className="spin" /> : "ผูก"}</button>
    </div>
  );
}

function RentRow({ u, onSave }) {
  const [rent, setRent] = useState(u.rent ?? 0);
  const [common, setCommon] = useState(u.common_fee ?? 0);
  const [open, setOpen] = useState(false);
  const [ro, setRo] = useState(u.rate_override || {});
  const [bo, setBo] = useState(u.billing_override || {});
  const setR = (k, v) => setRo((o) => ({ ...o, [k]: v }));
  const setB = (k, v) => setBo((o) => ({ ...o, [k]: v }));
  const hasOverride = ["elec_per_kwh", "water_per_m3"].some((k) => ro[k] != null && ro[k] !== "") || ["due_days", "grace_days", "late_fee_per_day"].some((k) => bo[k] != null && bo[k] !== "");

  function save() {
    const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null));
    onSave(u, { rent: Number(rent) || 0, common_fee: Number(common) || 0, rate_override: clean(ro), billing_override: clean(bo) });
  }

  return (
    <div className="row" style={{ flexWrap: "wrap" }}>
      <div className="row-main">
        <strong>{u.code}</strong>
        <div className="row-sub">{u.name}{hasOverride && <span className="pill" style={{ marginLeft: 6, background: "var(--accent-soft)", color: "var(--accent)" }}>เรทเฉพาะ</span>}</div>
      </div>
      <div className="row-right">
        <label className="mini">เช่า<input style={{ width: 84 }} type="number" value={rent} onChange={(e) => setRent(e.target.value)} /></label>
        <label className="mini">ส่วนกลาง<input style={{ width: 84 }} type="number" value={common} onChange={(e) => setCommon(e.target.value)} /></label>
        <button className="btn ghost sm" onClick={() => setOpen((v) => !v)}>{open ? "ซ่อน" : "เรท/รอบเอง"}</button>
        <button className="btn primary sm" onClick={save}>บันทึก</button>
      </div>
      {open && (
        <div style={{ flexBasis: "100%", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--line)" }}>
          <label className="mini col">ค่าไฟ ฿/kWh<input type="number" step="0.01" placeholder="ค่ากลาง" value={ro.elec_per_kwh ?? ""} onChange={(e) => setR("elec_per_kwh", e.target.value)} /></label>
          <label className="mini col">ค่าน้ำ ฿/m³<input type="number" step="0.01" placeholder="ค่ากลาง" value={ro.water_per_m3 ?? ""} onChange={(e) => setR("water_per_m3", e.target.value)} /></label>
          <label className="mini col">ครบกำหนด (วัน)<input type="number" placeholder="ค่ากลาง" value={bo.due_days ?? ""} onChange={(e) => setB("due_days", e.target.value)} /></label>
          <label className="mini col">ผ่อนผัน (วัน)<input type="number" placeholder="ค่ากลาง" value={bo.grace_days ?? ""} onChange={(e) => setB("grace_days", e.target.value)} /></label>
          <label className="mini col">ค่าปรับ/วัน<input type="number" placeholder="ค่ากลาง" value={bo.late_fee_per_day ?? ""} onChange={(e) => setB("late_fee_per_day", e.target.value)} /></label>
        </div>
      )}
    </div>
  );
}
