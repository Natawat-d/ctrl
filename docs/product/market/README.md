# 🏪 ตลาด / แผงค้า — สเปกเฉพาะสาย

> **มีตัดน้ำ-ตัดไฟ** (สัญญาเช่าเชิงพาณิชย์ ทำได้) · เครือข่าย **ESP32 mesh (ESP-NOW)**
> ฮาร์ดแวร์ + BOM: [`../../../hardware/market-mesh/`](../../../hardware/market-mesh/README.md)

## 📄 เอกสาร

| ไฟล์ | เนื้อหา |
|------|---------|
| [01-protocol-mesh.md](01-protocol-mesh.md) | โปรโตคอล mesh — binary packet 12B header + AES + short-id 2B + ACK + multi-hop |

## 🔑 สรุปโปรโตคอล

- ทุกแผง = 1 **node** (ESP32, ESP-NOW Long-Range) · 1 ตลาด = 1 **gateway** (bridge ESP-NOW ↔ MQTT)
- โหนดไกล gateway → **hop ผ่านโหนดข้าง ๆ**
- ทุกโหนดในตลาดเดียวใช้ **AES key เดียวกัน** (per-market) + `market_short` เดียวกัน
- short-id 2 ไบต์/device · `0x0000` = gateway · `0xFFFF` = broadcast

## ⚡ ตรรกะตัดจ่าย (fail-safe)

| สถานะ | แผงค้า |
|-------|--------|
| ปกติ | ✔ มีไฟ/มีน้ำ |
| สั่งตัด | ✘ ตัด |
| **โหนดดับ / mesh ขาด / gateway ล่ม** | ✔ **มีไฟ/มีน้ำ** |

ทำได้เพราะเลือก **คอนแทกเตอร์ 2NC** (ไฟ) และ **วาล์ว NO** (น้ำ) → คอยล์ไม่มีไฟ = จ่ายปกติ
ผู้เช่าจะไม่โดนตัดเพราะระบบเรามีปัญหา ซึ่งเป็นเรื่องที่ต้องเลี่ยงที่สุดในเชิงสัญญาเช่า

## ⏳ งานที่ยังค้าง

ดู "🔴 สถานะ" ใน [hardware/market-mesh/README.md](../../../hardware/market-mesh/README.md) —
BOM ปัจจุบันยังเป็นเวอร์ชัน RS485 เดินสาย ต้องแปลงเป็น mesh ก่อนใช้ยื่นราคาจริง
