"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppTop from "@/components/AppTop";
import Icon from "@/components/Icon";
import { api, getToken } from "@/lib/api";
import { billStatus } from "@/lib/labels";

const ago = (ts) => {
  if (!ts) return "ยังไม่เคยส่งข้อมูล";
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s} วินาทีที่แล้ว`;
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
};

function AreaChart({ points, color, gid }) {
  if (!points || points.length < 2)
    return <div style={{ color: "var(--faint)", fontSize: 13, padding: "24px 0" }}>ยังไม่มีข้อมูลพอวาดกราฟ</div>;
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs), max = Math.max(...vs), rng = max - min || 1;
  const W = 720, H = 120;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * W, H - ((p.v - min) / rng) * (H - 14) - 7]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", height: 120 }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.18" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function ChartCard({ title, icon, unit, used, points, color }) {
  return (
    <div className="card">
      <div className="card-head">
        <strong style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ color, display: "inline-flex" }}><Icon name={icon} width={16} height={16} /></span> {title}</strong>
        <span style={{ fontSize: 13 }}>{Number(used || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ color: "var(--faint)", fontSize: 11 }}>{unit} ในช่วงที่เลือก</span></span>
      </div>
      <div className="card-body"><AreaChart points={points} color={color} gid={"g-" + icon} /></div>
    </div>
  );
}

export default function UnitPage({ params }) {
  const id = params.id;
  const router = useRouter();
  const [sum, setSum] = useState(null);
  const [err, setErr] = useState("");
  const [range, setRange] = useState({ hours: 24, date: "" });
  const [elec, setElec] = useState({ points: [], used: 0 });
  const [water, setWater] = useState({ points: [], used: 0 });

  const load = useCallback(async () => {
    try { setSum(await api(`/units/${id}/summary`)); } catch (e) { setErr(e.message); }
  }, [id]);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load, router]);

  useEffect(() => {
    if (!getToken()) return;
    let cancel = false;
    const qs = range.date ? `from=${range.date}T00:00:00&to=${range.date}T23:59:59` : `hours=${range.hours}`;
    Promise.all([
      api(`/units/${id}/readings?kind=electric&${qs}`),
      api(`/units/${id}/readings?kind=water&${qs}`),
    ]).then(([e, w]) => { if (!cancel) { setElec(e); setWater(w); } }).catch(() => {});
    return () => { cancel = true; };
  }, [id, range]);

  const devs = sum?.devices || {};

  return (
    <AppTop title={sum?.unit?.name || sum?.unit?.code || "ห้อง"}
      sub={`ค่าเช่า ${(sum?.unit?.rent || 0).toLocaleString()} บาท/เดือน${sum?.unit?.common_fee ? ` · ส่วนกลาง ${sum.unit.common_fee.toLocaleString()} บาท` : ""}`}
      actions={<Link className="btn ghost" href="/dashboard"><Icon name="back" /> แดชบอร์ด</Link>}>
      {err && <div className="err">{err}</div>}

      <div style={{ marginBottom: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span className={`dot ${devs.electric?.online ? "on" : "off"}`}>มิเตอร์ไฟ {devs.electric ? (devs.electric.online ? "ออนไลน์" : "ออฟไลน์") : "ยังไม่ผูก"}</span>
        <span className={`dot ${devs.water?.online ? "on" : "off"}`}>มิเตอร์น้ำ {devs.water ? (devs.water.online ? "ออนไลน์" : "ออฟไลน์") : "ยังไม่ผูก"}</span>
        <span style={{ color: "var(--faint)", fontSize: 12 }}>อ่านล่าสุด {ago(devs.electric?.last_seen || devs.water?.last_seen)}</span>
      </div>

      <div className="meters">
        {(sum?.meters || []).map((m) => (
          <div className={`card meter ${m.kind === "water" ? "water" : "elec"}`} key={m.kind}>
            <div className="top">
              <div className="chip"><Icon name={m.kind === "water" ? "drop" : "bolt"} /></div>
              <div className="k">{m.kind === "water" ? "มิเตอร์น้ำ (สะสม)" : "มิเตอร์ไฟ (สะสม)"}</div>
            </div>
            <div className="v">{Number(m.last_value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} <span className="u">{m.unit}</span></div>
            <div className="today">วันนี้ใช้ {Number(m.usage_today ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} {m.unit}</div>
          </div>
        ))}
      </div>

      <div className="section-h" style={{ marginTop: 22 }}>กราฟการใช้ไฟฟ้า-น้ำ</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        {[{ h: 24, t: "24 ชม." }, { h: 168, t: "7 วัน" }, { h: 720, t: "30 วัน" }].map((o) => (
          <button key={o.h} className={"btn sm " + (!range.date && range.hours === o.h ? "primary" : "ghost")} onClick={() => setRange({ hours: o.h, date: "" })}>{o.t}</button>
        ))}
        <span className="hint" style={{ marginLeft: 4 }}>หรือเลือกวัน</span>
        <input type="date" style={{ width: 170 }} value={range.date} onChange={(e) => setRange({ hours: 24, date: e.target.value })} />
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
        <ChartCard title="ไฟฟ้า" icon="bolt" unit="kWh" color="var(--elec)" used={elec.used} points={elec.points} />
        <ChartCard title="น้ำ" icon="drop" unit="m³" color="var(--water)" used={water.used} points={water.points} />
      </div>

      {sum?.bill?._id && (
        <div className="card pad" style={{ marginTop: 16 }}>
          <div className="row-between">
            <strong>บิลล่าสุด · {sum.bill.cycle}</strong>
            <span className={`pill ${sum.bill.status}`}>{billStatus(sum.bill.status)}</span>
          </div>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>ยอดรวม {Number(sum.bill.total ?? 0).toLocaleString()} บาท · <Link href="/bills" style={{ color: "var(--primary)", fontWeight: 600 }}>ดูบิลทั้งหมด</Link></p>
        </div>
      )}
    </AppTop>
  );
}
