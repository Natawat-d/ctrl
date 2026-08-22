import Link from "next/link";
import Icon from "@/components/Icon";
import EquipmentShowcase from "@/components/EquipmentShowcase";
import { HeroBlueprint } from "@/components/Blueprint";
import WattMeterTwin from "@/components/WattMeterTwin";

const steps = [
  { icon: "grid", t: "ติดตั้งมิเตอร์ต่อห้อง", d: "แต่ละห้องมีมิเตอร์ไฟและมิเตอร์น้ำ ส่งค่าเข้าระบบเอง" },
  { icon: "bolt", t: "อ่านค่าอัตโนมัติ", d: "เห็นการใช้น้ำ-ไฟของทุกห้องแบบเรียลไทม์ ไม่ต้องเดินจด" },
  { icon: "receipt", t: "ออกบิลรายเดือน", d: "ค่าเช่า + ค่าน้ำ + ค่าไฟ รวมในบิลเดียว ออกให้อัตโนมัติทุกรอบ" },
  { icon: "users", t: "รับชำระ-ตรวจสลิป", d: "ผู้เช่าแนบสลิปในระบบ เจ้าของกดยืนยัน ปิดยอดจบในที่เดียว" },
];

export default function Home() {
  return (
    <div className="public-bg">
      <section className="hero-band dark-band">
        <HeroBlueprint />
        <div className="landing">
          <nav className="public-nav">
            <div className="public-brand"><img className="logo-img logo-invert" src="/logo.png" alt="CTRL" /> <span className="pb-tag">monitoring &amp; billing</span></div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link className="btn ghost on-dark" href="/login">เข้าสู่ระบบ</Link>
              <Link className="btn primary on-dark" href="/signup">สมัครใช้งาน</Link>
            </div>
          </nav>
          <div className="hero">
            <img className="hero-logo" src="/logo.png" alt="CTRL" />
            <span className="tag">ระบบมิเตอร์น้ำ-ไฟ สำหรับห้องเช่า</span>
            <h1>อ่านมิเตอร์น้ำ-ไฟทุกห้อง<br />ออกบิลรายเดือนอัตโนมัติ</h1>
            <p>สำหรับหอพัก อพาร์ตเมนต์ และคอนโด — เลิกเดินจดมิเตอร์เอง ระบบอ่านค่า รวมค่าเช่า ออกบิล และรับชำระให้จากที่เดียว</p>
            <Link className="btn primary on-dark" href="/signup">เริ่มใช้งาน →</Link>
          </div>
        </div>
      </section>
      <div className="landing">
        <div className="steps">
          {steps.map((s, i) => (
            <div className="step" key={i}>
              <div className="n"><Icon name={s.icon} /></div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
      <section className="twin-band dark-band">
        <div className="landing">
          <div className="equip-head">
            <span className="tag">Digital Twin</span>
            <h2>มิเตอร์เสมือนจริง แบบ 3D</h2>
            <p>โมเดล 3 มิติของมิเตอร์ไฟ อ่านค่าแบบเรียลไทม์ — ภาพจำลองที่สะท้อนอุปกรณ์จริงในระบบ</p>
          </div>
          <WattMeterTwin />
        </div>
      </section>
      <EquipmentShowcase />
    </div>
  );
}
