"use client"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Layers, Maximize2, Navigation, AlertTriangle, ChevronLeft, ChevronRight, X, Gauge, Clock, Route, Wifi, WifiOff, BarChart3, ShieldAlert, Activity, MapPinned, UserRound, Bus } from "lucide-react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ElementType } from "react"
import { apiFetch, emitActionFeedback, getRealtimeUrl, MOCK_MODE } from "@/lib/api"
import { VEHICLE_STATUS_LABEL, INCIDENT_SEVERITY_LABEL, INCIDENT_TYPE_LABEL, label } from "@/lib/labels"
import { buildRealtimeFeedUrl } from "@/lib/realtime-feed"

type RouteResponseItem = {
  route_id: string
  name: string
  color?: string | null
  outbound?: { coordinates?: Array<[number, number]> } | null
  inbound?: { coordinates?: Array<[number, number]> } | null
  corridor?: { type?: "Polygon" | "MultiPolygon", coordinates?: number[][][] | number[][][][] } | null
  stops?: Array<{ name: string, lat: number, lng: number, seq?: number }>
}

type VehicleResponseItem = {
  vehicle_id: string
  lat: number | null
  lon: number | null
  plate_no: string
  status: string
  route_id?: string | null
  speed?: number | string | null
  heading?: number | string | null
  last_ping?: string | null
  alert_status?: string | null
}

type GeofenceResponseItem = {
  geofence_id: string
  route_id?: string | null
  type?: string | null
  geom?: { type?: "Polygon", coordinates?: number[][][] } | null
}

type IncidentSummaryItem = {
  id: string
  type: string
  severity: string
  location: string
  timestamp: string
  vehicle_plate: string
}

type PassengerResponseItem = {
  user_id: string
  session_id?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  profile_photo_url?: string | null
  lat: number | string | null
  lon: number | string | null
  accuracy?: number | string | null
  last_seen_at?: string | null
  app_state?: string | null
  nearest_plate_no?: string | null
  nearest_vehicle_distance_m?: number | string | null
}

type SummaryResponse = {
  vehicles?: { total_vehicles?: number } | null
  online?: number | null
  incidents?: IncidentSummaryItem[] | null
}

type DashboardVehicle = {
  id: string
  lat: number | null
  lng: number | null
  title: string
  status: string
  alertStatus?: string | null
  route_id?: string
  speed?: number | null
  heading?: number | null
  lastPing?: string | null
}

type RouteStopPoint = {
  id: string
  lat: number
  lng: number
  label: string
  route_id: string
  seq?: number
}

type VehicleLocationContext = {
  label: string
  distanceM: number
  routeId?: string
}

type DashboardPassenger = {
  id: string
  sessionId?: string | null
  lat: number | null
  lng: number | null
  name: string
  email?: string | null
  phone?: string | null
  profilePhotoUrl?: string | null
  accuracy?: number | null
  lastSeenAt?: string | null
  appState?: string | null
  nearestPlateNo?: string | null
  nearestVehicleDistanceM?: number | null
}

type RealtimeState = "connecting" | "connected" | "error" | "closed"

type MapBbox = {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

const OFFLINE_AFTER_MS = 10 * 60 * 1000

const normalizeVehicle = (vehicle: VehicleResponseItem): DashboardVehicle => ({
  id: vehicle.vehicle_id,
  lat: vehicle.lat === null || vehicle.lat === undefined ? null : Number(vehicle.lat),
  lng: vehicle.lon === null || vehicle.lon === undefined ? null : Number(vehicle.lon),
  title: vehicle.plate_no,
  status: vehicle.status || "Belum ada data",
  alertStatus: vehicle.alert_status,
  route_id: vehicle.route_id ?? undefined,
  speed: vehicle.speed === null || vehicle.speed === undefined ? null : Number(vehicle.speed),
  heading: vehicle.heading === null || vehicle.heading === undefined ? null : Number(vehicle.heading),
  lastPing: vehicle.last_ping || null
})

const normalizePassenger = (passenger: PassengerResponseItem): DashboardPassenger => ({
  id: passenger.user_id,
  sessionId: passenger.session_id || null,
  lat: passenger.lat === null || passenger.lat === undefined ? null : Number(passenger.lat),
  lng: passenger.lon === null || passenger.lon === undefined ? null : Number(passenger.lon),
  name: passenger.name || passenger.email || "Passenger",
  email: passenger.email || null,
  phone: passenger.phone || null,
  profilePhotoUrl: passenger.profile_photo_url || null,
  accuracy: passenger.accuracy === null || passenger.accuracy === undefined ? null : Number(passenger.accuracy),
  lastSeenAt: passenger.last_seen_at || null,
  appState: passenger.app_state || null,
  nearestPlateNo: passenger.nearest_plate_no || null,
  nearestVehicleDistanceM: passenger.nearest_vehicle_distance_m === null || passenger.nearest_vehicle_distance_m === undefined
    ? null
    : Number(passenger.nearest_vehicle_distance_m)
})

const isVehicleOnline = (vehicle: DashboardVehicle) => {
  if (!vehicle.lastPing) return false
  return Date.now() - new Date(vehicle.lastPing).getTime() <= OFFLINE_AFTER_MS
}

const markerStatus = (vehicle: DashboardVehicle) => {
  if (!isVehicleOnline(vehicle)) return "OFFLINE"
  return vehicle.alertStatus || vehicle.status
}

const formatLastPing = (value?: string | null) => {
  if (!value) return "Belum ada data"
  return new Date(value).toLocaleTimeString()
}

const formatPercent = (value: number) => `${Math.round(value)}%`
const formatDistance = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-"
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km`
  return `${Math.round(value)} m`
}

const distanceMeters = (a: { lat: number, lng: number }, b: { lat: number, lng: number }) => {
  const earthRadiusM = 6371000
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadiusM * Math.asin(Math.sqrt(h))
}

const findNearestStop = (vehicle: DashboardVehicle, stops: RouteStopPoint[]): VehicleLocationContext | null => {
  if (vehicle.lat === null || vehicle.lng === null) return null

  const routeStops = vehicle.route_id ? stops.filter((stop) => stop.route_id === vehicle.route_id) : []
  const candidates = routeStops.length > 0 ? routeStops : stops
  if (candidates.length === 0) return null

  const vehiclePoint = { lat: vehicle.lat, lng: vehicle.lng }
  const nearest = candidates.reduce<{ stop: RouteStopPoint, distanceM: number } | null>((best, stop) => {
    const distanceM = distanceMeters(vehiclePoint, stop)
    if (!best || distanceM < best.distanceM) return { stop, distanceM }
    return best
  }, null)

  if (!nearest) return null

  return {
    label: nearest.stop.label,
    distanceM: nearest.distanceM,
    routeId: nearest.stop.route_id
  }
}

const getSeverityTone = (severity: string): "destructive" | "secondary" | "outline" => {
  if (severity === "CRITICAL") return "destructive"
  if (severity === "HIGH") return "secondary"
  return "outline"
}

// Dynamically import MapView to avoid SSR issues with Leaflet
const MapView = dynamic(() => import("@/components/map/map-view"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-600 text-sm">
      Memuat Peta Bogor...
    </div>
  )
})

export default function DashboardPage() {
  const [routes, setRoutes] = useState<Array<{ id: string, name: string, color: string, path: [number, number][][] }>>([])
  const [geofences, setGeofences] = useState<Array<{ id: string, color: string, path: [number, number][][] }>>([])
  const [stops, setStops] = useState<RouteStopPoint[]>([])
  const [vehicles, setVehicles] = useState<DashboardVehicle[]>([])
  const [passengers, setPassengers] = useState<DashboardPassenger[]>([])
  const [summary, setSummary] = useState<{ total: number, online: number }>({ total: 0, online: 0 })
  const [incidents, setIncidents] = useState<IncidentSummaryItem[]>([])
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [error, setError] = useState("")
  const [sidebarTab, setSidebarTab] = useState<"insiden" | "armada">("insiden")
  const [selectedRoute, setSelectedRoute] = useState("ALL")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [selectedPassengerId, setSelectedPassengerId] = useState<string | null>(null)
  const [showPassengerLayer, setShowPassengerLayer] = useState(false)
  const [showHeatmapLayer, setShowHeatmapLayer] = useState(false)
  const [isFollowMode, setIsFollowMode] = useState(false)
  const [mapBbox, setMapBbox] = useState<MapBbox | null>(null)
  const [realtimeState, setRealtimeState] = useState<RealtimeState>(MOCK_MODE ? "connected" : "connecting")
  const mapContainerRef = useRef<HTMLDivElement>(null)

  const selectedVehicle = useMemo(() => {
    return vehicles.find((m) => m.id === selectedVehicleId)
  }, [vehicles, selectedVehicleId])

  const selectedVehicleLocation = useMemo(() => {
    if (!selectedVehicle) return null
    return findNearestStop(selectedVehicle, stops)
  }, [selectedVehicle, stops])

  const selectedPassenger = useMemo(() => {
    return passengers.find((passenger) => passenger.id === selectedPassengerId)
  }, [passengers, selectedPassengerId])

  const incidentBadge = useMemo(() => {
    const count = incidents.length
    return count > 0 ? `${count} New` : "No Alert"
  }, [incidents])

  const routeOptions = useMemo(() => {
    const ids = routes.map((route) => route.id)
    return Array.from(new Set(ids))
  }, [routes])

  const filteredRoutes = useMemo(() => {
    if (selectedRoute === "ALL") return routes
    return routes.filter((route) => route.id === selectedRoute)
  }, [routes, selectedRoute])

  const filteredGeofences = useMemo(() => {
    if (selectedRoute === "ALL") return geofences
    return geofences.filter((fence) => fence.id === selectedRoute)
  }, [geofences, selectedRoute])

  const filteredStops = useMemo(() => {
    if (selectedRoute === "ALL") return stops
    return stops.filter((stop) => stop.route_id === selectedRoute)
  }, [stops, selectedRoute])

  const filteredMarkers = useMemo(() => {
    let filtered = vehicles
    if (selectedRoute !== "ALL") {
      filtered = filtered.filter((marker) => marker.route_id === selectedRoute)
    }
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((marker) => marker.status === statusFilter)
    }
    const vehicleMarkers = filtered
      .filter((vehicle) => vehicle.lat !== null && vehicle.lng !== null)
      .map((vehicle) => {
        const locationContext = findNearestStop(vehicle, stops)
        return {
          id: vehicle.id,
          lat: vehicle.lat as number,
          lng: vehicle.lng as number,
          title: vehicle.title,
          status: markerStatus(vehicle),
          heading: vehicle.heading ?? undefined,
          route_id: vehicle.route_id,
          type: "VEHICLE",
          locationLabel: locationContext?.label ?? null,
          locationDistanceM: locationContext?.distanceM ?? null
        }
      })

    if (!showPassengerLayer) return vehicleMarkers

    const passengerMarkers = passengers
      .filter((passenger) => passenger.lat !== null && passenger.lng !== null)
      .map((passenger) => ({
        id: `passenger:${passenger.id}`,
        lat: passenger.lat as number,
        lng: passenger.lng as number,
        title: passenger.name,
        status: "PASSENGER",
        type: "PASSENGER"
      }))

    return [...vehicleMarkers, ...passengerMarkers]
  }, [passengers, showPassengerLayer, stops, vehicles, selectedRoute, statusFilter])

  const filteredVehicles = useMemo(() => {
    let filtered = vehicles
    if (selectedRoute !== "ALL") {
      filtered = filtered.filter((vehicle) => vehicle.route_id === selectedRoute)
    }
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((vehicle) => vehicle.status === statusFilter)
    }
    return filtered
  }, [vehicles, selectedRoute, statusFilter])

  const offlineVehicles = useMemo(
    () => vehicles.filter((vehicle) => !isVehicleOnline(vehicle)),
    [vehicles]
  )

  const onlineRate = useMemo(() => {
    if (summary.total === 0) return 0
    return (summary.online / summary.total) * 100
  }, [summary.online, summary.total])

  const routeHealth = useMemo(() => {
    return routeOptions.map((routeId) => {
      const routeVehicles = vehicles.filter((vehicle) => vehicle.route_id === routeId)
      const onlineCount = routeVehicles.filter(isVehicleOnline).length
      const alertCount = routeVehicles.filter((vehicle) => vehicle.alertStatus || vehicle.status === "SOS" || vehicle.status === "OFF_ROUTE").length
      const onlinePercent = routeVehicles.length === 0 ? 0 : (onlineCount / routeVehicles.length) * 100

      return {
        routeId,
        total: routeVehicles.length,
        onlineCount,
        alertCount,
        onlinePercent,
      }
    })
  }, [routeOptions, vehicles])

  const bboxParam = useMemo(() => {
    if (!mapBbox) return null
    return [
      mapBbox.minLon,
      mapBbox.minLat,
      mapBbox.maxLon,
      mapBbox.maxLat
    ].join(",")
  }, [mapBbox])

  const insights = useMemo(() => {
    const nextInsights: Array<{ title: string, description: string, tone: "critical" | "warning" | "normal" }> = []

    if (incidents.length > 0) {
      const criticalCount = incidents.filter((incident) => incident.severity === "CRITICAL").length
      nextInsights.push({
        title: criticalCount > 0 ? `${criticalCount} insiden critical perlu respons` : `${incidents.length} insiden aktif perlu dipantau`,
        description: "Prioritaskan ACK dan assignment sebelum membaca daftar armada lain.",
        tone: criticalCount > 0 ? "critical" : "warning",
      })
    }

    if (offlineVehicles.length > 0) {
      nextInsights.push({
        title: `${offlineVehicles.length} armada kehilangan sinyal`,
        description: "Cek last ping, trayek, dan kemungkinan gangguan device sebelum eskalasi lapangan.",
        tone: offlineVehicles.length >= 3 ? "warning" : "normal",
      })
    }

    if (summary.total > 0) {
      nextInsights.push({
        title: `Online rate ${formatPercent(onlineRate)}`,
        description: onlineRate >= 80 ? "Kondisi armada sehat untuk pemantauan realtime." : "Online rate rendah, validasi koneksi device dan jaringan terlebih dahulu.",
        tone: onlineRate >= 80 ? "normal" : "warning",
      })
    }

    if (nextInsights.length === 0) {
      nextInsights.push({
        title: "Belum ada sinyal operasional",
        description: "Insight akan muncul setelah data armada, telemetry, atau incident tersedia.",
        tone: "normal",
      })
    }

    return nextInsights.slice(0, 3)
  }, [incidents, offlineVehicles.length, onlineRate, summary.total])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [routesResponse, vehiclesResponse, summaryResponse, geofenceResponse, passengerResponse] = await Promise.all([
          apiFetch("/routes"),
          apiFetch("/vehicles"),
          apiFetch("/dashboard/summary"),
          apiFetch("/geofences"),
          apiFetch("/passengers/active")
        ])

        if (!active) return

        const routeItems = (routesResponse.items || []) as RouteResponseItem[]
        const nextRoutes = routeItems.map((route) => {
          const outboundCoordinates = (route.outbound?.coordinates || []) as Array<[number, number]>
          const inboundCoordinates = (route.inbound?.coordinates || []) as Array<[number, number]>
          const paths = [outboundCoordinates, inboundCoordinates]
            .filter((coordinates) => coordinates.length > 1)
            .map((coordinates) => coordinates.map(([lng, lat]) => [lat, lng] as [number, number]))
          return {
            id: route.route_id,
            name: route.name,
            color: route.color || "#10b981",
            path: paths
          }
        })
        setRoutes(nextRoutes)

        const nextGeofences: Array<{ id: string, color: string, path: [number, number][][] }> = []
          ; routeItems.forEach((route) => {
            const corridor = route.corridor
            if (!corridor) return

            if (corridor.type === "Polygon") {
              const path = ((corridor.coordinates || []) as number[][][]).map((ring) =>
                ring.map(([lng, lat]) => [lat, lng] as [number, number])
              )
              nextGeofences.push({ id: route.route_id, color: route.color || "#10b981", path })
            } else if (corridor.type === "MultiPolygon") {
              ((corridor.coordinates || []) as number[][][][]).forEach((polygon) => {
                const path = polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]))
                nextGeofences.push({ id: route.route_id, color: route.color || "#10b981", path })
              })
            }
          })
        const extraGeofences: Array<{ id: string, color: string, path: [number, number][][] }> = []
          ; ((geofenceResponse.items || []) as GeofenceResponseItem[]).forEach((geofence) => {
            if (!geofence.geom) return
            const color = geofence.type === "BASE" ? "#38bdf8" : "#a855f7"
            if (geofence.geom.type === "Polygon") {
              const path = ((geofence.geom.coordinates || []) as number[][][]).map((ring) =>
                ring.map(([lng, lat]) => [lat, lng] as [number, number])
              )
              extraGeofences.push({ id: geofence.route_id || geofence.geofence_id, color, path })
            }
          })
        setGeofences([...nextGeofences, ...extraGeofences])

        const nextStops = routeItems.flatMap((route) => {
          return (route.stops || []).map((stop, index) => ({
            id: `${route.route_id}-${index}`,
            lat: Number(stop.lat),
            lng: Number(stop.lng),
            label: stop.name,
            route_id: route.route_id,
            seq: stop.seq
          }))
        })
        setStops(nextStops)

        setVehicles(((vehiclesResponse.items || []) as VehicleResponseItem[]).map(normalizeVehicle))
        setPassengers(((passengerResponse.items || []) as PassengerResponseItem[]).map(normalizePassenger))

        const summaryData = summaryResponse as SummaryResponse
        setSummary({
          total: summaryData.vehicles?.total_vehicles || 0,
          online: summaryData.online || 0
        })
        setIncidents(summaryData.incidents || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat data dashboard")
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const handleNavigateToVehicle = () => {
    const target = selectedVehicleId || filteredMarkers.find((marker) => marker.type === "VEHICLE")?.id
    if (!target) {
      emitActionFeedback({ type: "info", title: "Tidak ada kendaraan aktif", message: "Tidak ada marker kendaraan yang dapat diikuti untuk filter saat ini." })
      return
    }
    setSelectedVehicleId(target)
    setSelectedPassengerId(null)
    setIsFollowMode(true)
    setIsSidebarOpen(true)
    emitActionFeedback({ type: "info", title: "Mode navigasi aktif", message: "Peta akan mengikuti kendaraan yang dipilih." })
  }

  const handleFullscreen = async () => {
    const element = mapContainerRef.current
    if (!element || !element.requestFullscreen) {
      emitActionFeedback({ type: "error", title: "Fullscreen tidak tersedia", message: "Browser tidak mendukung mode layar penuh untuk panel peta." })
      return
    }
    try {
      await element.requestFullscreen()
    } catch (err) {
      emitActionFeedback({ type: "error", title: "Gagal masuk fullscreen", message: err instanceof Error ? err.message : "Coba ulangi dari browser." })
    }
  }

  const handleBoundsChange = useCallback((bbox: MapBbox) => {
    setMapBbox((current) => {
      const rounded = {
        minLon: Number(bbox.minLon.toFixed(5)),
        minLat: Number(bbox.minLat.toFixed(5)),
        maxLon: Number(bbox.maxLon.toFixed(5)),
        maxLat: Number(bbox.maxLat.toFixed(5))
      }
      if (current
        && current.minLon === rounded.minLon
        && current.minLat === rounded.minLat
        && current.maxLon === rounded.maxLon
        && current.maxLat === rounded.maxLat) {
        return current
      }
      return rounded
    })
  }, [])

  useEffect(() => {
    if (MOCK_MODE) return

    const wsUrl = buildRealtimeFeedUrl(getRealtimeUrl(), {
      routeId: selectedRoute,
      vehicleStatus: statusFilter,
      bbox: bboxParam
    })
    const socket = new WebSocket(wsUrl)
    let closedByCleanup = false

    socket.onopen = () => {
      setRealtimeState("connected")
      setError("")
    }

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string
          vehicles?: VehicleResponseItem[]
          passengers?: PassengerResponseItem[]
          incidents?: IncidentSummaryItem[]
        }
        if (payload.type === "VEHICLE_LATEST") {
          setVehicles((payload.vehicles || []).map(normalizeVehicle))
        }

        if (payload.type === "EVENT_NEW") {
          setIncidents(payload.incidents || [])
        }

        if (payload.type === "PASSENGER_LATEST") {
          setPassengers((payload.passengers || []).map(normalizePassenger))
        }
      } catch {
        setError("Realtime stream error")
      }
    }

    socket.onerror = () => {
      setRealtimeState("error")
      setError("Realtime stream error")
    }

    socket.onclose = () => {
      if (closedByCleanup) return
      setRealtimeState((current) => current === "error" ? "error" : "closed")
    }

    return () => {
      closedByCleanup = true
      socket.close()
    }
  }, [bboxParam, selectedRoute, statusFilter])

  return (
    <div className="h-[calc(100vh-4rem)] min-h-0 relative flex">
      {/* Map Area */}
      <div ref={mapContainerRef} className="flex-1 bg-zinc-900 relative overflow-hidden group" data-tour="dashboard-header">
        <MapView
          markers={filteredMarkers}
          routes={filteredRoutes}
          geofences={filteredGeofences}
          stops={filteredStops}
          showStopLabels={selectedRoute !== "ALL"}
          onBoundsChange={handleBoundsChange}
          onMarkerClick={(id) => {
            if (id.startsWith("passenger:")) {
              setSelectedPassengerId(id.replace("passenger:", ""))
              setSelectedVehicleId(null)
              setIsFollowMode(false)
            } else {
              setSelectedVehicleId(id)
              setSelectedPassengerId(null)
            }
            setIsSidebarOpen(true)
          }}
          followedVehicleId={isFollowMode ? selectedVehicleId : null}
          showHeatmap={showHeatmapLayer}
        />

        {/* Map Controls Overlay (Preserved) */}

        {/* Map Controls Overlay */}
        <div className="absolute left-4 top-4 z-[500] flex items-center gap-2 rounded-md border border-white/10 bg-black/50 px-3 py-2 text-xs text-zinc-200 backdrop-blur md:left-6 md:top-6" data-tour="dashboard-realtime">
          {realtimeState === "connected" ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-red-400" />
          )}
          Realtime {realtimeState === "connected" ? "tersambung" : realtimeState === "connecting" ? "menghubungkan" : "terputus"}
        </div>

        <div className="absolute top-6 right-6 flex flex-col gap-2" data-tour="map-layers">
          <Button
            variant="outline"
            size="icon"
            aria-label={showHeatmapLayer ? "Sembunyikan heatmap" : "Tampilkan heatmap"}
            aria-pressed={showHeatmapLayer}
            className={cn(
              "border-white/10 hover:bg-black/70",
              showHeatmapLayer ? "bg-orange-500/30 text-orange-300 border-orange-500/30" : "bg-black/50 text-white"
            )}
            onClick={() => setShowHeatmapLayer((current) => !current)}
          >
            <Layers className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Navigasi ke kendaraan"
            aria-pressed={isFollowMode}
            className={cn(
              "border-white/10 hover:bg-black/70",
              isFollowMode ? "bg-blue-500/30 text-blue-300 border-blue-500/30" : "bg-black/50 text-white"
            )}
            onClick={handleNavigateToVehicle}
          >
            <Navigation className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Layar penuh" className="bg-black/50 border-white/10 text-white hover:bg-black/70" onClick={handleFullscreen}>
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={showPassengerLayer ? "Sembunyikan passenger" : "Tampilkan passenger"}
            aria-pressed={showPassengerLayer}
            className={cn(
              "border-white/10 hover:bg-black/70",
              showPassengerLayer ? "bg-sky-500/30 text-sky-300 border-sky-500/30" : "bg-black/50 text-white"
            )}
            onClick={() => setShowPassengerLayer((c) => !c)}
          >
            <UserRound className="w-4 h-4" />
          </Button>
        </div>

        {filteredMarkers.length === 0 && (
          <div className="absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-black/70 px-4 py-3 text-sm text-zinc-200 backdrop-blur">
            Belum ada posisi kendaraan untuk filter ini.
          </div>
        )}

        {/* Map Legend Overlay */}
        <div className="absolute bottom-6 left-6 px-4 py-3 bg-black/50 backdrop-blur border border-white/10 rounded-lg space-y-2" data-tour="marker-legend">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white">P</div>
            Passenger aktif
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Bergerak (In Service)
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <div className="w-2 h-2 rounded-full bg-yellow-500" /> Berhenti (Idle)
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Anomali / SOS
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <div className="w-2 h-2 rounded-full bg-zinc-500" /> Offline
          </div>
        </div>
        {/* Sidebar Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-[500] bg-zinc-950 border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full h-8 w-8 shadow-lg transition-transform duration-300 ${isSidebarOpen ? 'translate-x-1/2' : '-translate-x-2'}`}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Right Sidebar - Active Stats */}
      <div
        className={`${isSidebarOpen ? "w-80 opacity-100" : "w-0 opacity-0 px-0 border-l-0"
          } bg-zinc-950 flex flex-col transition-all duration-300 ease-in-out overflow-hidden`}
      >
        {selectedPassenger ? (
          <div className="flex-1 flex flex-col h-full">
            <div className="p-4 border-b border-white/5 bg-zinc-900/50">
              <button
                onClick={() => {
                  setSelectedPassengerId(null)
                  setIsFollowMode(false)
                }}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 mb-2"
              >
                <ChevronLeft className="w-3 h-3" /> Kembali ke Daftar
              </button>

              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold">{selectedPassenger.name}</h2>
                  <div className="mt-1 w-fit rounded bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-300">
                    PASSENGER ACTIVE
                  </div>
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent border-white/10" onClick={() => setSelectedPassengerId(null)}>
                  <X className="w-4 h-4 text-zinc-400" />
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900/50 p-3 rounded-lg border border-white/5">
                  <div className="text-zinc-500 text-[10px] uppercase font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Last Seen
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {formatLastPing(selectedPassenger.lastSeenAt)}
                  </div>
                </div>
                <div className="bg-zinc-900/50 p-3 rounded-lg border border-white/5">
                  <div className="text-zinc-500 text-[10px] uppercase font-bold flex items-center gap-1">
                    <Navigation className="w-3 h-3" /> Akurasi
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {selectedPassenger.accuracy === null || selectedPassenger.accuracy === undefined ? "-" : `${Math.round(selectedPassenger.accuracy)} m`}
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/50 p-3 rounded-lg border border-white/5 space-y-3">
                <div>
                  <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Identitas</div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
                      <UserRound className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{selectedPassenger.email || "-"}</div>
                      <div className="truncate text-xs text-zinc-500">{selectedPassenger.phone || "Nomor telepon belum tersedia"}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Kendaraan Terdekat</div>
                  <div className="text-sm text-zinc-200">
                    {selectedPassenger.nearestPlateNo || "-"}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Jarak {formatDistance(selectedPassenger.nearestVehicleDistanceM)}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Lokasi Terkini</div>
                  <div className="text-xs text-zinc-300 font-mono">
                    {selectedPassenger.lat !== null && selectedPassenger.lng !== null
                      ? `${selectedPassenger.lat.toFixed(6)}, ${selectedPassenger.lng.toFixed(6)}`
                      : "Belum ada data"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : selectedVehicle ? (
          <div className="flex-1 flex flex-col h-full">
            <div className="p-4 border-b border-white/5 bg-zinc-900/50">
              <button
                onClick={() => {
                  setSelectedVehicleId(null)
                  setIsFollowMode(false)
                }}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 mb-2"
              >
                <ChevronLeft className="w-3 h-3" /> Kembali ke Daftar
              </button>

              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selectedVehicle.title}</h2>
                  <div className={`text-xs font-semibold px-2 py-0.5 rounded w-fit mt-1
                    ${selectedVehicle.status === 'IN_SERVICE' ? 'bg-emerald-500/20 text-emerald-400' :
                      selectedVehicle.status === 'SOS' ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-300'}`}>
                    {label(VEHICLE_STATUS_LABEL, selectedVehicle.status)}
                  </div>
                  {selectedVehicle.alertStatus && (
                    <div className="text-xs font-semibold px-2 py-0.5 rounded w-fit mt-1 bg-red-500/20 text-red-400">
                      {label(VEHICLE_STATUS_LABEL, selectedVehicle.alertStatus)}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={isFollowMode ? "default" : "outline"}
                    size="icon"
                    className={`h-8 w-8 ${isFollowMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-transparent border-white/10'}`}
                    onClick={() => setIsFollowMode(!isFollowMode)}
                    title="Follow Mode"
                  >
                    <Navigation className={`w-4 h-4 ${isFollowMode ? 'text-white' : 'text-zinc-400'}`} />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent border-white/10" onClick={() => setSelectedVehicleId(null)}>
                    <X className="w-4 h-4 text-zinc-400" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900/50 p-3 rounded-lg border border-white/5">
                  <div className="text-zinc-500 text-[10px] uppercase font-bold flex items-center gap-1">
                    <Gauge className="w-3 h-3" /> Kecepatan
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {selectedVehicle.speed === null || selectedVehicle.speed === undefined ? "-" : `${selectedVehicle.speed.toFixed(1)} km/h`}
                  </div>
                </div>
                <div className="bg-zinc-900/50 p-3 rounded-lg border border-white/5">
                  <div className="text-zinc-500 text-[10px] uppercase font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Last Ping
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {formatLastPing(selectedVehicle.lastPing)}
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/50 p-3 rounded-lg border border-white/5 space-y-3">
                <div>
                  <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Trayek</div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                      <Route className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{selectedVehicle.route_id || "-"}</div>
                      <div className="text-xs text-zinc-500">
                        {isVehicleOnline(selectedVehicle) ? "Online" : "Offline / belum ping"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Lokasi Terkini</div>
                  <div className="text-sm font-medium text-zinc-200">
                    {selectedVehicleLocation
                      ? `Dekat ${selectedVehicleLocation.label}`
                      : "Belum ada nama titik terdekat"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {selectedVehicleLocation
                      ? `${formatDistance(selectedVehicleLocation.distanceM)} dari titik trayek ${selectedVehicleLocation.routeId || selectedVehicle.route_id || ""}`
                      : "Koordinat tetap disimpan sebagai bukti lokasi mentah."}
                  </div>
                  <div className="mt-2 text-xs text-zinc-300 font-mono">
                    {selectedVehicle.lat !== null && selectedVehicle.lng !== null
                      ? `${selectedVehicle.lat.toFixed(6)}, ${selectedVehicle.lng.toFixed(6)}`
                      : "Belum ada data"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Filters — always visible */}
            <div className="border-b border-white/5 p-4" data-tour="filters">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">Filter Operasional</h2>
                  <p className="mt-1 text-xs text-zinc-500">Sinkron ke peta dan semua panel.</p>
                </div>
                <MapPinned className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selectedRoute === "ALL" ? "default" : "outline"}
                  className="h-8 flex-1 text-xs"
                  onClick={() => setSelectedRoute("ALL")}
                >
                  Semua
                </Button>
                {routeOptions.map((routeId) => (
                  <Button
                    key={routeId}
                    size="sm"
                    variant={selectedRoute === routeId ? "default" : "outline"}
                    className="h-8 flex-1 text-xs"
                    onClick={() => setSelectedRoute(routeId)}
                  >
                    {routeId}
                  </Button>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase text-zinc-500">Status Armada</label>
                <select
                  className="h-9 w-full rounded-md border border-white/10 bg-black/20 px-2 text-xs outline-none transition-colors focus:border-emerald-500/50"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="ALL">Semua</option>
                  {Object.entries(VEHICLE_STATUS_LABEL).filter(([k]) => k !== "OFFLINE").map(([value, text]) => (
                    <option key={value} value={value}>{text}</option>
                  ))}
                </select>
              </div>
              {offlineVehicles.length > 0 && (
                <Alert className="mt-3 border-amber-500/20 bg-amber-500/10 text-amber-100">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{offlineVehicles.length} armada offline</AlertTitle>
                  <AlertDescription className="text-amber-100/80">
                    Validasi last ping sebelum eskalasi insiden.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-white/5" data-tour="sidebar-tabs">
              <button
                className={cn(
                  "flex-1 px-4 py-2.5 text-xs font-semibold transition-colors relative",
                  sidebarTab === "insiden"
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
                onClick={() => setSidebarTab("insiden")}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Insiden
                  {incidents.length > 0 && (
                    <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">{incidents.length}</span>
                  )}
                </span>
                {sidebarTab === "insiden" && <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-emerald-500" />}
              </button>
              <button
                className={cn(
                  "flex-1 px-4 py-2.5 text-xs font-semibold transition-colors relative",
                  sidebarTab === "armada"
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
                onClick={() => setSidebarTab("armada")}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Bus className="h-3.5 w-3.5" />
                  Armada
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">{filteredVehicles.length}</span>
                </span>
                {sidebarTab === "armada" && <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-emerald-500" />}
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-4">
                {sidebarTab === "insiden" ? (
                  <>
                    <section data-tour="incident-panel">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-white">Prioritas Insiden</h3>
                        <Badge variant={incidents.length > 0 ? "destructive" : "secondary"}>{incidentBadge}</Badge>
                      </div>
                      <div className="flex flex-col gap-2">
                        {incidents.length === 0 ? (
                          <Card className="border-white/5 bg-zinc-900/40 py-0">
                            <CardContent className="flex flex-col gap-1 px-3 py-3">
                              <div className="flex items-center gap-2 text-sm font-medium text-white">
                                <ShieldAlert className="h-4 w-4 text-emerald-400" />
                                Tidak ada insiden aktif
                              </div>
                              <p className="text-xs text-zinc-500">Alert akan muncul setelah rule eskalasi terpenuhi.</p>
                            </CardContent>
                          </Card>
                        ) : incidents.slice(0, 5).map((incident) => (
                          <Card key={incident.id} className="border-red-500/20 bg-red-500/10 py-0 transition-colors hover:border-red-400/40">
                            <CardContent className="px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-300" />
                                    <span className="truncate text-sm font-semibold text-white">{incident.vehicle_plate || "Unknown"}</span>
                                  </div>
                                  <div className="mt-1 text-xs font-medium text-red-100">{label(INCIDENT_TYPE_LABEL, incident.type)}</div>
                                  <div className="mt-1 truncate text-[11px] text-red-100/70">{incident.location || "-"}</div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <Badge variant={getSeverityTone(incident.severity)}>{label(INCIDENT_SEVERITY_LABEL, incident.severity)}</Badge>
                                  <span className="text-[10px] text-red-100/60">
                                    {incident.timestamp ? new Date(incident.timestamp).toLocaleTimeString() : "-"}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </section>

                    <section data-tour="insights">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Insight Otomatis</h3>
                        <span className="text-[10px] font-medium text-zinc-500 border border-white/10 px-1.5 py-0.5 rounded">AUTO</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {insights.map((insight) => (
                          <Card
                            key={insight.title}
                            className={cn(
                              "border-white/5 bg-zinc-900/40 py-0",
                              insight.tone === "critical" && "border-red-500/30 bg-red-500/10",
                              insight.tone === "warning" && "border-amber-500/20 bg-amber-500/10"
                            )}
                          >
                            <CardContent className="px-3 py-3">
                              <div className="text-sm font-semibold text-white">{insight.title}</div>
                              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{insight.description}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </section>
                  </>
                ) : (
                  <>
                    <section data-tour="kpi-cards">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">KPI Armada</h3>
                        <Badge variant="outline">{formatPercent(onlineRate)} online</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <MetricCard
                          icon={Activity}
                          label="Armada aktif"
                          value={`${summary.online}/${summary.total}`}
                          insight={summary.total === 0 ? "Menunggu data" : `${formatPercent(onlineRate)} siap dipantau`}
                          tone={onlineRate >= 80 ? "good" : "warning"}
                        />
                        <MetricCard
                          icon={WifiOff}
                          label="Offline"
                          value={offlineVehicles.length}
                          insight={offlineVehicles.length === 0 ? "Sinyal sehat" : "Cek device"}
                          tone={offlineVehicles.length === 0 ? "good" : "warning"}
                        />
                      </div>
                    </section>

                    <section data-tour="charts">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Kesehatan Trayek</h3>
                        <BarChart3 className="h-4 w-4 text-zinc-500" />
                      </div>
                      <Card className="border-white/5 bg-zinc-900/40 py-0">
                        <CardContent className="px-3 py-3">
                          {routeHealth.length === 0 ? (
                            <div className="flex flex-col gap-1 py-4 text-center">
                              <div className="text-sm font-medium text-white">Belum ada data</div>
                              <p className="text-xs text-zinc-500">Data akan terisi setelah trayek dan armada tersedia.</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {routeHealth.map((route) => (
                                <div key={route.routeId} className="flex flex-col gap-1.5">
                                  <div className="flex items-center justify-between gap-3 text-xs">
                                    <span className="font-medium text-zinc-200">Trayek {route.routeId}</span>
                                    <span className="text-zinc-500">{route.onlineCount}/{route.total} online</span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                                    <div
                                      className={cn("h-full rounded-full", route.alertCount > 0 ? "bg-amber-400" : "bg-emerald-400")}
                                      style={{ width: `${Math.max(4, route.onlinePercent)}%` }}
                                    />
                                  </div>
                                  {route.alertCount > 0 && (
                                    <div className="text-[11px] text-amber-300">{route.alertCount} armada dengan alert/anomali.</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </section>

                    <section>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Armada Terpantau</h3>
                        <span className="text-xs text-zinc-500">{filteredVehicles.length} unit</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {filteredVehicles.length === 0 && (
                          <Card className="border-white/5 bg-zinc-900/40 py-0">
                            <CardContent className="px-3 py-3 text-xs text-zinc-400">
                              Belum ada armada untuk filter ini.
                            </CardContent>
                          </Card>
                        )}
                        {filteredVehicles.map((vehicle) => {
                          const locationContext = findNearestStop(vehicle, stops)
                          return (
                            <button
                              key={vehicle.id}
                              className="w-full rounded-lg border border-white/5 bg-zinc-900/50 p-3 text-left transition-colors hover:border-emerald-500/30"
                              onClick={() => {
                                setSelectedVehicleId(vehicle.id)
                                setIsSidebarOpen(true)
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-white">{vehicle.title}</div>
                                  <div className="truncate text-xs text-zinc-500">{vehicle.route_id || "-"} - {formatLastPing(vehicle.lastPing)}</div>
                                  {locationContext && (
                                    <div className="mt-0.5 truncate text-[11px] text-emerald-300">
                                      Dekat {locationContext.label} ({formatDistance(locationContext.distanceM)})
                                    </div>
                                  )}
                                </div>
                                <div className={cn("flex shrink-0 items-center gap-1 text-xs", isVehicleOnline(vehicle) ? "text-emerald-400" : "text-zinc-500")}>
                                  {isVehicleOnline(vehicle) ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                  {vehicle.speed === null || vehicle.speed === undefined ? "-" : `${vehicle.speed.toFixed(1)} km/h`}
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-[10px]">{label(VEHICLE_STATUS_LABEL, vehicle.status)}</Badge>
                                {vehicle.alertStatus && <Badge variant="destructive" className="text-[10px]">{label(VEHICLE_STATUS_LABEL, vehicle.alertStatus)}</Badge>}
                                {vehicle.lat === null || vehicle.lng === null ? (
                                  <Badge variant="secondary" className="text-[10px]">Belum ada posisi</Badge>
                                ) : null}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </section>

                    {passengers.length > 0 && (
                      <section>
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-white">Passenger Aktif</h3>
                          <span className="text-xs text-zinc-500">{passengers.length} user</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {passengers.slice(0, 8).map((passenger) => (
                            <button
                              key={passenger.id}
                              className="w-full rounded-lg border border-sky-500/10 bg-sky-500/10 p-3 text-left transition-colors hover:border-sky-400/40"
                              onClick={() => {
                                setSelectedPassengerId(passenger.id)
                                setSelectedVehicleId(null)
                                setIsSidebarOpen(true)
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-white">{passenger.name}</div>
                                  <div className="truncate text-xs text-sky-100/70">{formatLastPing(passenger.lastSeenAt)}</div>
                                </div>
                                <UserRound className="h-4 w-4 shrink-0 text-sky-300" />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-[10px]">{passenger.appState || "TRACKING"}</Badge>
                                <Badge variant="secondary" className="text-[10px]">{passenger.nearestPlateNo || "Belum ada kendaraan dekat"}</Badge>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Dashboard gagal memuat sebagian data</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  insight,
  tone,
}: {
  icon: ElementType
  label: string
  value: string | number
  insight: string
  tone: "good" | "warning"
}) {
  return (
    <Card
      className={cn(
        "border-white/5 bg-zinc-900/40 py-0",
        tone === "good" && "border-emerald-500/20 bg-emerald-500/10",
        tone === "warning" && "border-amber-500/20 bg-amber-500/10"
      )}
    >
      <CardHeader className="px-3 pt-3 pb-0">
        <CardTitle className="flex items-center gap-2 text-[10px] font-bold uppercase text-zinc-400">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-2">
        <div className="text-2xl font-semibold text-white">{value}</div>
        <p className="mt-1 text-[11px] leading-snug text-zinc-400">{insight}</p>
      </CardContent>
    </Card>
  )
}
