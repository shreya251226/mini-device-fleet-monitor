import type { ZodError } from "zod";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function error(message: string, status: number, details?: unknown): Response {
  return Response.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export function validationError(err: ZodError): Response {
  return error(
    "Validation failed",
    400,
    err.issues.map((i) => ({ field: i.path.join(".") || "(body)", message: i.message })),
  );
}

/** Parses a JSON body, returning a 400 Response instead of throwing on bad input. */
export async function readJson(request: Request): Promise<{ data?: unknown; response?: Response }> {
  try {
    const text = await request.text();
    if (!text.trim()) return { data: {} };
    return { data: JSON.parse(text) };
  } catch {
    return { response: error("Request body must be valid JSON", 400) };
  }
}
