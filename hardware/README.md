# 🔌 hardware

จัดโครงสร้างใหม่ · 2026-08-11

```
hardware/
├── stm32-water-controller/   ⭐ ตู้ควบคุมวัดน้ำ STM32H743 (นับพัลส์ + LAN + RS485 + LCD ในตัว)
└── old_structure/            📦 งานเดิมทั้งหมด (เก็บไว้อ้างอิง)
```

## ⭐ [stm32-water-controller/](stm32-water-controller/) — แนวทางปัจจุบัน
ตู้ควบคุมวัดน้ำแบบ **บอร์ดเดียวจบ** ใช้ **STM32H743VIT6** เป็นตัวนับพัลส์ + เก็บลง SD + มี LAN/RS485/LCD ในตัว
(ต่างจากของเดิมที่ใช้ Mini PC + gateway ประจำชั้น + ESP32 IO แยก)

## 📦 [old_structure/](old_structure/) — งานเดิม
- `common/` — คู่มือวิศวกรรม RS485/Modbus, datasheets, เปรียบเทียบราคามิเตอร์
- `condo-metering/` — แนวทาง Mini PC 4×LAN + RS485-to-LAN ประจำชั้น + Pulse Counter (BOM 8/16/24 ห้อง, ต้นทุนแยกหมวด, diagram + server)
- `market-mesh/` — ตลาด: ESP32 mesh + ตัดน้ำ-ตัดไฟ
- `diagrams/`, `README.md` (เดิม)
