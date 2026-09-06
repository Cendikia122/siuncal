const readParam = (searchParams, key) => {
  const value = searchParams.get(key);
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const parseRealtimeBbox = (value) => {
  if (!value) return { bbox: null };
  const parts = String(value).split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return { error: "bbox harus berformat minLon,minLat,maxLon,maxLat" };
  }
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90 || minLon >= maxLon || minLat >= maxLat) {
    return { error: "bbox di luar rentang koordinat yang valid" };
  }
  return { bbox: { minLon, minLat, maxLon, maxLat } };
};

export const createRealtimeFilters = (searchParams) => {
  const parsedBbox = parseRealtimeBbox(searchParams.get("bbox"));
  if (parsedBbox.error) return { error: parsedBbox.error };
  return {
    filters: {
      route_id: readParam(searchParams, "route_id"),
      bbox: parsedBbox.bbox,
      vehicle_status: readParam(searchParams, "vehicle_status"),
      incident_status: readParam(searchParams, "incident_status"),
      incident_severity: readParam(searchParams, "incident_severity"),
      incident_type: readParam(searchParams, "incident_type")
    }
  };
};

export const realtimeVehicleScopeKey = (filters = {}) =>
  JSON.stringify({
    route_id: filters.route_id || null,
    vehicle_status: filters.vehicle_status || null,
    bbox: filters.bbox || null
  });

export const realtimePassengerScopeKey = (filters = {}) =>
  JSON.stringify({
    route_id: filters.route_id || null,
    bbox: filters.bbox || null
  });

export const filterRealtimeIncidents = (incidents = [], filters = {}) => {
  let scoped = incidents;
  if (filters.route_id) {
    scoped = scoped.filter((incident) => incident.route_id === filters.route_id);
  }
  if (filters.incident_status) {
    scoped = scoped.filter((incident) => incident.status === filters.incident_status);
  }
  if (filters.incident_severity) {
    scoped = scoped.filter((incident) => incident.severity === filters.incident_severity);
  }
  if (filters.incident_type) {
    scoped = scoped.filter((incident) => incident.type === filters.incident_type);
  }
  return scoped;
};

export const createRealtimePayloads = ({ vehicles = [], passengers = [], incidents = [] } = {}) => [
  { type: "VEHICLE_LATEST", vehicles },
  { type: "PASSENGER_LATEST", passengers },
  { type: "EVENT_NEW", incidents }
];
