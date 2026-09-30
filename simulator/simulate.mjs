#!/usr/bin/env node
/**
 * Device simulator.
 *
 * Registers N devices and makes each of them send a heartbeat on an interval.
 * Stop a single device with `--stop device-03:20` to watch it go OFFLINE
 * roughly 30 seconds later.
 *
 * Usage:
 *   node simulator/simulate.mjs
 *   node simulator/simulate.mjs --url http://localhost:8080 --devices 5 --interval 5
 *   node simulator/simulate.mjs --stop device-03:20
 */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE_URL = (flag("url", process.env.FLEET_URL ?? "http://localhost:8080")).replace(/\/$/, "");
const API = `${BASE_URL}/api/public`;
const COUNT = Number(flag("devices", 5));
const INTERVAL_S = Number(flag("interval", 5));
const stopSpec = flag("stop", null); // e.g. "device-03:20"

if (!Number.isInteger(COUNT) || COUNT < 1) throw new Error("--devices must be a positive integer");
if (!(INTERVAL_S > 0)) throw new Error("--interval must be a positive number of seconds");

const [stopId, stopAfterRaw] = stopSpec ? stopSpec.split(":") : [];
const stopAfterS = stopAfterRaw ? Number(stopAfterRaw) : 20;

const ids = Array.from({ length: COUNT }, (_, i) => `device-${String(i + 1).padStart(2, "0")}`);
const log = (...parts) => console.log(new Date().toISOString(), ...parts);

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

async function register(id) {
  const res = await post("/devices", { id, name: `Lab Device ${id.split("-")[1]}` });
  if (res.ok) log(`registered ${id}`);
  else if (res.status === 409) log(`${id} already registered — reusing it`);
  else log(`failed to register ${id}: ${res.status} ${res.body}`);
}

async function heartbeat(id) {
  try {
    const res = await post(`/devices/${id}/heartbeat`, {
      timestamp: new Date().toISOString(),
      status: "OK",
      cpu_usage: Math.round(Math.random() * 100),
      signal_strength: -50 - Math.round(Math.random() * 40),
    });
    log(res.ok ? `${id} heartbeat -> ${res.status}` : `${id} heartbeat FAILED ${res.status}`);
  } catch (err) {
    log(`${id} heartbeat error: ${err.message}`);
  }
}

const timers = new Map();

async function main() {
  log(`simulating ${COUNT} devices against ${API} every ${INTERVAL_S}s`);
  for (const id of ids) await register(id);

  for (const id of ids) {
    heartbeat(id);
    timers.set(
      id,
      setInterval(() => heartbeat(id), INTERVAL_S * 1000),
    );
  }

  if (stopId) {
    if (!ids.includes(stopId)) {
      log(`warning: --stop ${stopId} is not one of the simulated devices`);
    } else {
      setTimeout(() => {
        clearInterval(timers.get(stopId));
        timers.delete(stopId);
        log(`stopped ${stopId} — it should report OFFLINE within ~30s`);
      }, stopAfterS * 1000);
    }
  }
}

const shutdown = () => {
  for (const timer of timers.values()) clearInterval(timer);
  log("simulator stopped");
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error("simulator failed:", err);
  process.exit(1);
});
