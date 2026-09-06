"use client"

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Polygon, CircleMarker, Tooltip } from "react-leaflet"
import MarkerClusterGroup from "@/components/map/MarkerClusterGroup"
import L from "leaflet"

// Fix for default marker icons in Next.js/React-Leaflet
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png"
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

type MapMarker = {
  id: string
  lat: number
  lng: number
  title?: string
  status?: string
  type?: string
  heading?: number
  route_id?: string
  locationLabel?: string | null
  locationDistanceM?: number | null
}

type MapBbox = {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

function MapController({ followedVehicleId, markers, onBoundsChange }: { followedVehicleId?: string | null, markers: MapMarker[], onBoundsChange?: (bbox: MapBbox) => void }) {
  const map = useMap()

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
    })
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  useEffect(() => {
    if (followedVehicleId) {
      const vehicle = markers.find(m => m.id === followedVehicleId)
      if (vehicle) {
        map.flyTo([vehicle.lat, vehicle.lng], map.getZoom(), {
          animate: true,
          duration: 1.5
        })
      }
    }
  }, [map, followedVehicleId, markers])

  useEffect(() => {
    if (!onBoundsChange) return

    let timeout: ReturnType<typeof setTimeout> | null = null
    const emitBounds = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        const bounds = map.getBounds().pad(0.2)
        const sw = bounds.getSouthWest()
        const ne = bounds.getNorthEast()
        onBoundsChange({
          minLon: sw.lng,
          minLat: sw.lat,
          maxLon: ne.lng,
          maxLat: ne.lat
        })
      }, 250)
    }

    emitBounds()
    map.on("moveend zoomend", emitBounds)
    return () => {
      if (timeout) clearTimeout(timeout)
      map.off("moveend zoomend", emitBounds)
    }
  }, [map, onBoundsChange])

  return null
}

interface MapViewProps {
  center?: [number, number]
  zoom?: number
  markers?: MapMarker[]
  geofences?: Array<{
    id: string
    color: string
    path: [number, number][][]
  }>
  stops?: Array<{
    id: string
    lat: number
    lng: number
    label: string
    route_id: string
    seq?: number
  }>
  historyPath?: [number, number][]
  routes?: Array<{
    id: string
    name: string
    color: string
    path: number[][] | [number, number][] | [number, number][][]
  }>
  onMarkerClick?: (id: string) => void
  onBoundsChange?: (bbox: MapBbox) => void
  followedVehicleId?: string | null
  showHeatmap?: boolean
  showStopLabels?: boolean
}

export default function MapView({
  center = [-6.595038, 106.816635],
  zoom = 13,
  markers = [],
  geofences = [],
  stops = [],
  historyPath = [],
  routes = [],
  onMarkerClick,
  onBoundsChange,
  followedVehicleId,
  showHeatmap,
  showStopLabels = false
}: MapViewProps) {


  const createIcon = (marker: MapMarker) => {
    const { status, heading = 0, type = 'VEHICLE' } = marker;
    
    if (status === 'PASSENGER' || type === 'PASSENGER') {
      return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
            background-color: #0ea5e9;
            width: 20px;
            height: 20px;
            border-radius: 9999px;
            border: 2px solid white;
            box-shadow: 0 0 12px #0ea5e9;
            color: white;
            font-size: 10px;
            font-weight: 700;
            line-height: 16px;
            text-align: center;
          ">P</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
    }

    let color = '#10b981'; // Green (IN_SERVICE)
    if (status === 'SOS' || status === 'OFF_ROUTE' || status === 'OVERSPEED' || status === 'LOST_SIGNAL' || status === 'CRITICAL') {
      color = '#ef4444'; // Red (Anomali)
    } else if (status === 'IDLE' || status === 'HIGH' || status === 'MEDIUM') {
      color = '#eab308'; // Yellow/Orange
    } else if (status === 'OUT_OF_SERVICE' || status === 'OFFLINE') {
      color = '#71717a'; // Gray (Offline)
    }

    if (type === 'INCIDENT') {
      return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
            background-color: ${color};
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 10px ${color};
          "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
    }

    // SVG icon similar to the directional marker (arrow/navigation shape) for VEHICLE
    const svgIcon = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${heading}deg); filter: drop-shadow(0px 0px 4px ${color});">
        <path d="M12 2 L22 20 L12 16 L2 20 Z" />
      </svg>
    `;

    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div>${svgIcon}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%", background: "#18181b" }}
        zoomControl={false}
        preferCanvas={true}
      >

        <MapController followedVehicleId={followedVehicleId} markers={markers} onBoundsChange={onBoundsChange} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          updateWhenZooming={false}
          updateWhenIdle={true}
        />

        {/* Heatmap Layer (Simplified Visual) */}
        {showHeatmap && markers.map((marker) => (
          <CircleMarker
            key={`heat-${marker.id}`}
            center={[marker.lat, marker.lng]}
            radius={20}
            pathOptions={{
              color: 'transparent',
              fillColor: marker.status === 'SOS' ? '#ef4444' : '#10b981',
              fillOpacity: 0.15
            }}
            interactive={false}
          />
        ))}

        {geofences.map((geofence, index) => (
          <Polygon
            key={`${geofence.id}-${index}`}
            positions={geofence.path as L.LatLngExpression[][]}
            pathOptions={{
              color: geofence.color,
              weight: 2.5,
              opacity: 0.82,
              fillOpacity: 0.08,
              dashArray: "6 6"
            }}
          />
        ))}

        {/* Render visible route corridor/geofence band before the OSRM centerline. */}
        {routes.map((route) => (
          <Polyline
            key={`${route.id}-corridor-band`}
            positions={route.path as L.LatLngExpression[] | L.LatLngExpression[][]}
            pathOptions={{
              color: route.color,
              weight: 18,
              opacity: 0.3,
              lineCap: 'round',
              lineJoin: 'round'
            }}
            interactive={false}
          />
        ))}

        {/* Render OSRM-snapped routes as outbound/inbound polylines. */}
        {routes.map((route) => (
          <Polyline
            key={route.id}
            positions={route.path as L.LatLngExpression[] | L.LatLngExpression[][]}
            pathOptions={{
              color: route.color,
              weight: 5,
              opacity: 0.95,
              lineCap: 'round'
            }}
          >
            <Popup>{route.name}</Popup>
          </Polyline>
        ))}

        {historyPath.length > 0 && (
          <Polyline
            positions={historyPath as L.LatLngExpression[]}
            pathOptions={{
              color: "#fbbf24",
              weight: 4,
              opacity: 0.9
            }}
          />
        )}

        {stops.map((stop) => (
          <CircleMarker
            key={stop.id}
            center={[stop.lat, stop.lng]}
            radius={showStopLabels ? 5 : 4}
            pathOptions={{
              color: "#facc15",
              fillColor: "#facc15",
              fillOpacity: 0.95,
              weight: showStopLabels ? 2 : 1
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -8]}
              opacity={showStopLabels ? 1 : 0.85}
              permanent={showStopLabels}
              className="route-stop-tooltip"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-zinc-950">{stop.label}</span>
                {showStopLabels && stop.seq ? (
                  <span className="text-[9px] font-semibold text-zinc-600">Titik {stop.seq} - Trayek {stop.route_id}</span>
                ) : null}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {markers.length > 500 ? (
          <MarkerClusterGroup chunkedLoading>
            {markers.map((marker) => (
              <Marker
                key={marker.id}
                position={[marker.lat, marker.lng]}
                icon={createIcon(marker)}
                eventHandlers={{
                  click: () => onMarkerClick && onMarkerClick(marker.id)
                }}
              >
                <Popup className="custom-popup">
                  <div className="text-xs font-semibold">{marker.title}</div>
                  <div className="text-[10px] text-gray-500">{marker.status}</div>
                  {marker.locationLabel ? (
                    <div className="mt-1 text-[10px] text-gray-600">
                      Dekat {marker.locationLabel}
                      {typeof marker.locationDistanceM === "number" ? ` (${Math.round(marker.locationDistanceM)} m)` : ""}
                    </div>
                  ) : null}
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        ) : (
          markers.map((marker) => (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={createIcon(marker)}
              eventHandlers={{
                click: () => onMarkerClick && onMarkerClick(marker.id)
              }}
            >
              <Popup className="custom-popup">
                <div className="text-xs font-semibold">{marker.title}</div>
                <div className="text-[10px] text-gray-500">{marker.status}</div>
                {marker.locationLabel ? (
                  <div className="mt-1 text-[10px] text-gray-600">
                    Dekat {marker.locationLabel}
                    {typeof marker.locationDistanceM === "number" ? ` (${Math.round(marker.locationDistanceM)} m)` : ""}
                  </div>
                ) : null}
              </Popup>
            </Marker>
          ))
        )}
      </MapContainer>

      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-zinc-950/20 via-transparent to-zinc-950/20 z-[400]" />
    </div>
  )
}
