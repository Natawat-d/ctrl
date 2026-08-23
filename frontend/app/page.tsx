import Link from "next/link";
import EquipmentShowcase from "@/components/EquipmentShowcase";
import MeterTwin from "@/components/MeterTwin";

const features: { n: string; t: string; d: string; img: string; alt: string }[] = [
  {
    n: "01",
    t: "ติดตั้งมิเตอร์ต่อห้อง",
    d: "แต่ละห้องมีมิเตอร์ไฟและมิเตอร์น้ำของตัวเอง ส่งค่าเข้าระบบเองอัตโนมัติ ไม่ต้องพึ่งการจดมือ",
    img: "/illus/energy-meter.svg",
    alt: "มิเตอร์ไฟฟ้าต่อห้อง",
  },
  {
    n: "02",
    t: "อ่านค่าอัตโนมัติ",
    d: "เห็นการใช้น้ำ-ไฟของทุกห้องแบบเรียลไทม์บนหน้าเดียว ไม่ต้องเดินจดมิเตอร์ทีละห้องอีกต่อไป",
    img: "/illus/gauge-sensor.svg",
    alt: "เกจวัดและเซนเซอร์อ่านค่า",
  },
  {
    n: "03",
    t: "ออกบิลรายเดือน",
    d: "ค่าเช่า + ค่าน้ำ + ค่าไฟ รวมอยู่ในบิลเดียว ระบบออกให้อัตโนมัติทุกรอบบิล พร้อมส่งถึงผู้เช่า",
    img: "/illus/terminal-blocks.svg",
    alt: "เทอร์มินอลบล็อกต่อสาย",
  },
  {
    n: "04",
    t: "รับชำระ-ตรวจสลิป",
    d: "ผู้เช่าแนบสลิปโอนเงินในระบบ เจ้าของกดยืนยันการชำระ ปิดยอดทุกห้องจบในที่เดียว",
    img: "/illus/lan-module.svg",
    alt: "โมดูลเชื่อมต่อเครือข่าย",
  },
];

export default function Home() {
  return (
    <div className="uni-page" id="top">
      {/* ===== 1. STICKY TOP NAV ===== */}
      <header className="uni-nav">
        <div className="uni-nav-inner">
          <a className="uni-brand" href="#top">
            <img className="logo-invert" src="/logo.png" alt="CTRL" />
            <span className="uni-brand-tag">monitoring &amp; billing</span>
          </a>
          <nav className="uni-nav-links">
            <a className="uni-nav-link" href="#features">คุณสมบัติ</a>
            <a className="uni-nav-link" href="#hardware">อุปกรณ์</a>
            <Link className="btn ghost on-dark" href="/login">เข้าสู่ระบบ</Link>
            <Link className="btn primary on-dark" href="/signup">สมัครใช้งาน</Link>
          </nav>
        </div>
      </header>

      {/* ===== 2. FULL-BLEED HERO (3D showpiece) ===== */}
      <section className="uni-hero">
        <div className="uni-hero-copy">
          <span className="uni-eyebrow">ระบบมิเตอร์น้ำ-ไฟ สำหรับห้องเช่า</span>
          <h1 className="uni-hero-title">
            อ่านมิเตอร์น้ำ-ไฟทุกห้อง
            <br />
            ออกบิลรายเดือนอัตโนมัติ
          </h1>
          <p className="uni-hero-sub">
            สำหรับหอพัก อพาร์ตเมนต์ และคอนโด — เลิกเดินจดมิเตอร์เอง ระบบอ่านค่า
            รวมค่าเช่า ออกบิล และรับชำระให้จากที่เดียว
          </p>
          <div className="uni-hero-cta">
            <Link className="btn primary on-dark uni-cta-primary" href="/signup">เริ่มใช้งาน <span className="uni-arrow">→</span></Link>
            <Link className="btn ghost on-dark" href="#features">ดูการทำงาน</Link>
          </div>
        </div>
        <div className="uni-hero-media">
          <MeterTwin kind="cabinet" />
        </div>
      </section>

      {/* ===== 3. ALTERNATING FEATURE BLOCKS ===== */}
      <section className="uni-features" id="features">
        <div className="uni-section-head">
          <span className="uni-eyebrow">การทำงาน</span>
          <h2 className="uni-section-title">ครบทั้งวงจร ตั้งแต่มิเตอร์ถึงบิล</h2>
        </div>
        {features.map((f, i) => (
          <article className={`uni-feature${i % 2 === 1 ? " reverse" : ""}`} key={f.n}>
            <div className="uni-feature-media">
              <img src={f.img} alt={f.alt} />
            </div>
            <div className="uni-feature-copy">
              <span className="uni-feature-n">{f.n}</span>
              <h3 className="uni-feature-title">{f.t}</h3>
              <p className="uni-feature-desc">{f.d}</p>
              <Link className="uni-more" href="/signup">ดูเพิ่มเติม <span className="uni-arrow">→</span></Link>
            </div>
          </article>
        ))}
      </section>

      {/* ===== 4. FEATURED EQUIPMENT GRID ===== */}
      <div id="hardware">
        <EquipmentShowcase />
      </div>

      {/* ===== 5. CLOSING CTA ===== */}
      <section className="uni-cta-band">
        <h2 className="uni-cta-title">พร้อมเลิกเดินจดมิเตอร์แล้วหรือยัง</h2>
        <p className="uni-cta-sub">เริ่มติดตั้งระบบมอนิเตอร์น้ำ-ไฟ และออกบิลรายเดือนให้อาคารของคุณวันนี้</p>
        <div className="uni-hero-cta">
          <Link className="btn primary on-dark uni-cta-primary" href="/signup">สมัครใช้งาน <span className="uni-arrow">→</span></Link>
          <Link className="btn ghost on-dark" href="/login">เข้าสู่ระบบ</Link>
        </div>
      </section>

      {/* ===== 6. FOOTER ===== */}
      <footer className="uni-footer">
        <div className="uni-footer-top">
          <div className="uni-footer-brand">
            <img className="logo-invert" src="/logo.png" alt="CTRL" />
            <p>ระบบมอนิเตอร์น้ำ-ไฟ และออกบิลรายเดือน สำหรับอาคารเช่า</p>
          </div>
          <nav className="uni-footer-links">
            <a href="#features">คุณสมบัติ</a>
            <a href="#hardware">อุปกรณ์</a>
            <Link href="/login">เข้าสู่ระบบ</Link>
            <Link href="/signup">สมัครใช้งาน</Link>
          </nav>
        </div>
        <div className="uni-footer-bottom">
          <span className="uni-footer-meta">© {new Date().getFullYear()} CTRL — ctrlanywhere.com</span>
        </div>
      </footer>
    </div>
  );
}
