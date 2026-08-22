// Thai labels for every machine status shown in the UI — keep raw values in
// the DB/CSS classes, translate only at render time.
export const BILL_STATUS = {
  paid: "จ่ายแล้ว",
  issued: "รอชำระ",
  overdue: "เกินกำหนด",
  partially_paid: "จ่ายบางส่วน",
  canceled: "ยกเลิก",
};
export const billStatus = (s) => BILL_STATUS[s] || s;

export const PAY_STATUS = {
  submitted: "รอตรวจสอบ",
  verified: "ตรวจแล้ว",
  rejected: "ไม่ผ่าน",
};
export const payStatus = (s) => PAY_STATUS[s] || s;

export const PLAN = { free: "ฟรี", demo: "เดโม", standard: "มาตรฐาน" };
export const planLabel = (s) => PLAN[s] || s;
