import { LatLng, RouteData } from "../data/routes";
import { ROUTE_POLYLINES } from "../data/routePolylines";

// Rute snap-to-road sudah di-pre-fetch dari OSRM dan disimpan lokal.
// Tidak perlu API key apapun saat runtime.
export async function fetchRoutePolyline(route: RouteData): Promise<LatLng[]> {
  const cached = ROUTE_POLYLINES[route.id];
  if (cached && cached.length > 0) return cached;
  // fallback: garis lurus antar halte jika data tidak ada
  return route.stops.map((s) => s.coordinate);
}

export function calcDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const aa = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
