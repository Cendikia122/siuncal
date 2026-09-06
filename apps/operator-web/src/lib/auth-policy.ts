export type UserRole = "ADMIN" | "ANALISA" | "SUPERVISOR" | "OPERATOR" | "PETUGAS_LAPANGAN" | "VIEWER"

export type FeatureKey =
  | "dashboard"
  | "emergencies"
  | "vehicles"
  | "incidents"
  | "public_reports"
  | "reports"
  | "owners"
  | "drivers"
  | "devices"
  | "routes"
  | "assignments"
  | "geofences"
  | "audit_logs"
  | "observability"
  | "telemetry_quality"
  | "intelligence"
  | "user_management"
  | "master_data_write"
  | "incident_actions"
  | "export_data"
  | "network"
  | "sanctions"
  | "compliance"
  | "heatmap"

export type AuthPolicyUser = {
  role?: UserRole | null
  roles?: string[] | null
}

export const FEATURE_ACCESS: Record<FeatureKey, UserRole[]> = {
  dashboard: ["ANALISA", "OPERATOR"],
  emergencies: ["ANALISA", "OPERATOR", "PETUGAS_LAPANGAN"],
  vehicles: ["ANALISA", "OPERATOR"],
  incidents: ["ANALISA", "OPERATOR"],
  public_reports: ["ANALISA", "OPERATOR"],
  reports: ["ANALISA"],
  owners: ["ANALISA", "OPERATOR"],
  drivers: ["ANALISA"],
  devices: ["ADMIN", "ANALISA"],
  routes: ["ANALISA", "OPERATOR"],
  assignments: ["ANALISA"],
  geofences: ["ADMIN", "ANALISA"],
  audit_logs: ["ANALISA"],
  observability: ["ANALISA"],
  telemetry_quality: ["ANALISA", "OPERATOR"],
  intelligence: ["ANALISA"],
  user_management: ["ANALISA"],
  master_data_write: ["ANALISA"],
  incident_actions: ["ANALISA", "OPERATOR"],
  export_data: ["ADMIN", "ANALISA"],
  network: ["ANALISA"],
  sanctions: ["ANALISA"],
  compliance: ["ANALISA"],
  heatmap: ["ANALISA"],
}

export const ROLES_WITH_FULL_ACCESS: UserRole[] = ["ADMIN", "ANALISA"]

export const hasAnyRole = (user: AuthPolicyUser | null | undefined, roles: UserRole | UserRole[]): boolean => {
  if (!user) return false
  const roleArray = Array.isArray(roles) ? roles : [roles]
  if (user.role && roleArray.includes(user.role)) return true
  if (user.roles && roleArray.some((role) => user.roles?.includes(role))) return true
  return false
}

export const canAccessFeature = (user: AuthPolicyUser | null | undefined, feature: FeatureKey): boolean => {
  const allowedRoles = FEATURE_ACCESS[feature]
  return hasAnyRole(user, allowedRoles)
}

export const hasFullDataAccess = (user: AuthPolicyUser | null | undefined): boolean => {
  return hasAnyRole(user, ROLES_WITH_FULL_ACCESS)
}

export const maskSensitiveData = <T,>(
  data: T,
  sensitiveKeys: string[],
  user: AuthPolicyUser | null | undefined
): T => {
  if (!user || hasFullDataAccess(user)) return data

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, sensitiveKeys, user)) as T
  }

  if (typeof data === "object" && data !== null) {
    const masked = { ...data } as Record<string, unknown>
    for (const key of sensitiveKeys) {
      if (key in masked && masked[key]) {
        const value = String(masked[key])
        masked[key] = value.length > 4 ? `${value.slice(0, 2)}****${value.slice(-2)}` : "****"
      }
    }
    return masked as T
  }

  return data
}
