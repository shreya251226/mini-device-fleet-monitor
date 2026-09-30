import { createFileRoute } from "@tanstack/react-router";

import { error, json } from "@/lib/fleet/http";
import { fleet } from "@/lib/fleet/store";

export const Route = createFileRoute("/api/public/devices/$id")({
  server: {
    handlers: {
      // GET /api/public/devices/{id}
      GET: async ({ params }) => {
        const device = fleet.get(params.id);
        if (!device) return error(`Device "${params.id}" is not registered`, 404);
        return json(device);
      },
    },
  },
});
