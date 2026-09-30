import { createFileRoute } from "@tanstack/react-router";

import { error, json, readJson, validationError } from "@/lib/fleet/http";
import { heartbeatSchema } from "@/lib/fleet/schemas";
import { NotFoundError, fleet } from "@/lib/fleet/store";

export const Route = createFileRoute("/api/public/devices/$id/heartbeat")({
  server: {
    handlers: {
      // POST /api/public/devices/{id}/heartbeat
      POST: async ({ request, params }) => {
        const { data, response } = await readJson(request);
        if (response) return response;

        const parsed = heartbeatSchema.safeParse(data);
        if (!parsed.success) return validationError(parsed.error);

        try {
          return json(fleet.heartbeat(params.id, parsed.data), 202);
        } catch (err) {
          if (err instanceof NotFoundError) return error(err.message, 404);
          throw err;
        }
      },
    },
  },
});
