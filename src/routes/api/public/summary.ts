import { createFileRoute } from "@tanstack/react-router";

import { json } from "@/lib/fleet/http";
import { fleet } from "@/lib/fleet/store";

export const Route = createFileRoute("/api/public/summary")({
  server: {
    handlers: {
      // GET /api/public/summary
      GET: async () => json(fleet.summary()),
    },
  },
});
