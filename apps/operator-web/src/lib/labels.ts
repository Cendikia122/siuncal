export const VEHICLE_STATUS_LABEL: Record<string, string> = {
  IN_SERVICE: "Beroperasi",
  IDLE: "Berhenti",
  OFF_ROUTE: "Keluar Trayek",
  SOS: "Darurat (SOS)",
  OUT_OF_SERVICE: "Tidak Beroperasi",
  OFFLINE: "Tidak Terhubung",
}

export const INCIDENT_SEVERITY_LABEL: Record<string, string> = {
  CRITICAL: "Kritis",
  HIGH: "Tinggi",
  MEDIUM: "Sedang",
  LOW: "Rendah",
}

export const INCIDENT_STATUS_LABEL: Record<string, string> = {
  OPEN: "Terbuka",
  ACKNOWLEDGED: "Diterima",
  IN_PROGRESS: "Ditangani",
  RESOLVED: "Selesai",
  FALSE_ALARM: "Alarm Palsu",
  CLOSED: "Ditutup",
}

export const RISK_LEVEL_LABEL: Record<string, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  CRITICAL: "Kritis",
}

export const SANCTION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktif",
  EXPIRED: "Kedaluwarsa",
  REVOKED: "Dicabut",
}

export const SANCTION_TYPE_LABEL: Record<string, string> = {
  WARNING: "Peringatan",
  COACHING: "Pembinaan",
  ADMINISTRATIVE: "Administratif",
  SUSPENSION: "Penangguhan",
  ROUTE_BAN: "Larangan Trayek",
  PROBATION: "Masa Percobaan",
}

export const SERVICE_STATUS_LABEL: Record<string, string> = {
  OK: "Normal",
  DEGRADED: "Terganggu",
  ERROR: "Error",
  UNKNOWN: "Tidak Diketahui",
}

export const DRIVER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Tidak Aktif",
}

export const OWNER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktif",
  VERIFIED: "Terverifikasi",
  PENDING: "Menunggu Verifikasi",
  SUSPENDED: "Ditangguhkan",
}

export const OWNER_TYPE_LABEL: Record<string, string> = {
  PERSONAL: "Perorangan",
  COOPERATIVE: "Koperasi",
  COMPANY: "Perusahaan",
}

export const INCIDENT_TYPE_LABEL: Record<string, string> = {
  EMERGENCY: "Emergency",
  SOS: "Darurat (SOS)",
  OFF_ROUTE: "Keluar Trayek",
  NGETEM: "Ngetem",
  LOST_SIGNAL: "Sinyal Hilang",
  OVERSPEED: "Kecepatan Berlebih",
  WRONG_DIRECTION: "Arah Salah",
  DEVICE_TAMPER: "Gangguan Perangkat",
}

export const DEVICE_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: "Terpasang",
  AVAILABLE: "Tersedia",
  DECOMMISSIONED: "Tidak Digunakan",
}

export const DEVICE_HEALTH_LABEL: Record<string, string> = {
  ONLINE: "Aktif",
  OFFLINE: "Tidak Aktif",
}

export const PUBLIC_REPORT_STATUS_LABEL: Record<string, string> = {
  ALL: "Semua",
  PENDING_REVIEW: "Menunggu Review",
  ACKNOWLEDGED: "Diterima",
  REJECTED: "Ditolak",
  ESCALATED_TO_INCIDENT: "Dieskalasi",
  RESOLVED: "Selesai",
}

export const REPORT_VERDICT_LABEL: Record<string, string> = {
  CONFIRMED: "Terkonfirmasi",
  LIKELY: "Kemungkinan Benar",
  REJECT_SUSPECTED_SPAM: "Ditolak (Spam)",
}

export const GEOFENCE_TYPE_LABEL: Record<string, string> = {
  POINT: "Titik",
  POLYGON: "Area",
  BUFFER: "Buffer",
}

export const HEATMAP_TYPE_LABEL: Record<string, string> = {
  STOP_DENSITY: "Kepadatan Halte",
  NGETEM_ZONE: "Zona Ngetem",
  OFF_ROUTE_ZONE: "Zona Keluar Trayek",
  SPEED_ZONE: "Zona Kecepatan",
}

export function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "-"
  return map[key] ?? key
}
