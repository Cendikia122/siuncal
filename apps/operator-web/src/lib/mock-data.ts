import { demoImeiOrSerial, demoPlateNo, demoVehicleCode } from "./demo-scenario.mjs"

type MockRequestOptions = RequestInit & { _retry?: boolean }

type MockJson = Record<string, unknown> | unknown[] | string | number | boolean | null

const now = new Date()
const iso = (minutesAgo = 0) => new Date(now.getTime() - minutesAgo * 60_000).toISOString()
const today = now.toISOString().slice(0, 10)

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const demoVehicleIdentity = (routeId: string, fleetNo: number) => ({
  plate_no: demoPlateNo(routeId, fleetNo),
  vehicle_code: demoVehicleCode(routeId, fleetNo),
})
const demoPlates = {
  route01Fleet1: demoPlateNo("01", 1),
  route01Fleet7: demoPlateNo("01", 7),
  route02Fleet1: demoPlateNo("02", 1),
  route03Fleet1: demoPlateNo("03", 1),
}

const mockUser = {
  user_id: "user-demo-analisa",
  username: "analisa.demo",
  email: "analisa@pemda.go.id",
  full_name: "Demo Analisa Dishub Bogor",
  role: "ANALISA",
  roles: ["ANALISA"],
  owner_id: null,
  active: true,
}

const routes = [
  {
    route_id: "01",
    name: "Trayek 01 — Baranangsiang - Bubulak",
    color: "#10b981",
    outbound: { coordinates: [[106.8061, -6.6012], [106.7998, -6.5944], [106.7871, -6.5872], [106.7741, -6.5798]] },
    inbound: { coordinates: [[106.7741, -6.5798], [106.7862, -6.5878], [106.7991, -6.5948], [106.8061, -6.6012]] },
    corridor: { type: "Polygon", coordinates: [[[106.807, -6.603], [106.809, -6.599], [106.775, -6.577], [106.772, -6.581], [106.807, -6.603]]] },
    stops: [
      { stop_id: "stop-01-a", route_id: "01", name: "Terminal Baranangsiang", lat: -6.6012, lng: 106.8061, seq: 1 },
      { stop_id: "stop-01-b", route_id: "01", name: "Tugu Kujang", lat: -6.5944, lng: 106.7998, seq: 2 },
      { stop_id: "stop-01-c", route_id: "01", name: "Bubulak", lat: -6.5798, lng: 106.7741, seq: 3 },
    ],
  },
  {
    route_id: "02",
    name: "Trayek 02 — Sukasari - Merdeka",
    color: "#38bdf8",
    outbound: { coordinates: [[106.8126, -6.6134], [106.8052, -6.6048], [106.7928, -6.5961], [106.786, -6.5898]] },
    inbound: { coordinates: [[106.786, -6.5898], [106.794, -6.5964], [106.8056, -6.6044], [106.8126, -6.6134]] },
    corridor: { type: "Polygon", coordinates: [[[106.814, -6.615], [106.816, -6.611], [106.787, -6.587], [106.783, -6.591], [106.814, -6.615]]] },
    stops: [
      { stop_id: "stop-02-a", route_id: "02", name: "Sukasari", lat: -6.6134, lng: 106.8126, seq: 1 },
      { stop_id: "stop-02-b", route_id: "02", name: "Botani Square", lat: -6.6048, lng: 106.8052, seq: 2 },
      { stop_id: "stop-02-c", route_id: "02", name: "Merdeka", lat: -6.5898, lng: 106.786, seq: 3 },
    ],
  },
  {
    route_id: "03",
    name: "Trayek 03 — Empang - Warung Jambu",
    color: "#f97316",
    outbound: { coordinates: [[106.7954, -6.6118], [106.8005, -6.5991], [106.8058, -6.5892], [106.8128, -6.5794]] },
    inbound: { coordinates: [[106.8128, -6.5794], [106.805, -6.5898], [106.8001, -6.5998], [106.7954, -6.6118]] },
    corridor: { type: "Polygon", coordinates: [[[106.793, -6.613], [106.797, -6.615], [106.815, -6.581], [106.811, -6.577], [106.793, -6.613]]] },
    stops: [
      { stop_id: "stop-03-a", route_id: "03", name: "Empang", lat: -6.6118, lng: 106.7954, seq: 1 },
      { stop_id: "stop-03-b", route_id: "03", name: "Pasar Bogor", lat: -6.5991, lng: 106.8005, seq: 2 },
      { stop_id: "stop-03-c", route_id: "03", name: "Warung Jambu", lat: -6.5794, lng: 106.8128, seq: 3 },
    ],
  },
]

const owners = [
  { owner_id: "owner-1", name: "Koperasi Angkot Bogor Barat", owner_type: "KOPERASI", status: "ACTIVE", phone_primary: "081200000001", email: "bogorbarat@example.local", base_name: "Pool Bubulak", total_fleet: 12, active_fleet: 10, avg_risk_score: 34, high_risk_vehicle_count: 1, critical_risk_vehicle_count: 0, incident_count_7d: 4 },
  { owner_id: "owner-2", name: "PT Transportasi Kota Hujan", owner_type: "PERUSAHAAN", status: "ACTIVE", phone_primary: "081200000002", email: "kotahujan@example.local", base_name: "Pool Sukasari", total_fleet: 9, active_fleet: 8, avg_risk_score: 48, high_risk_vehicle_count: 2, critical_risk_vehicle_count: 1, incident_count_7d: 7 },
]

const vehicles = [
  { vehicle_id: "veh-01", ...demoVehicleIdentity("01", 1), route_id: "01", owner_id: "owner-1", owner_name: owners[0].name, status: "ONLINE", lat: -6.5944, lon: 106.7998, speed: 24, heading: 72, last_ping: iso(1), alert_status: "NORMAL", risk_score: 28, risk_level: "LOW", brand: "Suzuki", model: "Carry", year: 2019, color: "Hijau", capacity: 12, active_sanction_count: 0 },
  { vehicle_id: "veh-02", ...demoVehicleIdentity("02", 1), route_id: "02", owner_id: "owner-2", owner_name: owners[1].name, status: "NGETEM", lat: -6.6048, lon: 106.8052, speed: 0, heading: 130, last_ping: iso(2), alert_status: "NGETEM", risk_score: 62, risk_level: "HIGH", brand: "Daihatsu", model: "Gran Max", year: 2020, color: "Biru", capacity: 12, active_sanction_count: 1 },
  { vehicle_id: "veh-03", ...demoVehicleIdentity("03", 1), route_id: "03", owner_id: "owner-1", owner_name: owners[0].name, status: "OFF_ROUTE", lat: -6.5922, lon: 106.8104, speed: 38, heading: 15, last_ping: iso(4), alert_status: "OFF_ROUTE", risk_score: 74, risk_level: "CRITICAL", brand: "Mitsubishi", model: "Colt", year: 2018, color: "Oranye", capacity: 12, active_sanction_count: 1 },
  { vehicle_id: "veh-04", ...demoVehicleIdentity("01", 7), route_id: "01", owner_id: "owner-2", owner_name: owners[1].name, status: "OFFLINE", lat: -6.5872, lon: 106.7871, speed: 0, heading: 270, last_ping: iso(45), alert_status: "LOST_SIGNAL", risk_score: 51, risk_level: "MEDIUM", brand: "Suzuki", model: "Carry", year: 2017, color: "Hijau", capacity: 12, active_sanction_count: 0 },
]

const incidents = [
  { id: "inc-1", incident_id: "inc-1", type: "NGETEM", severity: "HIGH", status: "OPEN", description: "Kendaraan berhenti lebih dari 8 menit di area Botani Square.", timestamp: iso(8), created_at: iso(8), vehicle_id: "veh-02", vehicle_plate: demoPlates.route02Fleet1, plate_no: demoPlates.route02Fleet1, route_id: "02", location: "Botani Square", location_desc: "Jl. Pajajaran dekat Botani Square", assigned_to: "user-demo-analisa", assigned_name: "Demo Analisa Dishub Bogor", lat: -6.6048, lon: 106.8052, resolved_at: null },
  { id: "inc-2", incident_id: "inc-2", type: "OFF_ROUTE", severity: "CRITICAL", status: "ACKNOWLEDGED", description: "Kendaraan keluar koridor trayek 03 sejauh ±420 meter.", timestamp: iso(18), created_at: iso(18), vehicle_id: "veh-03", vehicle_plate: demoPlates.route03Fleet1, plate_no: demoPlates.route03Fleet1, route_id: "03", location: "Jl. Ahmad Yani", location_desc: "Keluar koridor Warung Jambu", assigned_to: "user-demo-analisa", assigned_name: "Demo Analisa Dishub Bogor", lat: -6.5922, lon: 106.8104, resolved_at: null },
  { id: "inc-3", incident_id: "inc-3", type: "LOST_SIGNAL", severity: "MEDIUM", status: "OPEN", description: "Device tidak mengirim posisi lebih dari 30 menit.", timestamp: iso(45), created_at: iso(45), vehicle_id: "veh-04", vehicle_plate: demoPlates.route01Fleet7, plate_no: demoPlates.route01Fleet7, route_id: "01", location: "Koridor Bubulak", location_desc: "Terakhir terdeteksi dekat Bubulak", assigned_to: null, assigned_name: null, lat: -6.5872, lon: 106.7871, resolved_at: null },
]

const emergencies = [
  {
    id: "emg-1",
    incident_id: "emg-1",
    type: "EMERGENCY",
    severity: "CRITICAL",
    status: "OPEN",
    description: "SOS SECURITY: Penumpang merasa tidak aman di dalam angkot.",
    location: "Stasiun Bogor",
    location_desc: "Stasiun Bogor",
    lat: -6.594078,
    lon: 106.790822,
    created_at: iso(2),
    acknowledged_at: null,
    assigned_to: null,
    assigned_name: null,
    source: "PASSENGER_APP",
    emergency_category: "SECURITY",
    trust_level: "HIGH",
    escalation_state: "ON_TRACK",
    ack_due_at: iso(-1),
    assignment_due_at: iso(-3),
    plate_no: demoPlates.route01Fleet1,
    route_id: "01",
    nearest_vehicle: { vehicle_id: "veh-01", plate_no: demoPlates.route01Fleet1, route_id: "01", distance_m: 42 },
    sla: { ack_due_at: iso(-1), assignment_due_at: iso(-3) },
  },
]

const drivers = [
  { driver_id: "driver-1", name: "Dedi Pratama", phone: "081299900001", sim_no: "SIM-A-0001", sim_expiry: "2027-09-01", status: "ACTIVE" },
  { driver_id: "driver-2", name: "Asep Hidayat", phone: "081299900002", sim_no: "SIM-A-0002", sim_expiry: "2026-12-12", status: "ACTIVE" },
]

const devices = [
  { device_id: "dev-1", device_type: "GPS_GT06", imei_or_serial: demoImeiOrSerial("01", 1), provider: "Demo GPS", status: "ACTIVE", plate_no: demoPlates.route01Fleet1, route_id: "01", last_ping: iso(1), health: "ONLINE", minutes_since: 1 },
  { device_id: "dev-2", device_type: "GPS_GT06", imei_or_serial: demoImeiOrSerial("02", 1), provider: "Demo GPS", status: "ACTIVE", plate_no: demoPlates.route02Fleet1, route_id: "02", last_ping: iso(2), health: "ONLINE", minutes_since: 2 },
  { device_id: "dev-3", device_type: "GPS_GT06", imei_or_serial: demoImeiOrSerial("01", 7), provider: "Demo GPS", status: "ACTIVE", plate_no: demoPlates.route01Fleet7, route_id: "01", last_ping: iso(45), health: "OFFLINE", minutes_since: 45, power_disconnect_count_24h: 1, last_power_disconnect_at: iso(45), power_disconnect_then_lost_signal: true, impossible_movement_count_24h: 1, repeated_identity_mismatch_count_24h: 3, anomaly_candidate: { rule: "DEVICE_TAMPER", status: "candidate", severity: "HIGH", reasons: ["POWER_DISCONNECT_THEN_LOST_SIGNAL", "IMPOSSIBLE_MOVEMENT", "REPEATED_IDENTITY_MISMATCH"], evidence: { impossible_movement_count_24h: 1, repeated_identity_mismatch_count_24h: 3 } } },
]

const notifications = incidents.slice(0, 2).map((incident, index) => ({
  notification_id: `notif-${index + 1}`,
  incident_id: incident.incident_id,
  channel: "IN_APP",
  status: "SENT",
  type: incident.type,
  severity: incident.severity,
  vehicle_plate: incident.plate_no,
  location: incident.location_desc,
  message: incident.description,
  payload: { rule: incident.type, severity: incident.severity, message: incident.description },
  created_at: incident.created_at,
  read_at: index === 0 ? null : iso(5),
}))

const publicReports = [
  { public_report_id: "pr-1", reporter_name: "Warga Demo", vehicle_id: "veh-02", incident_id: "inc-1", route_id: "02", plate_no: demoPlates.route02Fleet1, category: "NGETEM", status: "PENDING_REVIEW", plate_match_status: "MATCHED", description: "Angkot berhenti lama dan menutup akses halte.", lat: -6.6047, lon: 106.8051, accuracy_m: 12, reported_at: iso(10), vehicle_last_lat: -6.6048, vehicle_last_lon: 106.8052, vehicle_last_seen_at: iso(2), distance_to_vehicle_m: 18, route_name: "Trayek 02", latest_speed_kmh: 0, active_anomaly: "NGETEM", active_alert: "NGETEM", attachment_count: 1, latest_review: null },
]

const heatmapPoints = [
  { grid_lat: -6.6048, grid_lon: 106.8052, route_id: "02", metric: "STOP_DENSITY", value: 0.88, vehicle_count: 8, metadata: { label: "Botani Square" }, created_at: iso(30) },
  { grid_lat: -6.5922, grid_lon: 106.8104, route_id: "03", metric: "OFF_ROUTE_ZONE", value: 0.72, vehicle_count: 4, metadata: { label: "Ahmad Yani" }, created_at: iso(30) },
  { grid_lat: -6.5944, grid_lon: 106.7998, route_id: "01", metric: "SPEED_ZONE", value: 0.46, vehicle_count: 6, metadata: { label: "Tugu Kujang" }, created_at: iso(30) },
]

const telemetryQualityReport = () => {
  const expected = 720
  const items = vehicles.map((vehicle, index) => {
    const stale = vehicle.status === "OFFLINE"
    const assignmentMismatch = vehicle.vehicle_id === "veh-04"
    const pingCount = stale ? 48 : index === 2 ? 610 : 700 - index * 12
    const driftCount = vehicle.status === "OFF_ROUTE" ? 16 : vehicle.status === "NGETEM" ? 4 : stale ? 7 : 1
    const missingPingCount = Math.max(expected - pingCount, 0)
    const trackingValidPct = Number(((pingCount / expected) * 100).toFixed(2))
    const penalty = (stale ? 15 : 0) + (assignmentMismatch ? 10 : 0) + Math.min((driftCount / Math.max(pingCount, 1)) * 100, 20)
    const qualityScore = Number(Math.max(0, trackingValidPct - penalty).toFixed(2))
    const qualityLevel = qualityScore >= 95 ? "GOOD" : qualityScore >= 85 ? "WATCH" : qualityScore >= 70 ? "DEGRADED" : "CRITICAL"
    return {
      vehicle_id: vehicle.vehicle_id,
      plate_no: vehicle.plate_no,
      route_id: vehicle.route_id,
      route_name: routes.find((route) => route.route_id === vehicle.route_id)?.name || vehicle.route_id,
      owner_id: vehicle.owner_id,
      owner_name: vehicle.owner_name,
      device_id: assignmentMismatch ? null : `dev-${index + 1}`,
      imei_or_serial: assignmentMismatch ? null : demoImeiOrSerial(vehicle.route_id, index + 1),
      status: vehicle.status,
      last_ping: vehicle.last_ping,
      minutes_since_last_ping: stale ? 45 : index + 1,
      stale,
      assignment_mismatch: assignmentMismatch,
      ping_count: pingCount,
      expected_ping_count: expected,
      missing_ping_count: missingPingCount,
      duplicate_timestamp_count: index === 1 ? 2 : 0,
      drift_count: driftCount,
      low_confidence_count: driftCount > 4 ? 3 : 0,
      avg_snap_distance_m: driftCount > 4 ? 48 : 9,
      p95_snap_distance_m: driftCount > 4 ? 96 : 18,
      tracking_valid_pct: trackingValidPct,
      drift_rate_pct: Number(((driftCount / Math.max(pingCount, 1)) * 100).toFixed(2)),
      quality_score: qualityScore,
      quality_level: qualityLevel,
    }
  })

  const aggregateBy = (key: "route_id" | "device_id", label: "route_name" | "imei_or_serial") => {
    const groups = new Map<string, typeof items>()
    for (const item of items) {
      const groupKey = String(item[key] || "UNASSIGNED")
      groups.set(groupKey, [...(groups.get(groupKey) || []), item])
    }
    return [...groups.entries()].map(([id, groupItems]) => {
      const avg = (field: "tracking_valid_pct" | "quality_score") => Number((groupItems.reduce((sum, item) => sum + item[field], 0) / groupItems.length).toFixed(2))
      return {
        [key]: id,
        [label]: groupItems[0][label] || (id === "UNASSIGNED" ? "Tanpa device aktif" : id),
        total_vehicles: groupItems.length,
        stale_vehicles: groupItems.filter((item) => item.stale).length,
        missing_ping_count: groupItems.reduce((sum, item) => sum + item.missing_ping_count, 0),
        drift_count: groupItems.reduce((sum, item) => sum + item.drift_count, 0),
        duplicate_timestamp_count: groupItems.reduce((sum, item) => sum + item.duplicate_timestamp_count, 0),
        tracking_valid_pct: avg("tracking_valid_pct"),
        quality_score: avg("quality_score"),
        quality_level: avg("quality_score") >= 95 ? "GOOD" : avg("quality_score") >= 85 ? "WATCH" : avg("quality_score") >= 70 ? "DEGRADED" : "CRITICAL",
      }
    })
  }

  const totals = {
    expected: items.reduce((sum, item) => sum + item.expected_ping_count, 0),
    pings: items.reduce((sum, item) => sum + item.ping_count, 0),
    missing: items.reduce((sum, item) => sum + item.missing_ping_count, 0),
    drift: items.reduce((sum, item) => sum + item.drift_count, 0),
    duplicates: items.reduce((sum, item) => sum + item.duplicate_timestamp_count, 0),
  }
  const trackingValidPct = Number(((totals.pings / totals.expected) * 100).toFixed(2))

  return {
    window: { start: iso(60), end: iso(0), hours: 1, target_interval_sec: 5, stale_minutes: 10, drift_threshold_m: 80, expected_ping_count: expected },
    summary: {
      total_vehicles: items.length,
      stale_vehicles: items.filter((item) => item.stale).length,
      assignment_mismatch_vehicles: items.filter((item) => item.assignment_mismatch).length,
      missing_ping_count: totals.missing,
      drift_count: totals.drift,
      duplicate_timestamp_count: totals.duplicates,
      tracking_valid_pct: trackingValidPct,
      quality_score: Number((items.reduce((sum, item) => sum + item.quality_score, 0) / items.length).toFixed(2)),
      sla_target_pct: 99.5,
      sla_met: trackingValidPct >= 99.5,
      rolling_rejections: { invalid_device_identity: 2, assignment_mismatch: 1, duplicate_payload: 3 },
    },
    items,
    by_route: aggregateBy("route_id", "route_name"),
    by_owner: [],
    by_device: aggregateBy("device_id", "imei_or_serial").map((item) => ({ ...item, device_id: item.device_id === "UNASSIGNED" ? "UNASSIGNED" : item.device_id })),
  }
}

const response = (value: MockJson) => clone(value)
const items = (value: unknown[]) => response({ items: value, total: value.length })

const findVehicle = (id: string) => vehicles.find((vehicle) => vehicle.vehicle_id === id) || vehicles[0]
const findIncident = (id: string) => incidents.find((incident) => incident.incident_id === id || incident.id === id) || incidents[0]
const allStops = () => routes.flatMap((route) => route.stops)

const getPath = (path: string) => new URL(path, "https://mock.sentra.local")

export async function getMockApiResponse<T>(path: string, options: MockRequestOptions = {}): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 80))

  const method = (options.method || "GET").toUpperCase()
  const url = getPath(path)
  const pathname = url.pathname

  if (pathname === "/auth/login") return response({ user: mockUser }) as T
  if (pathname === "/auth/refresh" || pathname === "/auth/logout") return response({ ok: true }) as T
  if (pathname === "/me") return response(mockUser) as T

  if (method !== "GET") {
    return response({ ok: true, mock: true, id: "mock-action", updated_at: iso(0) }) as T
  }

  if (pathname === "/dashboard/summary") {
    return response({
      vehicles: { total_vehicles: vehicles.length },
      online: vehicles.filter((vehicle) => vehicle.status !== "OFFLINE").length,
      incidents,
      alerts: incidents,
    }) as T
  }

  if (pathname === "/routes") return items(routes) as T
  if (pathname === "/stops") {
    const routeId = url.searchParams.get("route_id")
    const stops = routeId ? allStops().filter((stop) => stop.route_id === routeId) : allStops()
    return items(stops) as T
  }
  if (pathname === "/geofences") {
    return items(routes.map((route) => ({ geofence_id: `geo-${route.route_id}`, name: `Koridor ${route.route_id}`, type: "ROUTE_CORRIDOR", route_id: route.route_id, geom: route.corridor }))) as T
  }

  if (pathname === "/vehicles") return items(vehicles) as T
  if (pathname.match(/^\/vehicles\/[^/]+\/playback\/records$/)) {
    return items([{ record_id: "rec-1", start: iso(120), end: iso(30), point_count: 24, event_count: 2, storage_bucket: "mock", storage_key: "playback/demo.json", object_url: "#", byte_size: 4096, created_at: iso(25) }]) as T
  }
  if (pathname.match(/^\/vehicles\/[^/]+\/playback$/)) {
    return response({
      positions: [0, 1, 2, 3, 4].map((i) => ({ ts: iso(30 - i * 5), lat: -6.6048 + i * 0.002, lon: 106.8052 - i * 0.002, speed: 18 + i, heading: 70, status: "ONLINE", match_status: "MATCHED", snapped_lat: -6.6048 + i * 0.002, snapped_lon: 106.8052 - i * 0.002 })),
      events: incidents.slice(0, 2),
      truncated: false,
    }) as T
  }
  if (pathname.match(/^\/vehicles\/[^/]+\/incidents$/)) return items(incidents) as T
  if (pathname.match(/^\/vehicles\/[^/]+$/)) {
    const id = pathname.split("/")[2]
    const vehicle = findVehicle(id)
    return response({
      vehicle,
      documents: [{ document_id: "doc-1", doc_type: "STNK", file_url: "#", expiry_date: "2027-12-31" }],
      assignment: { driver_name: drivers[0].name, driver_phone: drivers[0].phone, device_serial: devices[0].imei_or_serial, imei_or_serial: devices[0].imei_or_serial, shift_name: "Pagi", shift_start: "06:00", shift_end: "14:00" },
    }) as T
  }

  if (pathname === "/owners") return items(owners) as T
  if (pathname.match(/^\/owners\/[^/]+$/)) {
    const id = pathname.split("/")[2]
    const owner = owners.find((item) => item.owner_id === id) || owners[0]
    return response({ owner, vehicles: vehicles.filter((vehicle) => vehicle.owner_id === owner.owner_id), risk_context: { avg_risk_score: owner.avg_risk_score, high_risk_vehicle_count: owner.high_risk_vehicle_count }, incidents_7d: incidents, active_sanctions: [], active_sanction_count: owner.critical_risk_vehicle_count }) as T
  }

  if (pathname === "/drivers") return items(drivers) as T
  if (pathname === "/devices/health") return response({ items: devices, summary: { total_devices: devices.length, online_devices: 2, offline_devices: 1, no_telemetry_devices: 0, frequently_reassigned_devices: 0, impossible_movement_devices: 1, power_disconnect_lost_signal_devices: 1, repeated_identity_mismatch_devices: 1, device_tamper_candidates: 1, device_tamper_identity_mismatch_threshold: 3, device_tamper_impossible_speed_kmh: 140, offline_threshold_min: 10 } }) as T
  if (pathname === "/devices") return items(devices) as T
  if (pathname === "/telemetry/quality") return response(telemetryQualityReport()) as T
  if (pathname === "/assignments") return items([{ assignment_id: "asg-1", plate_no: "F 1901 AK", driver_name: drivers[0].name, imei_or_serial: devices[0].imei_or_serial, shift_name: "Pagi", shift_start: "06:00", shift_end: "14:00", is_active: true }]) as T

  if (pathname === "/passengers/active") return items([{ user_id: "passenger-1", session_id: "trip-1", name: "Penumpang Demo", email: "warga@siuncal.id", phone: "081233344455", lat: -6.6004, lon: 106.8012, accuracy: 18, last_seen_at: iso(1), app_state: "FOREGROUND", nearest_plate_no: "F 1901 AK", nearest_vehicle_distance_m: 42 }]) as T
  if (pathname === "/notifications") return response({ items: notifications, unread: notifications.filter((item) => !item.read_at).length }) as T

  if (pathname === "/incident-assignees") return items([{ user_id: mockUser.user_id, full_name: mockUser.full_name }, { user_id: "user-field", full_name: "Petugas Lapangan Demo" }]) as T
  if (pathname === "/emergencies") return items(emergencies) as T
  if (pathname === "/incidents/sla") return response({ items: incidents.map((incident) => ({ ...incident, ack_minutes: 6, resolve_minutes: 42, ack_breached: false, resolve_breached: incident.severity === "CRITICAL" })), summary: { total: incidents.length, ack_breached: 0, resolve_breached: 1 } }) as T
  if (pathname === "/incidents") return items(incidents) as T
  if (pathname.match(/^\/incidents\/[^/]+$/)) {
    const incident = findIncident(pathname.split("/")[2])
    return response({ incident, actions: [{ action_id: "act-1", action: "ACK", notes: "Diakui oleh operator demo.", actor_name: mockUser.full_name, created_at: iso(6) }] }) as T
  }

  if (pathname === "/operator/public-reports") return items(publicReports) as T
  if (pathname.match(/^\/operator\/public-reports\/[^/]+$/)) {
    return response({ report: publicReports[0], attachments: [{ attachment_id: "att-1", content_type: "image/jpeg", file_size_bytes: 128000, original_filename: "bukti-demo.jpg", uploaded_at: iso(9), download_url: "#" }], actions: [{ action_id: "pra-1", action: "AUTO_REVIEW", notes: "Mock review siap untuk demo.", actor_name: "System", created_at: iso(8) }] }) as T
  }

  if (pathname === "/reports/kpi") return response({ date: today, kpis: [{ title: "Armada Online", value: "75%", trend: "+8%", trend_up: true, color: "emerald" }, { title: "Insiden Aktif", value: String(incidents.length), trend: "-2", trend_up: false, color: "red" }, { title: "RIT Hari Ini", value: "42", trend: "+6", trend_up: true, color: "blue" }, { title: "Rata-rata Risiko", value: "54", trend: "+4", trend_up: false, color: "orange" }, { title: "Laporan Warga", value: "1", trend: "+1", trend_up: true, color: "purple" }], incidents_by_category: [{ label: "NGETEM", val: 7 }, { label: "OFF_ROUTE", val: 4 }, { label: "LOST_SIGNAL", val: 3 }] }) as T
  if (pathname === "/reports/rit") return items(vehicles.map((vehicle, index) => ({ report_date: today, vehicle_id: vehicle.vehicle_id, plate_no: vehicle.plate_no, route_id: vehicle.route_id, total_rit: 8 + index }))) as T

  if (pathname === "/observability/summary") return response({ checked_at: iso(0), services: [{ service: "operator-web", status: "OK", checked_at: iso(0), response_ms: 24, message: "Mock mode aktif" }, { service: "api-gateway", status: "MOCKED", checked_at: iso(0), response_ms: 0, message: "Backend real dinonaktifkan untuk deploy Vercel" }], telemetry_per_minute: [{ minute: iso(5), count: 12 }, { minute: iso(4), count: 18 }], last_successful_report_daily: iso(60), active_counts: { active_anomalies: 3, active_alerts: 2, active_incidents: incidents.length }, upload_metrics: { public_report_attachments: 1, failed_uploads: 0 }, job_errors: [] }) as T
  if (pathname === "/intelligence/fleet") return response({ generated_at: iso(0), top_high_risk_vehicles: vehicles.slice(1, 4), top_problematic_routes: [{ route_id: "02", route_name: "Trayek 02", anomaly_count: 7 }, { route_id: "03", route_name: "Trayek 03", anomaly_count: 5 }], recurring_anomalies: [{ type: "NGETEM", count: 7 }, { type: "OFF_ROUTE", count: 4 }] }) as T
  if (pathname === "/collective-anomalies") return items([{ collective_anomaly_id: "ca-1", type: "NGETEM_CLUSTER", severity: "HIGH", status: "OPEN", evidence: { route_id: "02", count: 4 }, involved_vehicles: ["F 2001 SB", "F 3001 BB"], detected_at: iso(22), escalation_count: 1 }]) as T

  if (pathname === "/network/graph") return response({ nodes: [{ id: "owner-1", type: "owner", label: owners[0].name, meta: owners[0] }, { id: "veh-01", type: "vehicle", label: "F 1901 AK", meta: vehicles[0] }, { id: "dev-1", type: "device", label: "GT06-DEMO-001", meta: devices[0] }, { id: "inc-1", type: "incident", label: "NGETEM", meta: incidents[0] }], edges: [{ source: "owner-1", target: "veh-01", type: "owns" }, { source: "veh-01", target: "dev-1", type: "device_installed" }, { source: "veh-01", target: "inc-1", type: "has_incident" }], rankings: { top_owners: owners.map((owner) => ({ owner_id: owner.owner_id, name: owner.name, incident_count: owner.incident_count_7d, avg_risk: owner.avg_risk_score })), top_routes: routes.map((route, index) => ({ route_id: route.route_id, route_name: route.name, anomaly_count: 7 - index })), top_devices: devices.map((device, index) => ({ device_id: device.device_id, imei_or_serial: device.imei_or_serial, assignment_count: 3 - index })) } }) as T
  if (pathname === "/sanctions") return items([{ sanction_id: "san-1", vehicle_id: "veh-03", owner_id: "owner-1", type: "WARNING", level: "HIGH", reason: "Pelanggaran off-route berulang pada jam sibuk.", evidence: { incident_id: "inc-2" }, incident_id: "inc-2", collective_anomaly_id: null, decided_at: iso(30), effective_from: today, effective_until: null, status: "ACTIVE", notes: "Demo sanction", plate_no: "F 3001 BB", owner_name: owners[0].name, decided_by_name: mockUser.full_name }]) as T
  if (pathname === "/compliance/fleet") return response({ items: owners.map((owner) => ({ owner_id: owner.owner_id, name: owner.name, owner_type: owner.owner_type, status: owner.status, total_vehicles: owner.total_fleet, avg_risk_score: owner.avg_risk_score, incident_count_30d: owner.incident_count_7d * 2, active_sanction_count: owner.critical_risk_vehicle_count, compliance_score: owner.owner_id === "owner-1" ? 82 : 66 })), summary: { total_owners: owners.length, avg_compliance: 74, total_active_sanctions: 1, total_vehicles: vehicles.length } }) as T

  if (pathname === "/analytics/heatmap") return response({ data: heatmapPoints }) as T
  if (pathname === "/analytics/heatmap/insights") return response({ insights: { busiest_stops: [{ route_id: "02", route_name: "Trayek 02", stop_name: "Botani Square", total_stops: 18, total_vehicles: 8 }], most_ngetem_routes: [{ route_id: "02", route_name: "Trayek 02", total_ngetem: 7, total_vehicles: 8 }], most_off_route_routes: [{ route_id: "03", route_name: "Trayek 03", total_off_route: 4, total_vehicles: 4 }], highest_speed_routes: [{ route_id: "01", route_name: "Trayek 01", avg_speed: 31, max_speed: 48, total_vehicles: 6 }] } }) as T
  if (pathname === "/analytics/heatmap/status") return response({ types: ["STOP_DENSITY", "NGETEM_ZONE", "OFF_ROUTE_ZONE", "SPEED_ZONE"].map((type) => ({ type, last_generated: iso(30), data_points: heatmapPoints.length })) }) as T

  if (pathname === "/audit-logs") return items([{ audit_id: "audit-1", actor_name: mockUser.full_name, action: "MOCK_MODE_VIEW", entity_type: "DEMO", entity_id: "mock", created_at: iso(2), metadata: { mock: true } }]) as T

  return response({ items: [], total: 0, mock: true }) as T
}
