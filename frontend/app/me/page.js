"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import AppTop from "@/components/AppTop";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { api, getToken } from "@/lib/api";
import { billStatus } from "@/lib/labels";
import { selectUser } from "@/store/authSlice";

const money = (n) => "฿" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtD = (d) => (d ? new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-");
const lineOf = (b, t) => (b.lines || []).find((l) => l.type === t);

function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 900 / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = rej;
    img.src = url;
  });
}

// การ์ดบิลที่ยังไม่จ่าย: แจกแจงรายการ + แนบสลิปแจ้งชำระ
function DueCard({ bill, onPaid, onViewSlip }) {
  const [slip, setSlip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const pay = bill.payment;
  const pending = pay?.status === "submitted";
  const rejected = pay?.status === "rejected";
  const remain = (bill.total || 0) - (bill.paid_amount || 0);

  async function onFile(e) { const f = e.target.files?.[0]; if (f) setSlip(await fileToDataUrl(f)); }
  async function submit() {
    setBusy(true);
    try {
      await api(`/bills/${bill._id}/payments`, { method: "POST", body: JSON.stringify({ amount: remain, slip_image_url: slip || "" }) });
      toast("ส่งสลิปเรียบร้อย — รอเจ้าของตรวจสอบ");
      setSent(true); setOpen(false); setSlip(null);
      setTimeout(onPaid, 1500);
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  }

  const rows = [
    { k: "ค่าไฟฟ้า", l: lineOf(bill, "electric"), unit: "kWh" },
    { k: "ค่าน้ำ", l: lineOf(bill, "water"), unit: "m³" },
    { k: "ค่าเช่าห้อง", l: lineOf(bill, "rent") },
    { k: "ค่าส่วนกลาง", l: lineOf(bill, "common") },
  ].filter((r) => r.l);

  return (
    <div className="card" style={{ marginBottom: 12, overflow: "hidden" }}>
      <div className="card-header">
        <div className="ch-title"><Icon name="receipt" /> รอบ {bill.cycle} <span style={{ fontWeight: 500, fontSize: 12, color: "var(--faint)" }}>· ครบกำหนด {fmtD(bill.due_at)}</span></div>
        <div className="ch-tools">
          {sent ? <span className="pill submitted">✓ ส่งสลิปแล้ว</span>
            : pending ? <span className="pill submitted">⏳ รอตรวจสอบสลิป</span>
            : rejected ? <span className="pill rejected">สลิปไม่ผ่าน — แนบใหม่</span>
            : <span className={`pill ${bill.status}`}>{billStatus(bill.status)}</span>}
        </div>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <table style={{ borderCollapse: "collapse", flex: "1 1 320px", fontSize: 13.5 }}>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}>
                <td style={{ padding: "4px 0", color: "var(--muted)" }}>
                  {r.k}{r.l.usage != null && <span style={{ color: "var(--faint)", fontSize: 12 }}> — {Number(r.l.usage).toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.unit} × {r.l.rate} ฿</span>}
                </td>
                <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>{money(r.l.amount)}</td>
              </tr>
            ))}
            {bill.late_fee > 0 && (
              <tr><td style={{ padding: "4px 0", color: "var(--danger-ink)" }}>ค่าปรับชำระล่าช้า</td>
                <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600, color: "var(--danger-ink)" }}>{money(bill.late_fee)}</td></tr>
            )}
            {bill.paid_amount > 0 && (
              <tr><td style={{ padding: "4px 0", color: "var(--good-ink)" }}>ชำระแล้วบางส่วน</td>
                <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600, color: "var(--good-ink)" }}>-{money(bill.paid_amount)}</td></tr>
            )}
            <tr style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "7px 0 0", fontWeight: 800 }}>ยอดที่ต้องชำระ</td>
              <td style={{ padding: "7px 0 0", textAlign: "right", fontWeight: 800, fontSize: 17 }}>{money(remain)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ flex: "0 0 auto", minWidth: 190 }}>
          {sent && <div className="ok-msg">✅ ส่งสลิปเรียบร้อย รอเจ้าของยืนยัน</div>}
          {pending && pay?.slip && (
            <button className="btn ghost sm" onClick={() => onViewSlip(pay.slip)}>ดูสลิปที่ส่งไป</button>
          )}
          {!sent && !pending && !open && (
            <button className="btn primary" onClick={() => setOpen(true)}><Icon name="upload" /> {rejected ? "แนบสลิปใหม่" : "แจ้งชำระ / แนบสลิป"}</button>
          )}
          {open && (
            <div>
              <label>แนบสลิปโอนเงิน (รูป)</label>
              <input type="file" accept="image/*" onChange={onFile} />
              {slip ? (
                <img src={slip} alt="slip" style={{ maxWidth: 150, borderRadius: 6, display: "block", border: "1px solid var(--line)", marginTop: 8 }} />
              ) : <div className="hint" style={{ marginTop: 6 }}>ยังไม่ได้เลือกรูปสลิป</div>}
              <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
                <button className="btn primary sm" onClick={submit} disabled={busy || !slip}>{busy ? <span className="spin" /> : <Icon name="check" />} ส่งแจ้งชำระ</button>
                <button className="btn ghost sm" onClick={() => { setOpen(false); setSlip(null); }}>ยกเลิก</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MePage() {
  const router = useRouter();
  const user = useSelector(selectUser);
  const [units, setUnits] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [bills, setBills] = useState([]);
  const [err, setErr] = useState("");
  const [slipView, setSlipView] = useState(null);
  const [stF, setStF] = useState("all");   // all | unpaid | pending | paid
  const [yrF, setYrF] = useState("all");   // all | "YYYY"

  const load = useCallback(async () => {
    try {
      const me = await api("/me");
      setUnits(me.units || []);
      setBills(me.bills || []);
      const s = {};
      for (const u of me.units || []) { try { s[u._id] = await api(`/units/${u._id}/summary`); } catch {} }
      setSummaries(s);
    } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, router]);

  const u0 = units[0];
  const s0 = u0 ? summaries[u0._id] : null;
  const eToday = s0?.meters?.find((m) => m.kind === "electric")?.usage_today ?? 0;
  const wToday = s0?.meters?.find((m) => m.kind === "water")?.usage_today ?? 0;

  const unpaid = bills.filter((b) => b.status !== "paid");
  const dueSum = unpaid.reduce((s, b) => s + ((b.total || 0) - (b.paid_amount || 0)), 0);

  const years = [...new Set(bills.map((b) => (b.cycle || "").slice(0, 4)))].filter(Boolean).sort().reverse();
  const shown = bills.filter((b) => {
    if (yrF !== "all" && (b.cycle || "").slice(0, 4) !== yrF) return false;
    if (stF === "unpaid") return b.status !== "paid";
    if (stF === "paid") return b.status === "paid";
    if (stF === "pending") return b.payment?.status === "submitted";
    return true;
  });

  return (
    <AppTop title="ห้องของฉัน" sub={`สวัสดี ${user?.display_name || ""}${u0 ? ` · ${u0.name || u0.code}` : ""}`}>
      {err && <div className="err">{err}</div>}
      {units.length === 0 && <div className="card empty">ยังไม่มีห้องที่ผูกกับบัญชีนี้</div>}

      {u0 && (
        <div className="info-boxes">
          <div className="info-box"><div className="ib-icon bg-primary"><Icon name="home" /></div><div className="ib-content"><div className="ib-text">ห้องของฉัน</div><div className="ib-number">{u0.code}<span className="ib-unit"> ชั้น {u0.floor ?? "-"}</span></div></div></div>
          <div className="info-box"><div className="ib-icon bg-warning"><Icon name="bolt" /></div><div className="ib-content"><div className="ib-text">ไฟฟ้าวันนี้</div><div className="ib-number">{Number(eToday).toLocaleString(undefined, { maximumFractionDigits: 2 })}<span className="ib-unit"> kWh</span></div></div></div>
          <div className="info-box"><div className="ib-icon bg-info"><Icon name="drop" /></div><div className="ib-content"><div className="ib-text">น้ำวันนี้</div><div className="ib-number">{Number(wToday).toLocaleString(undefined, { maximumFractionDigits: 2 })}<span className="ib-unit"> m³</span></div></div></div>
          <div className="info-box"><div className={`ib-icon ${dueSum > 0.005 ? "bg-danger" : "bg-success"}`}><Icon name="receipt" /></div><div className="ib-content"><div className="ib-text">{dueSum > 0.005 ? `ค้างชำระ (${unpaid.length} ใบ)` : "ค้างชำระ"}</div><div className="ib-number">{dueSum > 0.005 ? money(dueSum) : "ไม่มี"}</div></div></div>
        </div>
      )}

      {unpaid.length > 0 && (
        <>
          <div className="section-h">บิลที่ต้องชำระ ({unpaid.length})</div>
          {unpaid.map((b) => <DueCard key={b._id} bill={b} onPaid={load} onViewSlip={setSlipView} />)}
        </>
      )}

      <div className="card" style={{ marginTop: 18, overflow: "hidden" }}>
        <div className="card-header">
          <div className="ch-title"><Icon name="log" /> ประวัติบิล <span style={{ fontWeight: 500, fontSize: 12, color: "var(--faint)" }}>({shown.length}/{bills.length} ใบ)</span></div>
          <div className="ch-tools">
            <select value={stF} onChange={(e) => setStF(e.target.value)} style={{ width: "auto", fontSize: 13 }}>
              <option value="all">ทุกสถานะ</option>
              <option value="unpaid">ค้างชำระ</option>
              <option value="pending">รอตรวจสลิป</option>
              <option value="paid">จ่ายแล้ว</option>
            </select>
            <select value={yrF} onChange={(e) => setYrF(e.target.value)} style={{ width: "auto", fontSize: 13 }}>
              <option value="all">ทุกปี</option>
              {years.map((y) => <option key={y} value={y}>ปี {Number(y) + 543}</option>)}
            </select>
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="empty" style={{ padding: 28 }}>ไม่พบบิลตามที่กรอง</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>รอบ</th><th>ครบกำหนด</th><th className="num">ค่าไฟ</th><th className="num">ค่าน้ำ</th><th className="num">เช่า+อื่นๆ</th><th className="num">ยอดรวม</th><th>สถานะ</th><th>สลิป</th></tr>
            </thead>
            <tbody>
              {shown.map((b) => {
                const e = lineOf(b, "electric"), w = lineOf(b, "water");
                const other = (lineOf(b, "rent")?.amount || 0) + (lineOf(b, "common")?.amount || 0) + (lineOf(b, "service")?.amount || 0);
                return (
                  <tr key={b._id}>
                    <td><strong>{b.cycle}</strong></td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtD(b.due_at)}</td>
                    <td className="num" title={e ? `${e.usage} kWh × ${e.rate} ฿` : ""}>{e ? money(e.amount) : "—"}<div style={{ fontSize: 11, color: "var(--faint)" }}>{e ? `${Number(e.usage).toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh` : ""}</div></td>
                    <td className="num" title={w ? `${w.usage} m³ × ${w.rate} ฿` : ""}>{w ? money(w.amount) : "—"}<div style={{ fontSize: 11, color: "var(--faint)" }}>{w ? `${Number(w.usage).toLocaleString(undefined, { maximumFractionDigits: 2 })} m³` : ""}</div></td>
                    <td className="num">{money(other)}</td>
                    <td className="num" style={{ fontWeight: 800 }}>{money(b.total)}{b.late_fee > 0 && <div style={{ fontSize: 11, color: "var(--danger-ink)", fontWeight: 600 }}>รวมค่าปรับ {money(b.late_fee)}</div>}</td>
                    <td>
                      {b.payment?.status === "submitted" ? <span className="pill submitted">รอตรวจสลิป</span>
                        : <span className={`pill ${b.status}`}>{billStatus(b.status)}</span>}
                    </td>
                    <td>
                      {b.payment?.slip ? (
                        <img src={b.payment.slip} alt="slip" className="slip-mini" onClick={() => setSlipView(b.payment.slip)} title="กดเพื่อดูสลิปเต็ม" />
                      ) : <span style={{ color: "var(--faint)" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {slipView && (
        <div className="modal-bg" onClick={() => setSlipView(null)}>
          <img src={slipView} alt="slip" style={{ maxHeight: "86vh", maxWidth: "92vw", borderRadius: 8, background: "#fff" }} />
        </div>
      )}
    </AppTop>
  );
}
