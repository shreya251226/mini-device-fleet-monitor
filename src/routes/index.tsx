import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import type { DeviceView, Summary } from "@/lib/fleet/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fleet Monitor — live device heartbeat dashboard" },
      {
        name: "description",
        content:
          "Operator dashboard for a simulated device fleet: live heartbeats, online/offline status and fleet summary.",
      },
      { property: "og:title", content: "Fleet Monitor — live device heartbeat dashboard" },
      {
        property: "og:description",
        content:
          "Operator dashboard for a simulated device fleet: live heartbeats, online/offline status and fleet summary.",
      },
    ],
  }),
  component: Dashboard,
});

const api = async <T,>(path: string): Promise<T> => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} responded ${res.status}`);
  return res.json() as Promise<T>;
};

function secondsAgo(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
}

function Dashboard() {
  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: () => api<DeviceView[]>("/api/public/devices"),
    refetchInterval: 2000,
  });
  const summary = useQuery({
    queryKey: ["summary"],
    queryFn: () => api<Summary>("/api/public/summary"),
    refetchInterval: 2000,
  });

  const now = Date.now();
  const list = devices.data ?? [];

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Mini Device Fleet Monitor
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              Fleet status
            </h1>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            auto-refresh 2s · offline after 30s without a heartbeat
          </p>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Total" value={summary.data?.total} />
          <Stat label="Online" value={summary.data?.online} tone="online" />
          <Stat label="Offline" value={summary.data?.offline} tone="offline" />
        </section>

        <section className="mt-10">
          {devices.isError ? (
            <p className="rounded-lg border border-border bg-card p-6 text-sm text-destructive">
              Could not load the fleet: {(devices.error as Error).message}
            </p>
          ) : list.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No devices registered yet. Start the simulator with{" "}
                <code className="font-mono text-foreground">node simulator/simulate.mjs</code>.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {list.map((device) => {
                const age = secondsAgo(device.last_heartbeat, now);
                const online = device.status === "ONLINE";
                return (
                  <li
                    key={device.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-48">
                      <p className="font-mono text-sm text-foreground">{device.id}</p>
                      <p className="text-xs text-muted-foreground">{device.name}</p>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {device.last_report?.cpu_usage != null && (
                        <span className="mr-4">cpu {device.last_report.cpu_usage}%</span>
                      )}
                      {device.last_report?.signal_strength != null && (
                        <span>{device.last_report.signal_strength} dBm</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs text-muted-foreground">
                        {age == null ? "never seen" : `${age}s ago`}
                      </span>
                      <span
                        className={[
                          "inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-xs",
                          online
                            ? "bg-online/15 text-online"
                            : "bg-destructive/15 text-destructive",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "size-2 rounded-full",
                            online ? "bg-online animate-pulse" : "bg-destructive",
                          ].join(" ")}
                        />
                        {device.status}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value?: number;
  tone?: "online" | "offline";
}) {
  const toneClass =
    tone === "online" ? "text-online" : tone === "offline" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-2 text-4xl font-semibold tabular-nums ${toneClass}`}>{value ?? "—"}</p>
    </div>
  );
}
