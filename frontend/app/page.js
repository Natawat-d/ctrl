import Link from "next/link";
import Icon from "@/components/Icon";

const steps = [
  { icon: "grid", bg: "var(--water-soft)", c: "var(--water-ink)", t: "ติดตั้งมิเตอร์ต่อห้อง", d: "แต่ละห้องมีมิเตอร์ไฟและมิเตอร์น้ำ ส่งค่าเข้าระบบเอง" },
  { icon: "bolt", bg: "var(--elec-soft)", c: "var(--elec-ink)", t: "อ่านค่าอัตโนมัติ", d: "เห็นการใช้น้ำ-ไฟของทุกห้องแบบเรียลไทม์ ไม่ต้องเดินจด" },
  { icon: "receipt", bg: "var(--good-soft)", c: "var(--good-ink)", t: "ออกบิลรายเดือน", d: "ค่าเช่า + ค่าน้ำ + ค่าไฟ รวมในบิลเดียว ออกให้อัตโนมัติทุกรอบ" },
  { icon: "users", bg: "var(--primary-soft)", c: "var(--primary-ink)", t: "รับชำระ-ตรวจสลิป", d: "ผู้เช่าแนบสลิปในระบบ เจ้าของกดยืนยัน ปิดยอดจบในที่เดียว" },
];

export default function Home() {
  return (
    <div className="public-bg">
    <div className="landing">
      <nav className="public-nav">
        <div className="public-brand"><span className="logo">CT</span> CTRL <span style={{ color: "#8b98a0", fontWeight: 500, fontSize: 14 }}>monitoring & billing</span></div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn ghost" href="/login">เข้าสู่ระบบ</Link>
          <Link className="btn primary" href="/signup">สมัครใช้งาน</Link>
        </div>
      </nav>
      <div className="hero">
        <span className="tag">ระบบมิเตอร์น้ำ-ไฟ สำหรับห้องเช่า</span>
        <h1>อ่านมิเตอร์น้ำ-ไฟทุกห้อง<br />ออกบิลรายเดือนอัตโนมัติ</h1>
        <p>สำหรับหอพัก อพาร์ตเมนต์ และคอนโด — เลิกเดินจดมิเตอร์เอง ระบบอ่านค่า รวมค่าเช่า ออกบิล และรับชำระให้จากที่เดียว</p>
        <Link className="btn primary" href="/signup">เริ่มใช้งาน →</Link>
      </div>
      <div className="steps">
        {steps.map((s, i) => (
          <div className="step" key={i}>
            <div className="n" style={{ background: s.bg, color: s.c }}><Icon name={s.icon} /></div>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
