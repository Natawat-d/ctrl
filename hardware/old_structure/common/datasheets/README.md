# 📂 Datasheets & Modbus Register Maps — arkara_smart_electric

คู่มือ/ดาต้าชีต + แผนที่ register (Modbus) ของมิเตอร์ที่แนะนำ ดาวน์โหลดไว้อ่านออฟไลน์
ดาวน์โหลดเมื่อ 2026-07-23

---

## ⚡ มิเตอร์ไฟฟ้า

| ไฟล์ | ใช้กับ | เนื้อหา | ที่มา |
|------|--------|---------|-------|
| [PZEM-016_Modbus_TH.pdf](electric/PZEM-016_Modbus_TH.pdf) | PZEM-016 (1 เฟส) | คู่มือ + register map **ภาษาไทย** (14 หน้า) | [ETT](https://www.etteam.com/productI2C_RS485/PZEM_016_MODBUS/man_th_PZEM-016-Modbus-RTU.pdf) |
| [SDM120_Modbus_Protocol_TH-ETT.pdf](electric/SDM120_Modbus_Protocol_TH-ETT.pdf) | Eastron SDM120 | โปรโตคอล Modbus (ไทย, ETT) | [ETT](https://www.etteam.com/productDIN/SDM120-MODBUS/SDM120-PROTOCOL.pdf) |
| [SDM120_Modbus_Protocol.pdf](electric/SDM120_Modbus_Protocol.pdf) | Eastron SDM120 | โปรโตคอล register ทางการ (EN) | [Eastron EU](https://www.eastroneurope.com/images/uploads/products/protocol/SDM120-MODBUS_Protocol.pdf) |
| [SDM120_User_Manual.pdf](electric/SDM120_User_Manual.pdf) | Eastron SDM120 | คู่มือติดตั้ง + wiring (EN) | [Eastron](https://www.eastrongroup.com/) |
| [SDM630_ModbusV2_User_Manual.pdf](electric/SDM630_ModbusV2_User_Manual.pdf) | Eastron SDM630 V2 (3 เฟส) | คู่มือ + register map เต็ม (EN) | [Photonic Universe](https://www.photonicuniverse.com/upload/file/Manuals/Iconica/IC-METER/SDM630-Modbus_V2_user_manual.pdf) |

### แผนที่ register ที่ใช้บ่อย (สรุปเร็ว)

**PZEM-016** — อ่านด้วย Function `0x04` (Input Register), address เริ่มต้น = `0x01`
| ค่า | Register | หน่วย/ตัวคูณ |
|-----|----------|--------------|
| Voltage | `0x0000` | 0.1 V |
| Current | `0x0001–0x0002` | 0.001 A |
| Power | `0x0003–0x0004` | 0.1 W |
| Energy (สะสม) | `0x0005–0x0006` | 1 Wh |
| Frequency | `0x0007` | 0.1 Hz |
| Power Factor | `0x0008` | 0.01 |
| ตั้ง Slave Address | `0x0002` (FC `0x06` holding) | 0x01–0xF7 |

**SDM120 / SDM630** — อ่านด้วย Function `0x04`, ค่าเป็น **float32 (2 register)**
| ค่า | Register |
|-----|----------|
| Voltage (V) | `0x0000` |
| Current (A) | `0x0006` |
| Active Power (W) | `0x000C` |
| Frequency (Hz) | `0x0046` |
| Import Energy (kWh) | `0x0048` |
| **Total Energy (kWh)** | `0x0156` |

> SDM630 มีค่าครบ 3 เฟส (V/A/W แยกเฟส L1/L2/L3) — ดู register เต็มในไฟล์คู่มือ

---

## 💧 มิเตอร์น้ำดิจิทัล

| ไฟล์ | ใช้กับ | เนื้อหา | ที่มา |
|------|--------|---------|-------|
| [WaterMeter_Ultrasonic_WM9100_Modbus.pdf](water/WaterMeter_Ultrasonic_WM9100_Modbus.pdf) | อัลตราโซนิก (OEM DN15–DN40) | คู่มือ + **register map Modbus เต็ม** (19 หน้า) | [Lanry](https://www.lanry-instruments.com/uploads/WM9100-Ultrasonic-Water-Meter-Manual-Lanry.pdf) |
| [WaterMeter_VN2000_Modbus_Registers.pdf](water/WaterMeter_VN2000_Modbus_Registers.pdf) | flow meter (ตัวอย่าง totalizer) | ตาราง register flow/totalizer | [Instrumart](https://www.instrumart.com/assets/VN2000-modbus-manual.pdf) |

**3 แบบของมิเตอร์น้ำดิจิทัล — เลือกตามงบ/ความแม่น**

| แบบ | หลักการวัด | ส่งข้อมูล | ข้อดี | ราคา |
|-----|-----------|-----------|-------|------|
| **Pulse output** | ใบพัดจักรกล + reed switch | นับพัลส์ (GPIO) | ถูกสุด ต่อ MCU ง่ายสุด | ~300–800฿ |
| **Photoelectric direct-reading** | อ่านเลขหน้าปัดด้วยแสง | RS485 / M-Bus | error = 0 (อ่านเลขจริง) ไม่กินไฟ | ~1,000–2,500฿ |
| **Ultrasonic** | จับเวลาคลื่นเสียง (ไม่มีชิ้นส่วนหมุน) | RS485 Modbus / M-Bus | แม่นสุด ทน 10+ ปี | ~5,000–17,000฿ |

**พารามิเตอร์สื่อสารมาตรฐาน:** 9600 bps · 8N1 · address 1–255 · อ่านด้วย FC `0x03` (Holding Register)

**Register map (จาก WM9100 อัลตราโซนิก — รุ่น OEM ส่วนใหญ่ใกล้เคียงกัน):**
| ค่า | Register | Data type |
|-----|----------|-----------|
| อัตราการไหล (m³/h) | `02` | float |
| **ปริมาตรสุทธิ Net volume (m³)** ← ค่าน้ำที่ใช้ | `08` | float |
| ปริมาตรไหลไป Positive (m³) | `12` | float |
| ปริมาตรไหลกลับ Negative (m³) | `16` | double |
| ตั้ง address / baud (RS485 control) | `46` | uint |

> ⚠️ register ของ OEM แต่ละเจ้าอาจต่างกันเล็กน้อย — **ยึด datasheet ที่มากับมิเตอร์ที่ซื้อจริงเป็นหลัก** ไฟล์นี้ใช้เป็น reference โครงสร้าง

**รุ่น/ร้านในไทย:**
- **Water Flow Meter RS485 (DN15/20/25)** — [Miniature Solution](https://www.miniature-solution.com/category/23/)
- **DMeter-DN20** — [Miniature Solution](https://www.miniature-solution.com/product/3012/)
- **Ultrasonic DN20 SSW302 E3RO** — [S2 Innovation](https://s2ins.com/product/ultrasonic-water-flow-meter-e3ro-dn20-rs485-modbus-steel-galvanize/)

> 💡 **แบบ Pulse output** ไม่ต้องใช้ register — นับพัลส์ที่ขา GPIO (เช่น 1 พัลส์ = 1 ลิตร) ตรวจสอบค่า L/pulse ที่หน้าปัดมิเตอร์

---

## 🔀 อุปกรณ์ควบคุม (Control / Actuator) — เปิด-ปิด น้ำ/ไฟ

**หลักการ:** มิเตอร์วัด → MCU ตัดสินใจ (เช่น เกินโควตา/นอกเวลา) → สั่ง actuator เปิด-ปิด

### ⚡ ควบคุมไฟ
| อุปกรณ์ | เหมาะกับ | รับได้ | ราคา |
|---------|----------|--------|------|
| **Relay Module** (5V 1–8ch) | โหลดเล็ก / ขับคอยล์คอนแทกเตอร์ | ≤10A | 30–150฿ |
| **SSR Fotek** (solid state) | ปั๊ม/ฮีตเตอร์ AC สลับบ่อย เงียบ | 25–40A | 120–214฿ ✓ |
| **Magnetic Contactor** (แมกเนติก) | วงจรใหญ่ / 3 เฟส / กระแสสูง | 18–40A+ | 250–700฿ |
| ⭐ **Modbus 8-ch Relay Board** (RS485) | คุมผ่าน**บัสเดียวกับมิเตอร์** | 10A/ch | 525฿ ✓ |

> ⚠️ **ห้าม**สวิตช์ไฟบ้าน/3 เฟส กระแสสูงด้วยรีเลย์เล็กตรงๆ — ให้รีเลย์/MCU ไปขับ **คอยล์ของแมกเนติกคอนแทกเตอร์** แล้วคอนแทกเตอร์ตัด-ต่อไฟหลักแทน

### 💧 ควบคุมน้ำ
| อุปกรณ์ | เหมาะกับ | ข้อสังเกต | ราคา |
|---------|----------|-----------|------|
| **Solenoid Valve NC** | ชลประทาน/เครื่องใช้ เปิด-ปิดเร็ว | ต้องจ่ายไฟค้างตอนเปิด, ต้องมีแรงดันขั้นต่ำ | 329–800฿ ✓ |
| ⭐ **Motorized Ball Valve** (2-wire) | ท่อเมนหลัก full bore | ค้างตำแหน่งไม่กินไฟ, ช้ากว่า (~5วิ) | 600–1,200฿ |

> 💡 วาล์วน้ำ 12/24V ต้องมี **แหล่งจ่ายไฟแยก** + ให้ relay เป็นตัวจ่าย/ตัดไฟให้วาล์ว

### 🔗 สถาปัตยกรรมแนะนำ (คุมทุกอย่างบนสาย RS485 เดียว)
```
                  ┌── มิเตอร์ไฟ (addr 1)  → อ่าน kWh
MCU ── RS485 bus ─┼── มิเตอร์น้ำ (addr 2)  → อ่าน m³
(เลือกเอง)        └── Modbus Relay 8ch (addr 3) → สั่งเปิด-ปิด
                                  ├─ ch1 → คอยล์ Contactor (ไฟ)
                                  └─ ch2 → Motorized valve (น้ำ)
```
> MCU เลือกเองได้เลย (ESP32/STM32/Arduino/PLC) — บอร์ด Modbus relay มี RS485 ในตัว ไม่ต้องมี transceiver แยก
รายละเอียด + ราคา + ลิงก์ซื้อ ดูชีต **"อุปกรณ์ควบคุม"** ใน [เปรียบเทียบราคามิเตอร์.xlsx](เปรียบเทียบราคามิเตอร์.xlsx)

---

## 🔗 ดูสรุปทั้งหมด (ตารางเทียบรุ่น + ราคา + วงจร + โค้ด)
Artifact: https://claude.ai/code/artifact/e0790e1d-6dc0-42f5-8796-786f3a410c2e
