// Email + LINE notifier. Uses SMTP/LINE if env is configured, else logs (mock).

export async function sendEmail(to, subject, text) {
  const host = process.env.SMTP_HOST;
  if (!host || !to) {
    console.log(`[email:mock] -> ${to} | ${subject}\n${text}\n`);
    return;
  }
  try {
    const nodemailer = (await import("nodemailer")).default;
    const t = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      // รองรับ relay ภายใน (cert self-signed) · service ภายนอกที่มี cert จริงก็ยังเข้ารหัสปกติ
      tls: { rejectUnauthorized: false },
    });
    const info = await t.sendMail({ from: process.env.SMTP_FROM || "CTRL <noreply@ctrlanywhere.com>", to, subject, text });
    console.log(`[email:sent] -> ${to} | ${subject} | id=${info.messageId}`);
  } catch (e: any) {
    console.log("[email:err]", e.message);
  }
}

export async function sendLine(to, message) {
  const token = process.env.LINE_TOKEN;
  if (!token || !to) {
    console.log(`[line:mock] -> ${to || "-"} | ${message}`);
    return;
  }
  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ to, messages: [{ type: "text", text: message }] }),
    });
  } catch (e: any) {
    console.log("[line:err]", e.message);
  }
}

// notifyTenant sends to the unit's occupant via whatever channels they have.
export async function notifyTenant(db, unitId, subject, message) {
  const unit = await db.collection("units").findOne({ _id: unitId });
  if (!unit || !unit.occupant_user_id) return;
  const user = await db.collection("users").findOne({ _id: unit.occupant_user_id });
  if (!user) return;
  if (user.email) await sendEmail(user.email, subject, message);
  if (user.line_id) await sendLine(user.line_id, `${subject}\n${message}`);
  if (!user.email && !user.line_id) console.log(`[notify:mock] ${user.login_id}: ${subject} — ${message}`);
  await db.collection("notifications").insertOne({
    tenant_id: unit.tenant_id, unit_id: unitId, user_id: user._id,
    subject, message, at: new Date(),
  });
}
