/**
 * In-memory fleet store.
 *
 * Devices are kept in a module-level Map. Status is never persisted: it is
 * derived on read from the last heartbeat timestamp, so a device flips to
 * OFFLINE on its own once the timeout elapses (no background timer needed).
 */

export const HEARTBEAT_TIMEOUT_MS = 30_000;

export type DeviceStatus = "ONLINE" | "OFFLINE";

export interface Heartbeat {
  timestamp: string;
  status: string;
  cpu_usage?: number;
  signal_strength?: number;
}

export interface Device {
  id: string;
  name: string;
  registered_at: string;
  last_heartbeat: string | null;
  last_report: Heartbeat | null;
}

export interface DeviceView extends Device {
  status: DeviceStatus;
}

export interface Summary {
  total: number;
  online: number;
  offline: number;
}

export class FleetStore {
  private devices = new Map<string, Device>();

  constructor(private timeoutMs: number = HEARTBEAT_TIMEOUT_MS) {}

  register(id: string, name: string, now: Date = new Date()): Device {
    if (this.devices.has(id)) {
      throw new ConflictError(`Device "${id}" is already registered`);
    }
    const device: Device = {
      id,
      name,
      registered_at: now.toISOString(),
      last_heartbeat: null,
      last_report: null,
    };
    this.devices.set(id, device);
    return device;
  }

  heartbeat(id: string, beat: Heartbeat): DeviceView {
    const device = this.devices.get(id);
    if (!device) throw new NotFoundError(`Device "${id}" is not registered`);
    device.last_heartbeat = beat.timestamp;
    device.last_report = beat;
    return this.view(device);
  }

  get(id: string, now: Date = new Date()): DeviceView | undefined {
    const device = this.devices.get(id);
    return device ? this.view(device, now) : undefined;
  }

  list(now: Date = new Date(), status?: DeviceStatus): DeviceView[] {
    const all = [...this.devices.values()].map((d) => this.view(d, now));
    return status ? all.filter((d) => d.status === status) : all;
  }

  summary(now: Date = new Date()): Summary {
    const all = this.list(now);
    const online = all.filter((d) => d.status === "ONLINE").length;
    return { total: all.length, online, offline: all.length - online };
  }

  clear(): void {
    this.devices.clear();
  }

  private view(device: Device, now: Date = new Date()): DeviceView {
    return { ...device, status: this.statusOf(device, now) };
  }

  private statusOf(device: Device, now: Date): DeviceStatus {
    if (!device.last_heartbeat) return "OFFLINE";
    const age = now.getTime() - new Date(device.last_heartbeat).getTime();
    // A heartbeat exactly at the timeout boundary still counts as ONLINE.
    return age <= this.timeoutMs ? "ONLINE" : "OFFLINE";
  }
}

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

/** Singleton used by the HTTP routes. Tests build their own instances. */
export const fleet = new FleetStore();
