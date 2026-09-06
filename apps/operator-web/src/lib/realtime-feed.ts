type RealtimeFeedFilters = {
  routeId?: string | null
  vehicleStatus?: string | null
  bbox?: string | null
  incidentStatus?: string | null
  incidentSeverity?: string | null
  incidentType?: string | null
}

const appendScopedParam = (url: URL, key: string, value?: string | null) => {
  if (!value || value === "ALL") return
  url.searchParams.set(key, value)
}

export const buildRealtimeFeedUrl = (baseUrl: string, filters: RealtimeFeedFilters = {}) => {
  const url = new URL(baseUrl)
  appendScopedParam(url, "route_id", filters.routeId)
  appendScopedParam(url, "vehicle_status", filters.vehicleStatus)
  appendScopedParam(url, "bbox", filters.bbox)
  appendScopedParam(url, "incident_status", filters.incidentStatus)
  appendScopedParam(url, "incident_severity", filters.incidentSeverity)
  appendScopedParam(url, "incident_type", filters.incidentType)
  return url.toString()
}
