// รูปร่างเอกสารในแต่ละ collection — อ่านจากเอกสารจริงบน production (ไม่ได้เดา)
// field ที่ไม่ได้มีครบทุกเอกสาร (เช่น platform_admin ไม่มี tenant_id) ทำเป็น optional
import type { ObjectId } from "mongodb";

// Json<T> = รูปร่างเดียวกันหลังผ่าน JSON.stringify — ObjectId/Date กลายเป็น string
// ใช้ฝั่ง client (page.tsx) ที่รับค่าจาก fetch แทนการเขียน interface คู่ขนานทุกตัว
// import แบบ `import type` เท่านั้น ไม่งั้น mongodb driver จะติดไปใน bundle ฝั่ง browser
export type Json<T> =
  T extends ObjectId | Date ? string :
  T extends (infer U)[] ? Json<U>[] :
  T extends object ? { [K in keyof T]: Json<T[K]> } :
  T;

export type Kind = "electric" | "water";
export type BillStatus = "issued" | "overdue" | "partially_paid" | "paid";
export type PaymentStatus = "submitted" | "verified" | "rejected";
export type Role = "platform_admin" | "owner" | "tenant_user";

export interface User {
  _id?: ObjectId;
  tenant_id?: ObjectId | null;
  role: Role | string;
  login_id: string;
  password_hash: string;
  display_name: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  national_id?: string;
  phone?: string;
  line_id?: string;
  verified: boolean;
  status: string;
  unit_ids?: ObjectId[];
  reset_token?: string;
  reset_expires?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Tenant {
  _id?: ObjectId;
  name: string;
  plan: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface Rate {
  elec_per_kwh: number;
  water_per_m3: number;
  service_fee: number;
  elec_cost_per_kwh?: number;
  water_cost_per_m3?: number;
}

export interface BillingCfg {
  cycle_day: number;
  due_days: number;
  grace_days: number;
  late_fee_per_day: number;
  late_fee_type: "fixed" | "percent" | string;
}

export interface Market {
  _id?: ObjectId;
  tenant_id: ObjectId;
  name: string;
  type: string;
  slug: string;
  timezone: string;
  market_short: number;
  province?: string;
  rate?: Partial<Rate>;
  billing?: Partial<BillingCfg>;
  created_at: Date;
  updated_at: Date;
}

export interface Zone {
  _id?: ObjectId;
  tenant_id: ObjectId;
  market_id: ObjectId;
  name: string;
  order: number;
  kind: string;
  created_at: Date;
  updated_at: Date;
}

export interface Unit {
  _id?: ObjectId;
  tenant_id: ObjectId;
  market_id: ObjectId;
  zone_id?: ObjectId;
  type?: string;
  code: string;
  name?: string;
  floor?: number;
  rent: number;
  common_fee: number;
  meters?: ObjectId[];
  status: string;
  occupant_user_id?: ObjectId | null;
  rate_override?: Partial<Record<keyof Rate, number | string>>;
  billing_override?: Partial<Record<keyof BillingCfg, number | string>>;
  created_at: Date;
  updated_at: Date;
}

export interface Meter {
  _id?: ObjectId;
  tenant_id: ObjectId;
  market_id: ObjectId;
  unit_id: ObjectId;
  kind: Kind | string;
  phase?: number;
  unit_of_measure?: string;
  last_value?: number;
  last_ts?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Device {
  _id?: ObjectId;
  tenant_id: ObjectId | null;
  market_id: ObjectId | null;
  uuid: string;
  short_id?: number;
  device_type: string;
  kind: Kind | string | null;
  fw_version?: number;
  format_version?: number;
  unit_id: ObjectId | null;
  meter_id: ObjectId | null;
  status: { online: boolean; flags?: string[]; last_seen?: Date; watt?: number };
  first_seen?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface BillLine {
  type: string;
  usage?: number;
  rate?: number;
  amount: number;
}

export interface Bill {
  _id?: ObjectId;
  tenant_id: ObjectId;
  market_id: ObjectId;
  unit_id: ObjectId;
  occupant_user_id: ObjectId | null;
  cycle: string;
  period: { from: Date; to: Date };
  issued_at: Date;
  due_at: Date;
  grace_until: Date;
  lines: BillLine[];
  subtotal: number;
  late_fee: number;
  total: number;
  status: BillStatus | string;
  paid_amount: number;
  created_at: Date;
  updated_at: Date;
}

export interface Payment {
  _id?: ObjectId;
  tenant_id: ObjectId;
  market_id: ObjectId;
  unit_id: ObjectId;
  bill_id: ObjectId;
  amount: number;
  method?: string;
  status: PaymentStatus | string;
  slip_image_url?: string;
  verified_by?: string;
  verified_at?: Date;
  created_at: Date;
  updated_at?: Date;
}

export interface Reading {
  _id?: ObjectId;
  ts: Date;
  meta: { kind: string; market_id: ObjectId; meter_id: ObjectId; tenant_id: ObjectId; unit_id: ObjectId };
  v: number;
  raw?: Record<string, number | undefined>;
  rate_flow?: number;
}

export interface AuditLog {
  _id?: ObjectId;
  at: Date;
  tenant_id?: ObjectId | null;
  actor_id: string;
  actor_role?: string;
  actor_label?: string;
  action: string;
  target_type?: string;
  target_id?: ObjectId | string;
  target_label?: string;
  market_id?: ObjectId | null;
  detail?: Record<string, unknown>;
}

export interface Notification {
  _id?: ObjectId;
  unit_id?: ObjectId;
  user_id?: ObjectId;
  title: string;
  body: string;
  read?: boolean;
  created_at: Date;
}
