import { describe, expect, it } from "vitest";

import { ConflictError, FleetStore, NotFoundError } from "@/lib/fleet/store";

const T0 = new Date("2026-09-21T10:30:00.000Z");
const at = (secondsAfterT0: number) => new Date(T0.getTime() + secondsAfterT0 * 1000);
const beat = (when: Date) => ({ timestamp: when.toISOString(), status: "OK" });

describe("device registration", () => {
  it("registers a device with no heartbeat yet", () => {
    const fleet = new FleetStore();
    fleet.register("device-01", "Lab Device 01", T0);

    const device = fleet.get("device-01", T0);
    expect(device).toMatchObject({
      id: "device-01",
      name: "Lab Device 01",
      last_heartbeat: null,
      status: "OFFLINE",
    });
  });

  it("rejects a duplicate id", () => {
    const fleet = new FleetStore();
    fleet.register("device-01", "Lab Device 01", T0);
    expect(() => fleet.register("device-01", "Copy", T0)).toThrow(ConflictError);
  });

  it("returns undefined for an unknown device", () => {
    expect(new FleetStore().get("nope")).toBeUndefined();
  });
});

describe("heartbeat handling", () => {
  it("stores the latest heartbeat and extra metrics", () => {
    const fleet = new FleetStore();
    fleet.register("device-01", "Lab Device 01", T0);

    fleet.heartbeat("device-01", beat(at(1)));
    fleet.heartbeat("device-01", {
      timestamp: at(6).toISOString(),
      status: "OK",
      cpu_usage: 42,
      signal_strength: -71,
    });

    const device = fleet.get("device-01", at(6))!;
    expect(device.last_heartbeat).toBe(at(6).toISOString());
    expect(device.last_report).toMatchObject({ cpu_usage: 42, signal_strength: -71 });
  });

  it("rejects a heartbeat from an unregistered device", () => {
    const fleet = new FleetStore();
    expect(() => fleet.heartbeat("ghost", beat(T0))).toThrow(NotFoundError);
  });
});

describe("30 second ONLINE/OFFLINE rule", () => {
  it("is ONLINE right after a heartbeat", () => {
    const fleet = new FleetStore();
    fleet.register("device-01", "Lab Device 01", T0);
    fleet.heartbeat("device-01", beat(T0));
    expect(fleet.get("device-01", at(1))!.status).toBe("ONLINE");
  });

  it("is still ONLINE at exactly 30 seconds", () => {
    const fleet = new FleetStore();
    fleet.register("device-01", "Lab Device 01", T0);
    fleet.heartbeat("device-01", beat(T0));
    expect(fleet.get("device-01", at(30))!.status).toBe("ONLINE");
  });

  it("turns OFFLINE past 30 seconds", () => {
    const fleet = new FleetStore();
    fleet.register("device-01", "Lab Device 01", T0);
    fleet.heartbeat("device-01", beat(T0));
    expect(fleet.get("device-01", at(31))!.status).toBe("OFFLINE");
  });

  it("comes back ONLINE when a new heartbeat arrives", () => {
    const fleet = new FleetStore();
    fleet.register("device-01", "Lab Device 01", T0);
    fleet.heartbeat("device-01", beat(T0));
    expect(fleet.get("device-01", at(60))!.status).toBe("OFFLINE");

    fleet.heartbeat("device-01", beat(at(60)));
    expect(fleet.get("device-01", at(61))!.status).toBe("ONLINE");
  });

  it("honours a custom timeout", () => {
    const fleet = new FleetStore(5_000);
    fleet.register("device-01", "Lab Device 01", T0);
    fleet.heartbeat("device-01", beat(T0));
    expect(fleet.get("device-01", at(6))!.status).toBe("OFFLINE");
  });
});

describe("listing and summary", () => {
  const seed = () => {
    const fleet = new FleetStore();
    for (let i = 1; i <= 5; i++) {
      const id = `device-0${i}`;
      fleet.register(id, `Lab Device 0${i}`, T0);
      // device-04 and device-05 went quiet a minute ago.
      fleet.heartbeat(id, beat(i >= 4 ? at(-60) : T0));
    }
    return fleet;
  };

  it("summarises the fleet", () => {
    expect(seed().summary(at(5))).toEqual({ total: 5, online: 3, offline: 2 });
  });

  it("filters by status", () => {
    const fleet = seed();
    expect(fleet.list(at(5), "ONLINE").map((d) => d.id)).toEqual([
      "device-01",
      "device-02",
      "device-03",
    ]);
    expect(fleet.list(at(5), "OFFLINE").map((d) => d.id)).toEqual(["device-04", "device-05"]);
  });

  it("counts a never-seen device as offline", () => {
    const fleet = new FleetStore();
    fleet.register("device-09", "Never Heard From", T0);
    expect(fleet.summary(T0)).toEqual({ total: 1, online: 0, offline: 1 });
  });
});
