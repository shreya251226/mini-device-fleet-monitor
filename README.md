# Mini Device Fleet Monitor

A small fleet-monitoring service: devices register themselves, send periodic heartbeats, and an
operator can see which devices are ONLINE or OFFLINE. It ships with an HTTP API, a live dashboard,
a device simulator, and automated tests.

A device is **ONLINE** if its last heartbeat is at most **30 seconds** old, otherwise **OFFLINE**.

---

## 1. What the project does

- `POST /api/public/devices` — register a device
- `POST /api/public/devices/{id}/heartbeat` — receive a heartbeat
- `GET  /api/public/devices` — list devices with current status (optional `?status=ONLINE|OFFLINE`)
- `GET  /api/public/devices/{id}` — device details
- `GET  /api/public/summary` — `{ total, online, offline }`
- `GET  /` — an operator dashboard that polls the API every 2 seconds

---

## 2. Design / architecture

```text
src/lib/fleet/
  store.ts        # FleetStore: in-memory state + the ONLINE/OFFLINE rule (no framework code)
  schemas.ts      # Zod request schemas (validation + defaults)
  http.ts         # small JSON/error response helpers
src/routes/api/public/
  devices.ts              # GET list / POST register
  devices.$id.ts          # GET details
  devices.$id.heartbeat.ts# POST heartbeat
  summary.ts              # GET summary
src/routes/index.tsx      # dashboard UI
simulator/simulate.mjs    # device simulator
tests/                    # vitest unit tests
```

Key decisions:

- **Status is derived, never stored.** `FleetStore` computes status on every read from
  `now - last_heartbeat`. No background sweeper, no timers, no stale-state bugs, and a device
  flips to OFFLINE at the right moment even if nothing else happens in the process.
- **Domain logic is framework-free.** All rules live in `FleetStore`, which takes an injectable
  `now` and an injectable timeout. That is what makes the 30-second behaviour testable in
  milliseconds instead of with `sleep(31)`.
- **Route handlers are thin.** Parse → validate (Zod) → call the store → map domain errors
  (`NotFoundError` → 404, `ConflictError` → 409) to HTTP responses.
- **Storage is an in-memory `Map`** held in a module singleton. JavaScript's single-threaded event
  loop makes each handler's read-modify-write atomic, so the store is safe under concurrent
  requests without locks. Swapping it for a database means replacing one class.
- **`/api/public/*` prefix** is required by the hosting platform for endpoints that external
  clients (here, the simulator) may call without a session.

---

## 3. Prerequisites

- Node.js 20+ (or Bun 1.x)
- npm / bun

---

## 4. How to build

```bash
npm install
npm run build
```

## 5. How to run the application

```bash
npm run dev        # development, http://localhost:8080
# or
npm run build && npm run preview
```

## 6. How to run the simulator

With the app running, in a second terminal:

```bash
npm run simulate
# equivalent to: node simulator/simulate.mjs --url http://localhost:8080 --devices 5 --interval 5
```

To watch a device go OFFLINE, stop `device-03` 20 seconds in and then watch the dashboard (or
`GET /api/public/summary`) for ~30 more seconds:

```bash
node simulator/simulate.mjs --stop device-03:20
```

Flags: `--url`, `--devices`, `--interval` (seconds), `--stop <id>:<seconds>`. `Ctrl+C` stops all
devices cleanly.

## 7. How to run the tests

```bash
npm test          # vitest run
npm run test:watch
```

22 tests cover registration (including duplicates), heartbeat handling (including unknown
devices), status derivation, the 30-second boundary in both directions, recovery after going
offline, filtering, summary counts, and input validation.

---

## 8. Example API requests

```bash
BASE=http://localhost:8080/api/public

# Register
curl -X POST $BASE/devices -H 'content-type: application/json' \
  -d '{"id":"device-01","name":"Lab Device 01"}'
# 201 {"id":"device-01","name":"Lab Device 01","last_heartbeat":null,"status":"OFFLINE",...}

# Heartbeat (timestamp and status are optional; they default to now / "OK")
curl -X POST $BASE/devices/device-01/heartbeat -H 'content-type: application/json' \
  -d '{"timestamp":"2026-09-21T10:30:00Z","status":"OK","cpu_usage":42,"signal_strength":-71}'
# 202 { ...device, "status":"ONLINE" }

# List (optionally filtered)
curl $BASE/devices
curl "$BASE/devices?status=OFFLINE"

# Details
curl $BASE/devices/device-01

# Summary
curl $BASE/summary
# {"total":5,"online":4,"offline":1}
```

Error responses are uniform JSON:

```json
{ "error": "Validation failed",
  "details": [{ "field": "id", "message": "id may only contain letters, digits, - and _" }] }
```

| Situation                      | Status |
| ------------------------------ | ------ |
| Registered                     | 201    |
| Heartbeat accepted             | 202    |
| Malformed / invalid body       | 400    |
| Heartbeat or read, unknown id  | 404    |
| Duplicate device id            | 409    |

---

## 9. Assumptions

- Device ids are caller-supplied, unique, and match `[A-Za-z0-9_-]{1,64}`.
- Re-registering an existing id is an error (409) rather than an update; the simulator treats 409
  as "already there" and keeps going, so restarts are painless.
- A device that has never sent a heartbeat counts as OFFLINE.
- Heartbeat timestamps are trusted as sent. A heartbeat exactly 30.000s old is still ONLINE
  (boundary inclusive); this is an explicit choice, and it is pinned by a test.
- `timestamp` and `status` are optional on heartbeats and default to now / `"OK"`.
- Server and devices share a reasonably synchronised clock (UTC ISO-8601).

## 10. Known limitations

- **State is in memory only** — restarting the server empties the fleet. There is also no
  cross-instance sharing, so multiple replicas would each see their own fleet.
- Heartbeat timestamps are not sanity-checked against server time; a device with a badly skewed
  clock could report itself permanently ONLINE (or OFFLINE).
- Only the latest heartbeat is kept — no history, no metric trends, no uptime percentage.
- No authentication or rate limiting on any endpoint.
- Tests cover the domain and validation layers directly; the HTTP layer was verified by hand with
  curl and the simulator rather than by an automated end-to-end suite.

## 11. What I would improve with one more day

1. **Persistence** behind a `FleetRepository` interface (Postgres or SQLite), keeping `FleetStore`
   as the in-memory implementation used by tests.
2. **HTTP-level integration tests** that boot the server and exercise every route and status code,
   closing the one gap listed above.
3. **Heartbeat history** in a time-series table, powering an uptime percentage and sparklines of
   CPU and signal strength per device.
4. **Transition events**: emit a structured log line and a webhook when a device flips
   ONLINE↔OFFLINE, which is what an operator actually wants to be alerted on.
5. **Per-device configurable timeout** instead of a global 30 seconds, plus auth on write endpoints.

---

## AI Usage

- **Tools used:** Claude (via Lovable) for scaffolding, and editor autocomplete.
- **What for:** generating the first draft of the route handlers, the simulator's CLI flag parsing,
  and boilerplate around the test tables.
- **Something I changed:** the initial suggestion tracked status as a stored field on the device,
  updated by a `setInterval` sweeper that flipped devices to OFFLINE every few seconds. I rejected
  it: it introduces a background timer, makes status accuracy depend on the sweep interval, and is
  awkward to test. I replaced it with deriving status on read from `now - last_heartbeat`, which is
  simpler, always exact, and trivially testable by injecting `now`. The suggested code also used a
  strict `<` comparison against the timeout with no statement about the boundary; I made the rule
  explicit (`<=`, ONLINE at exactly 30s) and pinned it with a test.
- **Something I verified myself:** the end-to-end timeout behaviour. I ran the app, ran the
  simulator with `--stop device-03`, and watched `GET /summary` move from `online: 5` to
  `online: 4` about 30 seconds later, then come back to 5 after restarting the simulator. I also
  checked each error path by hand with curl (bad JSON, invalid id, duplicate id, unknown device).
