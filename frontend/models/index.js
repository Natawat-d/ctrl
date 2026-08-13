// Model layer — one repository per collection. Import these in controllers.
import { makeRepo } from "./repository";

export { oid, makeRepo } from "./repository";

export const Users = makeRepo("users");
export const Tenants = makeRepo("tenants");
export const Markets = makeRepo("markets");
export const Zones = makeRepo("zones");
export const Units = makeRepo("units");
export const Meters = makeRepo("meters");
export const Devices = makeRepo("devices");
export const Bills = makeRepo("bills");
export const Payments = makeRepo("payments");
export const Credits = makeRepo("credits");
export const Readings = makeRepo("readings");
export const Notifications = makeRepo("notifications");
export const ControlEvents = makeRepo("control_events");
export const DeviceCommands = makeRepo("device_commands");
export const AuditLogs = makeRepo("audit_logs");
