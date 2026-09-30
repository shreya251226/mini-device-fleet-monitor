import { describe, expect, it } from "vitest";

import { heartbeatSchema, registerDeviceSchema } from "@/lib/fleet/schemas";

describe("registerDeviceSchema", () => {
  it("accepts a valid payload and trims whitespace", () => {
    const parsed = registerDeviceSchema.parse({ id: " device-01 ", name: " Lab Device 01 " });
    expect(parsed).toEqual({ id: "device-01", name: "Lab Device 01" });
  });

  it.each([
    ["missing id", { name: "Lab Device" }],
    ["empty name", { id: "device-01", name: "" }],
    ["illegal characters in id", { id: "device 01!", name: "Lab Device" }],
  ])("rejects %s", (_label, payload) => {
    expect(registerDeviceSchema.safeParse(payload).success).toBe(false);
  });
});

describe("heartbeatSchema", () => {
  it("defaults status to OK and timestamp to now", () => {
    const parsed = heartbeatSchema.parse({});
    expect(parsed.status).toBe("OK");
    expect(Number.isNaN(Date.parse(parsed.timestamp))).toBe(false);
  });

  it("keeps optional metrics", () => {
    const parsed = heartbeatSchema.parse({
      timestamp: "2026-09-21T10:30:00Z",
      status: "DEGRADED",
      cpu_usage: 42,
      signal_strength: -71,
    });
    expect(parsed).toMatchObject({ status: "DEGRADED", cpu_usage: 42, signal_strength: -71 });
  });

  it.each([
    ["a non-ISO timestamp", { timestamp: "yesterday" }],
    ["out-of-range cpu usage", { cpu_usage: 140 }],
    ["a positive signal strength", { signal_strength: 20 }],
  ])("rejects %s", (_label, payload) => {
    expect(heartbeatSchema.safeParse(payload).success).toBe(false);
  });
});
