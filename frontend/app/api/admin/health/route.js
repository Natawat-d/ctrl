import { requireUser, json } from "@/lib/http";
import { ingestStatus } from "@/services/ingest";
import { Devices } from "@/models";
import { isOnline } from "@/lib/device";

// GET: platform-admin system monitor — REST ingest rate + device liveness.
export async function GET(req) {
  const { error } = requireUser(req, ["platform_admin"]);
  if (error) return error;
  const devs = await Devices.find({});
  const online = devs.filter(isOnline).length;
  return json({
    ingest: ingestStatus(),
    devices: { total: devs.length, online, offline: devs.length - online },
    server_time: new Date(),
  });
}
