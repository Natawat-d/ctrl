// เช็คตรรกะเงินสองตัวที่พังเงียบได้: usageFromRows (คิดหน่วย) + applyPayment (ตัดยอดจ่าย)
// รัน: node scripts/check-billing.mjs   — ไม่มี framework ใช้ assert ล้วน
import assert from "node:assert/strict";
import { usageFromRows, applyPayment } from "../controllers/billingController.ts";

const rows = (...vs) => vs.map((v) => ({ v }));

// ---- usageFromRows ----
// ปกติ: มิเตอร์สะสมเดินหน้า 100→160 = 60 หน่วย (จุดแรกเป็น baseline เมื่อไม่มีค่าก่อนหน้า)
assert.equal(usageFromRows(rows(100, 120, 160)), 60);

// BILL-1: เปลี่ยนมิเตอร์กลางเดือน 800→950→(รีเซ็ต)0→40 ต้องได้ 190 ไม่ใช่ 0
assert.equal(usageFromRows(rows(800, 950, 0, 40), 800), 190);

// reading เดียวในเดือน แต่มี baseline เดือนก่อน → คิดผลต่างได้ ไม่ทิ้งเป็น 0
assert.equal(usageFromRows(rows(150), 100), 50);

// ไม่มีข้อมูล → 0 ไม่ใช่ NaN
assert.equal(usageFromRows([]), 0);
assert.equal(usageFromRows(null), 0);

// ค่าติดลบไม่หลุดออกไปเป็นหน่วยติดลบ
assert.ok(usageFromRows(rows(0)) >= 0);

// ---- applyPayment (BILL-2) ----
const bill = { total: 3000, paid_amount: 0 };

// จ่ายบางส่วน → ต้องเป็น partially_paid และเก็บยอดจริง ไม่ใช่ total
assert.deepEqual(applyPayment(bill, 500), { paid_amount: 500, status: "partially_paid" });

// จ่ายงวดสองต้องสะสม ไม่ใช่ทับ
assert.deepEqual(applyPayment({ total: 3000, paid_amount: 500 }, 700), { paid_amount: 1200, status: "partially_paid" });

// จ่ายครบพอดี / จ่ายเกิน → paid
assert.deepEqual(applyPayment({ total: 3000, paid_amount: 2500 }, 500), { paid_amount: 3000, status: "paid" });
assert.deepEqual(applyPayment(bill, 5000), { paid_amount: 5000, status: "paid" });

// amount ขยะต้องไม่ทำให้ paid_amount เป็น NaN แล้วบิลเพี้ยนทั้งใบ
assert.equal(applyPayment(bill, undefined).paid_amount, 0);
assert.equal(applyPayment(bill, "abc").paid_amount, 0);

console.log("billing checks OK");
