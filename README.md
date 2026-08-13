# ⚡💧 arkara_smart_electric

ระบบ **Smart Submetering + Billing** — วัดน้ำ-ไฟรายห้อง/รายแผง + ออกบิลอัตโนมัติ
รองรับ 2 สายผลิตภัณฑ์ที่ **ต่างกันทั้งฮาร์ดแวร์และข้อกฎหมาย**

| สายผลิตภัณฑ์ | เครือข่ายฮาร์ดแวร์ | ตัดน้ำ-ตัดไฟ | เอกสาร | BOM |
|-------------|-------------------|-------------|--------|-----|
| 🏪 **ตลาด / แผงค้า** | **ESP32 mesh (ESP-NOW)** | ✅ **มี** | [docs/product/market/](docs/product/market/) | [hardware/market-mesh/](hardware/market-mesh/) |
| 🏢 **คอนโด / ที่พักอาศัย** | RS485 wired — ตู้มิเตอร์ประจำชั้น (riser) | ❌ **ไม่มี** | [docs/product/condo/](docs/product/condo/) | [hardware/condo-metering/](hardware/condo-metering/) |

> 🔴 **ทำไมคอนโดไม่มีตัดน้ำ-ไฟ:** [ฎีกา 10230/2553](https://www.tnews.co.th/social/353780) — นิติบุคคลอาคารชุดต้องบังคับหนี้ค่าส่วนกลาง **ทางศาลเท่านั้น** การตัดน้ำ-ไฟถือเป็นการละเมิดสิทธิ์เจ้าของร่วม
> และห้องเช่าเพื่ออยู่อาศัย ≥5 ห้อง อยู่ใต้ [ประกาศ คกก.ว่าด้วยสัญญาฯ 2562](https://www.ddproperty.com/คู่มือซื้อขาย/กฎหมายควบคุมสัญญาเช่าฉบับปี-2562-55764) ซึ่ง **ห้ามเก็บค่าน้ำ-ไฟเกินอัตราที่การไฟฟ้า/ประปาเรียกเก็บจริง**
> → ระบบต้องมี flag `site.cutoff_enabled` ปิดตายระดับไซต์ ไม่ใช่แค่ซ่อนปุ่มใน UI

---

## 📁 โครงสร้างโปรเจกต์

```
arkara_smart_electric/
├── README.md                         ← คุณอยู่ตรงนี้
│
├── docs/                             📄 เอกสารออกแบบ
│   ├── 00-overview.md                   ภาพรวมระบบ · actors · tech stack
│   ├── 08-tasks.md                      roadmap + checklist (เริ่มลงมือที่นี่)
│   ├── platform/                        ใช้ร่วมกันทั้ง 2 สายผลิตภัณฑ์
│   │   ├── 02-protocol-server.md           Gateway ↔ Server (MQTT)
│   │   ├── 03-data-model.md                MongoDB schema
│   │   ├── 04-backend-api.md               REST/WS API
│   │   ├── 05-frontend.md                  Next.js
│   │   ├── 06-billing.md                   เอนจินบิล
│   │   ├── 07-deployment.md                docker-compose / VPS
│   │   ├── design-system-standards.md      มาตรฐาน UI
│   │   ├── server_VPS.md · firebase.md     ข้อมูลเซิร์ฟเวอร์ / auth
│   ├── decisions/                       บันทึกการตัดสินใจ + สเปกดั้งเดิม
│   └── product/{market,condo}/          สเปกเฉพาะสายผลิตภัณฑ์
│
├── hardware/                         🔌 ฮาร์ดแวร์
│   ├── common/                          ⭐ ใช้ร่วมกันทั้ง 2 สาย
│   │   ├── system-wiring-design.md         คู่มือวิศวกรรมหลัก — RS485, connector,
│   │   │                                    register map, การต่อขั้วทีละตู้
│   │   ├── ref_hardware.md                 ลิงก์ซื้อของทุกชิ้น
│   │   ├── datasheets/                     คู่มือ + register map มิเตอร์
│   │   └── diagrams/                       ผังระบบ + schematic ระดับขั้วต่อ (SVG)
│   ├── market-mesh/                     🏪 BOM + ไดอะแกรม (มีตัดน้ำไฟ)
│   └── condo-metering/                  🏢 BOM (ไม่มีตัดน้ำไฟ)
│
├── frontend/                         💻 Next.js (app / models / controllers / services / store)
├── infra/                            🚀 Caddy + Mosquitto
├── ref_UI/                           🎨 reference UI
├── docker-compose.yml
└── archive/                          📦 ไฟล์เก่า (.rar / .zip)
```

---

## 🚀 เริ่มตรงไหน

| อยากทำอะไร | ไปที่ |
|-----------|-------|
| เข้าใจภาพรวมระบบ | [docs/00-overview.md](docs/00-overview.md) |
| ลงมือเขียนโค้ด | [docs/08-tasks.md](docs/08-tasks.md) |
| ต่อฮาร์ดแวร์จริง | [hardware/common/system-wiring-design.md](hardware/common/system-wiring-design.md) |
| ดูผังการต่อ (SVG) | [hardware/common/diagrams/](hardware/common/diagrams/) |
| ทำใบเสนอราคา | [market-mesh/](hardware/market-mesh/) · [condo-metering/](hardware/condo-metering/) |
| deploy | [docs/platform/07-deployment.md](docs/platform/07-deployment.md) · live: http://147.50.254.104/ctrl |

## วิธีรัน (local)

> ต้องเปิด **Docker Desktop** ก่อน

```bash
cp .env.example .env
docker compose up -d mongo mqtt          # infra
cd frontend && npm install
node scripts/seed.mjs                    # seed ข้อมูลตัวอย่าง
npm run dev                              # → http://localhost:3000
```

หรือทั้งหมดในคอนเทนเนอร์: `docker compose up -d --build`

### บัญชีทดสอบ (หลัง seed)

| บทบาท | login_id | password |
|-------|----------|----------|
| Platform admin | `admin` | `admin1234` |
| เจ้าของตลาด | `arkara@owner` | `owner1234` |

## Tech stack

`Next.js (SSR + API routes)` · `MongoDB (Time-Series)` · `MQTT (self-host)` · `Docker / Caddy`
ฮาร์ดแวร์: `ESP32 (ESP-NOW mesh)` · `Modbus RTU / RS485` · `Mini PC gateway`
