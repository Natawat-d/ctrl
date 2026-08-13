# -*- coding: utf-8 -*-
"""MVP poll test — PC → USR-TCP232-304 (Modbus TCP) → RS485 slaves
ใช้:  pip install pymodbus
      python poll_test.py             อ่านรอบเดียว
      python poll_test.py --loop 5    วนอ่านทุก 5 วินาที
"""
import sys, time, struct
from pymodbus.client import ModbusTcpClient

# ═══════════════ CONFIG — แก้ตรงนี้ที่เดียว ═══════════════
GATEWAYS = {
    "bus_electric": {"host": "192.168.0.201", "port": 502},
    "bus_water":    {"host": "192.168.0.202", "port": 502},
}

# ⚠️ register map ของมิเตอร์ 5(100A) ในลิงก์ยังไม่ยืนยันยี่ห้อ —
#    ค่าด้านล่างเป็นแบบ DDS238-2 ZN/S (พบบ่อยสุดในกลุ่มนี้)
#    ถ้าอ่านได้ค่าประหลาด ให้เทียบคู่มือในกล่องแล้วแก้ profile นี้
PROFILES = {
    "dds238_like": {
        "fc": 3,
        "points": [
            # (ชื่อ, register, จำนวน word, ชนิด, ตัวคูณ, หน่วย)
            ("energy_kwh", 0x0000, 2, "u32", 0.01,  "kWh"),
            ("voltage",    0x000C, 1, "u16", 0.1,   "V"),
            ("current",    0x000D, 1, "u16", 0.01,  "A"),
            ("power",      0x000E, 1, "u16", 1,     "W"),
        ],
    },
    "esp32_pulse": {  # เฟิร์มแวร์ DIYMROE ของเราเอง
        "fc": 3,
        "points": [
            ("pulse_ch1", 0x0000, 2, "u32", 1, "pulses"),
            ("pulse_ch2", 0x0002, 2, "u32", 1, "pulses"),
        ],
    },
}

DEVICES = [
    # (บัส, unit id, profile, ป้ายชื่อ)
    ("bus_electric", 1,   "dds238_like", "มิเตอร์ไฟ #1"),
    ("bus_electric", 2,   "dds238_like", "มิเตอร์ไฟ #2"),
    ("bus_water",    121, "esp32_pulse", "ESP32 นับพัลส์น้ำ"),
]

TIMEOUT_S, RETRIES = 1.0, 2
# ═══════════════════════════════════════════════════════════


def decode(words, dtype):
    if dtype == "u16":
        return words[0]
    if dtype == "u32":                      # big-endian word order (ABCD)
        return (words[0] << 16) | words[1]
    if dtype == "f32":
        return struct.unpack(">f", struct.pack(">HH", *words))[0]
    raise ValueError(dtype)


def poll_device(client, unit, profile, label):
    prof = PROFILES[profile]
    print(f"  ── {label} (unit {unit}) " + "─" * 20)
    for name, reg, count, dtype, scale, unit_name in prof["points"]:
        val, err = None, None
        for attempt in range(1 + RETRIES):
            rr = (client.read_holding_registers(reg, count=count, slave=unit)
                  if prof["fc"] == 3 else
                  client.read_input_registers(reg, count=count, slave=unit))
            if rr.isError():
                err = rr
                continue
            val = decode(rr.registers, dtype) * scale
            break
        if val is None:
            print(f"     {name:<12} ❌ {err}")
        else:
            print(f"     {name:<12} {val:>12,.2f} {unit_name}")


def poll_all():
    for bus, cfg in GATEWAYS.items():
        devs = [d for d in DEVICES if d[0] == bus]
        if not devs:
            continue
        print(f"\n═══ {bus}  {cfg['host']}:{cfg['port']} ═══")
        client = ModbusTcpClient(cfg["host"], port=cfg["port"], timeout=TIMEOUT_S)
        if not client.connect():
            print(f"  ❌ ต่อ gateway ไม่ได้ — เช็ค ping {cfg['host']} / โหมด ModbusTCP / port 502")
            continue
        try:
            for _, unit, profile, label in devs:
                poll_device(client, unit, profile, label)
        finally:
            client.close()


if __name__ == "__main__":
    if "--loop" in sys.argv:
        interval = float(sys.argv[sys.argv.index("--loop") + 1])
        n = 0
        while True:
            n += 1
            print(f"\n████ รอบที่ {n} — {time.strftime('%H:%M:%S')} ████")
            poll_all()
            time.sleep(interval)
    else:
        poll_all()
