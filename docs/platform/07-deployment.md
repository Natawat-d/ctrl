# 07 — Deployment

> decision #30: ลอง local Docker ก่อน → deploy VPS ทีหลัง

## 1. docker-compose (local dev)
```yaml
services:
  mongo:
    image: mongo:7                 # รองรับ Time-Series
    volumes: [mongo_data:/data/db]
    ports: ["27017:27017"]
  mqtt:
    image: eclipse-mosquitto:2     # หรือ emqx/emqx
    volumes: [./mosquitto:/mosquitto/config]
    ports: ["1883:1883","9001:9001"]
  backend:
    build: ./backend
    env_file: .env
    depends_on: [mongo, mqtt]
    ports: ["8080:8080"]
  frontend:
    build: ./frontend
    environment: [NEXT_PUBLIC_API_URL=http://localhost:8080]
    ports: ["3000:3000"]
  caddy:
    image: caddy:2                 # prod: auto-SSL ; local: reverse proxy
    volumes: [./Caddyfile:/etc/caddy/Caddyfile, caddy_data:/data]
    ports: ["80:80","443:443"]
volumes: { mongo_data:, caddy_data: }
```

## 2. env / secrets
```
# .env (local) — prod ใช้ docker secret / vault
MONGO_URI=mongodb://mongo:27017/akr
MQTT_URL=mqtt://mqtt:1883
MQTT_SUPERUSER=server
MQTT_SUPERPASS=***
JWT_SECRET=***
AES_KEK=***                # key-encryption-key เข้ารหัส market AES keys
STORAGE_PATH=/data/uploads # slip images + csv exports
TZ=Asia/Bangkok
```
- **market AES keys** เข้ารหัสด้วย `AES_KEK` ก่อนเก็บ (หรือ ref vault)
- MQTT ACL: ไฟล์ config ให้ gateway user เห็นเฉพาะ `akr/{t}/{m}/#`

## 3. Local run
```
cp .env.example .env      # แก้ค่า
docker compose up --build
# seed: สร้าง platform admin + tenant/market/unit ตัวอย่าง + device simulator
docker compose exec backend ./server seed
```

## 4. Device simulator (dev — ยังไม่มี hardware)
- เขียน mock ที่ publish MQTT telemetry ทุก 1 นาที ต่อ unit (สุ่มค่า kWh/m³ เพิ่มขึ้น)
- ทดสอบ command → ตอบ ACK จำลอง
- ให้พัฒนา frontend/billing ได้ก่อนมี hardware (decision: hardware ทำทีหลัง)

## 5. Prod (VPS) — ทีหลัง
- Caddy auto-SSL (โดเมนจริง) → reverse proxy frontend + backend + MQTT (wss)
- MongoDB: auth + backup `mongodump` cron รายวัน → เก็บนอกเครื่อง (S3/rsync)
- MQTT: TLS (8883), credential ต่อ gateway
- monitoring: log rotate, healthcheck endpoint `/healthz`, alert เมื่อ gateway offline
- แยก volume ข้อมูล + สำรอง; ตั้ง firewall (เปิดเฉพาะ 443/8883)

## 6. Backup / retention
- Mongo backup รายวัน (นอก retention 3 เดือนของ readings)
- CSV export ต่อ market เก็บใน `STORAGE_PATH/exports/` ก่อน purge (decision #15)

## 7. CI (ทีหลัง)
- lint + test (go test, next lint) → build image → push → deploy compose บน VPS
