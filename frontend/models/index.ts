// Model layer — one repository per collection. Import these in controllers.
import { makeRepo } from "./repository";
import type {
  User, Tenant, Market, Zone, Unit, Meter, Device, Bill, Payment, Reading, AuditLog, Notification,
} from "./types";

export { oid, makeRepo } from "./repository";
export type * from "./types";

export const Users = makeRepo<User>("users");
export const Tenants = makeRepo<Tenant>("tenants");
export const Markets = makeRepo<Market>("markets");
export const Zones = makeRepo<Zone>("zones");
export const Units = makeRepo<Unit>("units");
export const Meters = makeRepo<Meter>("meters");
export const Devices = makeRepo<Device>("devices");
export const Bills = makeRepo<Bill>("bills");
export const Payments = makeRepo<Payment>("payments");
export const Credits = makeRepo("credits");
export const Readings = makeRepo<Reading>("readings");
export const Notifications = makeRepo<Notification>("notifications");
export const ControlEvents = makeRepo("control_events");
export const DeviceCommands = makeRepo("device_commands");
export const AuditLogs = makeRepo<AuditLog>("audit_logs");
