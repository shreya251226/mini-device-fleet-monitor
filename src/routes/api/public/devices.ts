import { createFileRoute } from "@tanstack/react-router";

import { error, json, readJson, validationError } from "@/lib/fleet/http";
import { registerDeviceSchema } from "@/lib/fleet/schemas";
import { ConflictError, fleet, type DeviceStatus } from "@/lib/fleet/store";

export const Route = createFileRoute("/api/public/devices")({
  server: {
    handlers: {
      // GET /api/public/devices?status=ONLINE|OFFLINE
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("status");
        if (raw && raw !== "ONLINE" && raw !== "OFFLINE") {
          return error("status filter must be ONLINE or OFFLINE", 400);
        }
        return json(fleet.list(new Date(), (raw as DeviceStatus | null) ?? undefined));
      },

      // POST /api/public/devices
      POST: async ({ request }) => {
        const { data, response } = await readJson(request);
        if (response) return response;

        const parsed = registerDeviceSchema.safeParse(data);
        if (!parsed.success) return validationError(parsed.error);

        try {
          const device = fleet.register(parsed.data.id, parsed.data.name);
          return json({ ...device, status: "OFFLINE" }, 201);
        } catch (err) {
          if (err instanceof ConflictError) return error(err.message, 409);
          throw err;
        }
      },
    },
  },
});
