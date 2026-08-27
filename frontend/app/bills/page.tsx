"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppTop from "@/components/AppTop";
import { toast } from "@/components/Toast";
import { api, getToken } from "@/lib/api";
import { billStatus } from "@/lib/labels";
import { useActiveMarket } from "@/store/hooks";
import type { Json, Unit, Bill, Payment } from "@/models/types";

const money = (n) => "฿" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function BillsPage() {
  const router = useRouter();
  const market = useActiveMarket();
  const [units, setUnits] = useState<Json<Unit>[]>([]);
  const [bills, setBills] = useState<Json<Bill>[]>([]);
  const [pays, setPays] = useState<Json<Payment>[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [slip, setSlip] = useState<any>(null);
  const [cycleF, setCycleF] = useState("latest"); // latest | all | "YYYY-MM"

  const load = useCallback(async () => {
    if (!market) return;
    setUnits((await api(`/units?market_id=${market._id}`)).items || []);
    setBills((await api(`/bills?market_id=${market._id}`)).items || []);
    setPays((await api(`/payments?status=submitted`)).items || []);
  }, [market]);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load().catch((e) => setErr(e.message));
  }, [load, router]);

  // รอบที่จะออก = เดือนที่เพิ่งจบ (กดวันที่ 1 → เก็บหน่วยน้ำ-ไฟของเดือนก่อนหน้าเต็มเดือน)
  const _n = new Date(), _p = new Date(_n.getFullYear(), _n.getMonth() - 1, 1);
  const cycle = `${_p.getFullYear()}-${String(_p.getMonth() + 1).padStart(2, "0")}`;
  const cycleDay = market?.billing?.cycle_day || 1;
  const today = new Date().getDate();
  const alreadyThisCycle = bills.some((b) => b.cycle === cycle);
  const canGenerate = !!market && today === cycleDay && !alreadyThisCycle;
  const genReason = !market ? "" : alreadyThisCycle ? `ออกบิลรอบ ${cycle} ไปแล้ว — ออกซ้ำไม่ได้` : today !== cycleDay ? `ออกบิลได้เฉพาะวันที่ ${cycleDay} ของเดือน (วันนี้วันที่ ${today})` : `ออกบิลรอบ ${cycle} (หน่วยของเดือนที่เพิ่งจบ)`;

  async function generate() {
    if (!canGenerate) { setErr(genReason); return; }
    setErr(""); setMsg(""); setBusy(true);
    try {
      const r = await api(`/markets/${market._id}/bills/generate?cycle=${cycle}`, { method: "POST" });
      toast(`ออกบิลรอบ ${r.cycle} จำนวน ${r.generated} รายการ`);
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const verify = async (id) => { await api(`/payments/${id}/verify`, { method: "POST" }); toast("ยืนยันการชำระแล้ว"); await load(); };
  const reject = async (id) => { await api(`/payments/${id}/reject`, { method: "POST" }); toast("ปฏิเสธสลิปแล้ว", "err"); await load(); };
  const code = (id) => units.find((u) => String(u._id) === String(id))?.code || "-";

  // ---- ประวัติบิล: รอบทั้งหมดที่มี (ใหม่ → เก่า) + ตัวกรองรอบ ----
  const cycles = [...new Set(bills.map((b) => b.cycle))].sort().reverse();
  const activeCycle = cycleF === "latest" ? cycles[0] : cycleF;
  const shown = (cycleF === "all" ? [...bills] : bills.filter((b) => b.cycle === activeCycle))
    .sort((a, b) => (a.cycle === b.cycle ? code(a.unit_id).localeCompare(code(b.unit_id)) : a.cycle < b.cycle ? 1 : -1));
  const sumTotal = shown.reduce((s, b) => s + (b.total || 0), 0);
  const sumUnpaid = shown.reduce((s, b) => s + ((b.total || 0) - (b.paid_amount || 0)), 0);

  const sumPaid = sumTotal - sumUnpaid;
  const paidCount = shown.filter((b) => (b.total || 0) - (b.paid_amount || 0) <= 0.005).length;
  const unpaidOf = (b) => (b.total || 0) - (b.paid_amount || 0);

  return (
    <AppTop title="บิล" sub="ออกบิล ตรวจสลิป และติดตามสถานะการชำระ">
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok-msg" style={{ marginBottom: 12 }}>{msg}</div>}

      {/* ออกบิลรายเดือน — การ์ดหลัก */}
      <div className="gen-card">
        <div className="gen-info">
          <div className="eyebrow">ออกบิลรายเดือน</div>
          <div className="gen-cycle">รอบ {cycle}</div>
          <div className="gen-reason">{genReason}{market ? ` · กำหนดทุกวันที่ ${cycleDay} ของเดือน` : ""}</div>
        </div>
        <button className="btn primary gen-btn" onClick={generate} disabled={busy || !canGenerate} title={genReason}>
          {busy ? <span className="spin" /> : null} ออกบิลรอบ {cycle}
        </button>
      </div>

      {/* สรุปยอด */}
      <div className="bills-kpis">
        <div className="kpi"><div className="k">บิล{cycleF === "all" ? "ทั้งหมด" : "รอบนี้"}</div><div className="v">{shown.length}<span className="u">ใบ</span></div></div>
        <div className="kpi"><div className="k">ยอดรวม</div><div className="v">{money(sumTotal)}</div></div>
        <div className="kpi"><div className="k">ชำระแล้ว</div><div className="v">{money(sumPaid)}<span className="u">· {paidCount} ใบ</span></div></div>
        <div className={"kpi" + (sumUnpaid > 0.005 ? " danger" : " good")}><div className="k">ค้างชำระ</div><div className="v">{sumUnpaid > 0.005 ? money(sumUnpaid) : "ครบ"}</div></div>
      </div>

      {/* รอตรวจสลิป */}
      {pays.length > 0 && (
        <>
          <div className="section-h">รอตรวจสลิป <span className="sh-count">{pays.length}</span></div>
          <div className="slip-grid">
            {pays.map((p) => (
              <div className="slip-card" key={p._id}>
                {p.slip_image_url ? (
                  <img className="sc-thumb" src={p.slip_image_url} alt="slip" onClick={() => setSlip(p.slip_image_url)} />
                ) : (
                  <div className="sc-thumb sc-empty">ไม่มีสลิป</div>
                )}
                <div className="sc-body">
                  <div>
                    <div className="sc-room">ห้อง {code(p.unit_id)}</div>
                    <div className="sc-amt">{money(p.amount)}</div>
                  </div>
                  <div className="sc-actions">
                    <button className="btn ghost sm" onClick={() => reject(p._id)}>ปฏิเสธ</button>
                    <button className="btn primary sm" onClick={() => verify(p._id)}>ยืนยันจ่ายแล้ว</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ประวัติบิล */}
      <div className="section-h bills-hist-h">
        <span>ประวัติบิล <span className="sh-count">{shown.length}{cycleF !== "all" ? `/${bills.length}` : ""}</span></span>
        <select className="cycle-sel" value={cycleF} onChange={(e) => setCycleF(e.target.value)}>
          <option value="latest">รอบล่าสุด{cycles[0] ? ` (${cycles[0]})` : ""}</option>
          {cycles.map((c) => <option key={c} value={c}>รอบ {c}</option>)}
          <option value="all">ทุกรอบ ({cycles.length} เดือน)</option>
        </select>
      </div>
      {bills.length === 0 ? (
        <div className="card empty">ยังไม่มีบิล — กด “ออกบิลรอบ {cycle}” ด้านบน</div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>ห้อง</th><th>รอบ</th><th>ครบกำหนด</th><th className="num">ค่าน้ำ-ไฟ+อื่นๆ</th><th className="num">ยอดรวม</th><th className="num">ค้าง</th><th>สถานะ</th></tr>
            </thead>
            <tbody>
              {shown.map((b) => {
                const un = unpaidOf(b);
                return (
                  <tr key={b._id}>
                    <td><strong>{code(b.unit_id)}</strong></td>
                    <td className="mono-cell">{b.cycle}</td>
                    <td>{b.due_at ? new Date(b.due_at).toLocaleDateString("th-TH") : "-"}</td>
                    <td className="num">{money(b.subtotal)}</td>
                    <td className="num" style={{ fontWeight: 800 }}>{money(b.total)}</td>
                    <td className="num" style={{ color: un > 0.005 ? "var(--danger-ink)" : "var(--faint)", fontWeight: un > 0.005 ? 700 : 400 }}>{un > 0.005 ? money(un) : "—"}</td>
                    <td><span className={`pill ${b.status}`}>{billStatus(b.status)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {slip && (
        <div className="modal-bg" onClick={() => setSlip(null)}>
          <img src={slip} alt="slip" />
        </div>
      )}
    </AppTop>
  );
}
