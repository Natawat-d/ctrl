# Prompt สร้างรูปตู้ (สำหรับ GPT-4o / DALL·E)

> วางทั้งบล็อกด้านล่างให้ GPT ได้เลย · อิง layout + สเปกจาก `diagrams_water (1).xlsx`

---

## 🎨 MAIN PROMPT (English — paste this)

A photorealistic, brightly-lit front interior view of an **industrial electrical control cabinet** with its door open, wall-mounted, light-grey powder-coated steel enclosure with ventilation slots (GLINK GCB-04 style, "number 4" indoor switchboard). Everything is mounted on horizontal 35 mm aluminium DIN rails inside white plastic cable-duct trunking, with neat color-coded wiring. Clean professional panel-build, straight-on engineering photograph, high detail, sharp focus, soft even studio lighting.

**LAYOUT — organised in clear zones:**

**TOP-LEFT (power in):** A single-phase **AC 220V** cable enters through a nylon cable gland at the top-left corner (brown + blue + green/yellow earth wires). It feeds two DIN-rail switching power supplies mounted side by side: a **MEAN WELL 24V unit (MDR-60-24)** and a smaller **5V unit (MDR-20-5)**, both slim metal DIN-rail bricks with screw terminals and printed labels. Wiring leaves them color-coded: a **24V rail** and a **5V rail**.

**CENTER (the brain — custom PCB):** A rectangular **custom green/blue PCB "break-out board"** sits in the middle on standoffs. At its heart is a black **STM32H743 module (WeAct MiniSTM32H7)** with a microSD slot. Along the **top edge of the PCB** is a neat row of about **16 green KF301 5.08 mm 2-pin screw terminal blocks**. On the board also sit: a tiny **MINI560 buck converter labelled "5V→3.3V"**, and a **W5500 Ethernet module with an RJ45 jack**, wired to the STM32 by a short **SPI** ribbon. Two small **TTL pin headers** labelled **TTL1** and **TTL2** exit the board.

**BELOW the PCB (sensor isolation):** Two long **16-channel optocoupler isolation boards** (black boards with two rows of small LEDs and screw terminals), stacked, giving **32 isolated NPN channels total**, marked **input 24V → output 3.3V**. The **24V rail** feeds their input side; their isolated outputs run up into the PCB.

**RIGHT side on DIN rail (serial converters):** Two grey **DIN-rail isolated converter modules** with screw terminals: the upper one labelled **"TTL → RS485"** (fed from TTL1), the lower one labelled **"TTL → RS232"** (fed from TTL2). Waveshare-style rail-mount enclosures.

**EXTERNAL PANEL PORTS (on the cabinet wall, exactly three, in a neat vertical column, each labelled):**
- **1× LAN** — a single panel-mount **RJ45 Ethernet coupler socket**, wired from the **W5500 module's RJ45** on the PCB (for cabinet-to-cabinet daisy-chain).
- **1× RS485** — a single panel-mount **RS485 connector** (screw-terminal A/B/GND bulkhead), wired from the **TTL→RS485** converter output.
- **1× RS232** — a single panel-mount **RS232 connector (DB9)**, wired from the **TTL→RS232** converter output.

Only ONE of each port — do not duplicate them.

**BOTTOM (field terminals):** Two long horizontal rows of **DIN-rail feed-through terminal blocks (Phoenix UK2.5B style)**, grouped in repeating **three-colour triplets — RED (VCC) + YELLOW (signal) + BLACK (ground)**. About **16 triplets in the upper terminal row and 16 in the lower row** (≈32 red, 32 yellow, 32 black blocks), with numbered marker strips (1–40) on top and metal end-clamps closing each rail.

**BOTTOM EDGE (cable exit):** Two horizontal rows of black **nylon cable glands** along the bottom of the enclosure (about **16 glands, arranged in two rows**). Each gland passes **one 3-core cable (red + yellow + black wires)** from one terminal triplet out through the cabinet wall.

**Wiring rules to show clearly:** RED = VCC (24V to sensors), BLACK = ground, YELLOW = signal, brown/blue = AC mains; all wires bundled tidily in the cable ducts, terminals labelled. Realistic copper, screws, printed component labels.

**Style:** clean industrial control-panel photography, realistic materials (steel, PCB, plastic, copper), balanced daylight, no people, no text watermark, engineering documentation quality, 3:4 or 4:3 aspect.

---

## 🇹🇭 โซนในรูป (อธิบายย่อ)
| โซน | มีอะไร |
|---|---|
| บนซ้าย | AC 220V เข้า → PSU DIN rail 24V (MDR-60-24) + 5V (MDR-20-5) |
| กลาง | PCB break-out STM32H743 · KF301 2P ×16 บนขอบบน · MINI560 5V→3.3V · W5500 (SPI/LAN) · TTL1/TTL2 |
| ใต้ PCB | opto isolation NPN 16CH ×2 (=32ch) · in 24V → out 3.3V |
| ขวา (ราง) | TTL→RS485 (จาก TTL1) · TTL→RS232 (จาก TTL2) แบบ DIN rail |
| ผนังตู้ (ช่องต่อภายนอก) | **LAN ×1** (RJ45 จาก W5500) · **RS485 ×1** (A/B/GND จาก TTL→485) · **RS232 ×1** (DB9 จาก TTL→232) — อย่างละ 1 ช่อง เรียงเป็นคอลัมน์ |
| ล่าง | UK2.5B แดง(VCC)/เหลือง(signal)/ดำ(G) · 16 ชุดแถวบน + 16 ชุดแถวล่าง · มาร์คเกอร์ 1–32 · end clamp |
| ขอบล่าง | cable gland 16 ตัว 2 แถว · ชุดละ 1 สายกลม 3 แกน (แดง+เหลือง+ดำ) |

**การจ่ายไฟ:** 24V → VCC เซนเซอร์ · 5V → บอร์ด

## ⚙️ สเปกอ้างอิง (จาก Excel)
STM32H743VIT6 (WeAct) · KF301-5.0 2P ×16 · Opto 16CH ×2 (NPN 24V→3.3V) · MINI560 5V→3.3V · W5500 LAN(SPI) · TTL→RS485 DIN rail (Waveshare) · TTL→RS232 DIN rail · UK2.5B แดง/เหลือง/ดำ · Nylon gland M12/M20 · PSU MEAN WELL MDR-60-24 + MDR-20-5 · GLINK GCB-04 enclosure

## 💡 ทิป
- ถ้า model นับจำนวนไม่เป๊ะ (16/32) — เพิ่มท้าย prompt: *"emphasise the repeating rows and the red/yellow/black colour banding rather than exact counts"*
- อยากได้แนวไดอะแกรมแทนรูปถ่าย เปลี่ยน "photorealistic photograph" → *"clean technical schematic illustration, flat vector style, labelled"*
- อยากมองจากมุมบน: เพิ่ม *"slightly top-down three-quarter view"*
