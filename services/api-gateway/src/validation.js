import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export const mobileLoginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export const mobileRegisterSchema = z.object({
  full_name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  email: z.string().trim().email("Email tidak valid").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password minimal 8 karakter").max(200),
  password_confirmation: z.string(),
  accepted_terms: z.literal(true, { message: "Persetujuan syarat layanan wajib" }),
}).refine((value) => value.password === value.password_confirmation, {
  message: "Konfirmasi password tidak sama",
  path: ["password_confirmation"],
});

export const mobileTokenSchema = z.object({
  token: z.string().min(20, "Token tidak valid"),
});

export const mobileRefreshSchema = z.object({
  refresh_token: z.string().min(20, "Refresh token tidak valid"),
});

export const trackingConsentSchema = z.object({
  policy_version: z.string().min(1).max(40),
  platform: z.enum(["ANDROID", "IOS", "OTHER"]).optional(),
  app_version: z.string().max(40).optional(),
});

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------

// GT06N sends binary DateTime fields decoded by Traccar to ISO-8601 deviceTime — epoch ms not needed.
const isoDateTimeLike = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T/));
const numeric = (schema) => z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  schema
);
const optionalNumeric = (schema) => z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  schema.optional()
);
const optionalBoolean = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && (value === 0 || value === 1)) return Boolean(value);
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return value;
}, z.boolean().optional());
const optionalText = (schema) => z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  schema.optional()
);
const vehicleStatusSchema = z.enum(["IN_SERVICE", "DEADHEAD_TO_BASE", "OUT_OF_SERVICE", "MAINTENANCE", "EMERGENCY"]);

export const vehicleTelemetrySchema = z.object({
  vehicle_id: z.string().uuid("vehicle_id harus UUID").optional(),
  plate_no: z.string().trim().min(1, "plate_no tidak boleh kosong").max(20).optional(),
  device_id: z.string().trim().min(1, "device_id tidak boleh kosong").max(100).optional(),
  imei_or_serial: z.string().trim().min(1, "imei_or_serial tidak boleh kosong").max(100).optional(),
  ts: isoDateTimeLike.optional(),
  timestamp: isoDateTimeLike.optional(),
  lat: numeric(z.coerce.number({ message: "Latitude harus numeric" }).min(-90).max(90, "Latitude tidak valid")),
  lon: numeric(z.coerce.number({ message: "Longitude harus numeric" }).min(-180).max(180, "Longitude tidak valid")),
  speed_kmh: optionalNumeric(z.coerce.number().min(0).max(200)).optional(),
  heading: optionalNumeric(z.coerce.number().min(0).max(360)).optional(),
  heading_deg: optionalNumeric(z.coerce.number().min(0).max(360)).optional(),
  accuracy_m: optionalNumeric(z.coerce.number().min(0).max(10000)).optional(),
  battery_level: optionalNumeric(z.coerce.number().min(0).max(1)).optional(),
  signal_dbm: optionalNumeric(z.coerce.number().min(-150).max(0)).optional(),
  power_connected: optionalBoolean,
  status: vehicleStatusSchema.optional(),
  mode: vehicleStatusSchema.optional(),
  device: z.object({
    device_id: z.string().trim().min(1).max(100).optional(),
    imei_or_serial: z.string().trim().min(1).max(100).optional(),
    battery: optionalNumeric(z.coerce.number().min(0).max(1)).optional(),
    signal_dbm: optionalNumeric(z.coerce.number().min(-150).max(0)).optional(),
    power_connected: optionalBoolean,
  }).optional(),
}).refine((value) => Boolean(
  value.vehicle_id
  || value.plate_no
  || value.device_id
  || value.imei_or_serial
  || value.device?.device_id
  || value.device?.imei_or_serial
), {
  message: "vehicle_id, plate_no, device_id, atau imei_or_serial wajib diisi",
  path: ["vehicle_id"],
});

export const passengerTelemetrySchema = z.object({
  session_id: z.string().uuid("session_id harus UUID"),
  lat: numeric(z.coerce.number({ message: "Latitude harus numeric" }).min(-90).max(90)),
  lon: numeric(z.coerce.number({ message: "Longitude harus numeric" }).min(-180).max(180)),
  accuracy: optionalNumeric(z.coerce.number().min(0)).optional(),
  timestamp: isoDateTimeLike.optional(),
  app_state: z.enum(["FOREGROUND", "BACKGROUND"]).optional(),
});

const emergencyCategorySchema = z.enum(["SECURITY", "MEDICAL", "ACCIDENT", "HARASSMENT", "PANIC_BUTTON", "OTHER"]);

export const sosEmergencySchema = z.object({
  lat: numeric(z.coerce.number({ message: "Latitude harus numeric" }).min(-90).max(90)),
  lon: numeric(z.coerce.number({ message: "Longitude harus numeric" }).min(-180).max(180)),
  accuracy_m: optionalNumeric(z.coerce.number().min(0).max(10000)).optional(),
  category: emergencyCategorySchema.default("OTHER"),
  message: z.string().trim().min(10, "Pesan SOS minimal 10 karakter").max(1000),
  session_id: z.string().uuid("session_id harus UUID").optional(),
  vehicle_id: z.string().uuid("vehicle_id harus UUID").optional(),
  plate_no: z.string().trim().min(1).max(20).optional(),
  manual_override: z.boolean().optional(),
});

export const driverPanicSchema = z.object({
  vehicle_id: z.string().uuid("vehicle_id harus UUID").optional(),
  plate_no: z.string().trim().min(1).max(20).optional(),
  device_id: z.string().trim().min(1).max(100).optional(),
  imei_or_serial: z.string().trim().min(1).max(100).optional(),
  lat: numeric(z.coerce.number({ message: "Latitude harus numeric" }).min(-90).max(90)),
  lon: numeric(z.coerce.number({ message: "Longitude harus numeric" }).min(-180).max(180)),
  accuracy_m: optionalNumeric(z.coerce.number().min(0).max(10000)).optional(),
  timestamp: isoDateTimeLike.optional(),
}).refine((value) => Boolean(value.vehicle_id || value.plate_no || value.device_id || value.imei_or_serial), {
  message: "vehicle_id, plate_no, device_id, atau imei_or_serial wajib diisi",
  path: ["vehicle_id"],
});

// ---------------------------------------------------------------------------
// Master Data
// ---------------------------------------------------------------------------

export const ownerSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(200),
  owner_type: z.enum(["PERSONAL", "COOP", "COMPANY"], { message: "Tipe pemilik tidak valid" }),
  phone_primary: z.string().min(8, "Nomor HP tidak valid").max(20),
  phone_alt: z.string().max(20).optional().nullable(),
  email: z.string().email("Email tidak valid").optional().nullable(),
  base_name: z.string().max(200).optional().nullable(),
  base_lat: z.number().min(-90).max(90).optional().nullable(),
  base_lon: z.number().min(-180).max(180).optional().nullable(),
  base: z.object({
    name: z.string().max(200).optional().nullable(),
    lat: z.number().min(-90).max(90).optional().nullable(),
    lon: z.number().min(-180).max(180).optional().nullable(),
  }).optional().nullable(),
});

export const vehicleSchema = z.object({
  plate_no: z.string().min(1, "Plat nomor wajib diisi").max(20),
  route_id: z.string().min(1, "Route wajib diisi").max(10),
  owner_id: z.string().uuid("owner_id harus UUID").optional().nullable(),
  vehicle_code: z.string().max(50).optional().nullable(),
  status: z.string().optional(),
});

export const driverSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(200),
  phone: optionalText(z.string().min(8, "Nomor HP tidak valid").max(20)),
  sim_no: optionalText(z.string().max(50)),
  sim_expiry: optionalText(z.string()),
  sim_valid_until: optionalText(z.string()),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});

export const deviceSchema = z.object({
  device_type: z.enum(["GPS_IOT", "SMARTPHONE", "OBD_TRACKER", "HYBRID"]),
  imei_or_serial: z.string().max(100).optional().nullable(),
  sim_msisdn: z.string().max(20).optional().nullable(),
  provider: z.string().max(100).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "ASSIGNED", "AVAILABLE"]).optional(),
});

export const geofenceSchema = z.object({
  name: z.string().min(1, "Nama geofence wajib diisi").max(200),
  type: z.enum(["TERMINAL", "STOP", "HALTE", "BASE", "DANGER_ZONE", "RESTRICTED"]),
  route_id: z.string().max(10).optional().nullable(),
  coordinates: z.any().refine((val) => val != null, "Koordinat wajib diisi"),
});

// ---------------------------------------------------------------------------
// Public Report
// ---------------------------------------------------------------------------

export const publicReportSchema = z.object({
  plate_no: z.string().min(1, "Plat nomor wajib diisi").max(20),
  category: z.enum(["NGETEM", "RECKLESS_DRIVING", "SECURITY", "SERVICE", "OTHER"]),
  description: z.string().min(10, "Deskripsi minimal 10 karakter").max(2000),
  lat: numeric(z.coerce.number({ message: "Latitude harus numeric" }).min(-90).max(90)),
  lon: numeric(z.coerce.number({ message: "Longitude harus numeric" }).min(-180).max(180)),
  reported_at: z.string().optional(),
  accuracy_m: optionalNumeric(z.coerce.number().min(0)).optional(),
});

// ---------------------------------------------------------------------------
// Validation Middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware factory: validates req.body (or req[source]) against a Zod schema.
 * On failure returns 400 with `{ error: { code: "VALIDATION_ERROR", details: [...] } }`.
 */
export function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Data tidak valid",
          details,
        },
      });
    }
    // Replace with parsed (coerced/transformed) data
    req[source] = result.data;
    next();
  };
}
