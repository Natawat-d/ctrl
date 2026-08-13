// Device liveness helpers. Shared by server (ingest/overview) and client (UI).
// A device is "online" only if its last heartbeat is within ONLINE_MS.
export const ONLINE_MS = 60000; // 60s — telemetry ticks every 5s

export function isOnline(dev) {
  const ls = dev?.status?.last_seen;
  return !!ls && Date.now() - new Date(ls).getTime() < ONLINE_MS;
}

// deviceView projects a device doc into the shape the UI consumes.
export function deviceView(dev) {
  if (!dev) return null;
  return {
    uuid: dev.uuid,
    short_id: dev.short_id,
    unit_id: dev.unit_id ? String(dev.unit_id) : null,
    online: isOnline(dev),
    last_seen: dev.status?.last_seen || null,
    temp: dev.status?.temp ?? null,
    watt: dev.status?.watt ?? null,
    flags: dev.status?.flags || [],
  };
}
