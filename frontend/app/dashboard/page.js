"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import Link from "next/link";
import AppTop from "@/components/AppTop";
import Icon from "@/components/Icon";
import { api, getToken } from "@/lib/api";
import { isOnline } from "@/lib/device";
import { selectUser } from "@/store/authSlice";
import { useActiveMarket } from "@/store/hooks";

const fmt = (n) => (n == null ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }));

function Stat({ icon, cls, k, v, u }) {
  return (
    <div className="card stat">
      <div className={"ico " + cls}><Icon name={icon} /></div>
      <div>
        <div className="k">{k}</div>
        <div className="v">{v} {u && <span className="u">{u}</span>}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const market = useActiveMarket();
  const user = useSelector(selectUser);
  const [ov, setOv] = useState(null);
  const [zones, setZones] = useState([]);
  const [units, setUnits] = useState([]);
  const [devices, setDevices] = useState([]);
  const [err, setErr] = useState("");

  const zoneWord = "ตึก";
  const unitWord = "ห้อง";

  const load = useCallback(async () => {
    if (!market) return;
    try {
      setOv(await api(`/markets/${market._id}/overview`));
      setZones((await api(`/zones?market_id=${market._id}`)).items || []);
      setUnits((await api(`/units?market_id=${market._id}`)).items || []);
      setDevices((await api(`/devices?market_id=${market._id}`)).items || []);
    } catch (e) { setErr(e.message); }
  }, [market]);

  useEffect(() => { if (!getToken()) router.push("/login"); }, [router]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const devByUnit = {};
  for (const d of devices) if (d.unit_id) (devByUnit[String(d.unit_id)] ||= []).push(d);
  const byZone = (zid) => units.filter((u) => String(u.zone_id) === String(zid));
  const unzoned = units.filter((u) => !u.zone_id || !zones.some((z) => String(z._id) === String(u.zone_id)));

  function UnitsTable({ list }) {
    return (
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>{unitWord}</th><th>ชั้น</th><th>มิเตอร์</th><th className="num">ค่าเช่า/เดือน</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const ds = devByUnit[String(u._id)] || [];
              const onCnt = ds.filter(isOnline).length;
              return (
                <tr key={u._id}>
                  <td><Link className="rowlink" href={`/units/${u._id}`}>{u.code}</Link><div style={{ color: "var(--faint)", fontSize: 11.5 }}>{u.name}</div></td>
                  <td>{u.floor ? `ชั้น ${u.floor}` : "-"}</td>
                  <td>{ds.length ? <span className={`dot ${onCnt === ds.length ? "on" : "off"}`}>{onCnt}/{ds.length} ออนไลน์</span> : <span style={{ color: "var(--faint)", fontSize: 11.5 }}>ยังไม่ผูก</span>}</td>
                  <td className="num">฿{(u.rent || 0).toLocaleString()}</td>
                  <td className="tight"><Link className="btn ghost sm" href={`/units/${u._id}`}>จัดการ</Link></td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--faint)", padding: 20 }}>ยังไม่มี{unitWord}ใน{zoneWord}นี้</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <AppTop title={market?.name || "แดชบอร์ด"} sub="ภาพรวมการใช้น้ำ-ไฟวันนี้"
      actions={<Link className="btn ghost" href="/settings"><Icon name="plus" /> เพิ่ม{zoneWord}/{unitWord}</Link>}>
      {err && <div className="err">{err}</div>}
      {user?.verified === false && <div className="warn-banner">⚠️ ยังไม่ยืนยันอีเมล — โปรดคลิกลิงก์ยืนยันในอีเมลของคุณเพื่อเปิดใช้งานครบทุกฟังก์ชัน</div>}
      <div className="stats">
        <Stat icon="grid" cls="ink" k="ห้องทั้งหมด" v={ov?.units ?? "-"} />
        <Stat icon="users" cls="good" k="มีผู้เช่า" v={ov?.occupied ?? "-"} />
        <Stat icon="power" cls="ink" k="มิเตอร์ออนไลน์" v={ov ? `${ov.online}/${ov.devices}` : "-"} />
        <Stat icon="bolt" cls="elec" k="ไฟวันนี้" v={fmt(ov?.elec_kwh_today)} u="kWh" />
        <Stat icon="drop" cls="water" k="น้ำวันนี้" v={fmt(ov?.water_m3_today)} u="m³" />
      </div>

      {zones.length === 0 && unzoned.length === 0 && (
        <div className="card empty" style={{ marginTop: 22 }}>ยังไม่มี{zoneWord}/{unitWord} — เพิ่มได้ที่หน้า <Link href="/settings" style={{ color: "var(--primary)", fontWeight: 700 }}>ตั้งค่า</Link></div>
      )}

      {zones.map((z) => (
        <div key={z._id}>
          <div className="section-h">{z.name} <span style={{ color: "var(--faint)", fontWeight: 500 }}>({byZone(z._id).length})</span></div>
          <UnitsTable list={byZone(z._id)} />
        </div>
      ))}

      {unzoned.length > 0 && (
        <div>
          <div className="section-h">ไม่ระบุ{zoneWord} <span style={{ color: "var(--faint)", fontWeight: 500 }}>({unzoned.length})</span></div>
          <UnitsTable list={unzoned} />
        </div>
      )}
    </AppTop>
  );
}
