import { z } from "zod";

export const registerDeviceSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "id is required")
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "id may only contain letters, digits, - and _"),
  name: z.string().trim().min(1, "name is required").max(120),
});

export const heartbeatSchema = z.object({
  timestamp: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((value) => value ?? new Date().toISOString()),
  status: z.string().trim().min(1).max(32).default("OK"),
  cpu_usage: z.number().min(0).max(100).optional(),
  signal_strength: z.number().min(-150).max(0).optional(),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
