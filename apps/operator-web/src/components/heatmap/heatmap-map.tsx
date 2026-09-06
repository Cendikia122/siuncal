"use client"

import { useEffect, useRef } from "react"

type HeatmapPoint = {
  grid_lat: number
  grid_lon: number
  value: number
  vehicle_count: number
  metric: string
  metadata: Record<string, unknown>
  route_id: string | null
}

type Props = {
  data: HeatmapPoint[]
  type: string
  gradient: Record<number, string>
}

const BOGOR_CENTER: [number, number] = [-6.595, 106.805]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletAny = any

export default function HeatmapMap({ data, type, gradient }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletAny>(null)
  const heatRef = useRef<LeafletAny>(null)
  const markersRef = useRef<LeafletAny[]>([])
  const leafletRef = useRef<LeafletAny>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return

    let cancelled = false

    const init = async () => {
      const leaflet = (await import("leaflet")).default
      await import("leaflet/dist/leaflet.css")
      await import("leaflet.heat")

      if (cancelled || !containerRef.current) return

      leafletRef.current = leaflet

      mapRef.current = leaflet.map(containerRef.current, {
        center: BOGOR_CENTER,
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
      })

      leaflet
        .tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
        })
        .addTo(mapRef.current)
    }

    init()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const leaflet = leafletRef.current
    if (!map || !leaflet) return

    if (heatRef.current) {
      map.removeLayer(heatRef.current)
      heatRef.current = null
    }

    markersRef.current.forEach((m: LeafletAny) => map.removeLayer(m))
    markersRef.current = []

    if (data.length === 0) return

    const maxVal = Math.max(...data.map((d) => d.value), 1)

    const heatData: [number, number, number][] = data.map((d) => [
      d.grid_lat,
      d.grid_lon,
      d.value / maxVal,
    ])

    heatRef.current = leaflet.heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      max: 1,
      gradient,
    }).addTo(map)

    if (heatData.length > 0) {
      const bounds = leaflet.latLngBounds(heatData.map((d: [number, number, number]) => [d[0], d[1]]))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    }

    data.forEach((d) => {
      const marker = leaflet.circleMarker([d.grid_lat, d.grid_lon], {
        radius: 6,
        color: "transparent",
        fillColor: "transparent",
        fillOpacity: 0,
        interactive: true,
      })

      const meta = d.metadata || {}
      let html = `<div style="font-size:12px;color:#e4e4e7;background:#18181b;padding:10px 12px;border-radius:8px;min-width:170px;border:1px solid rgba(255,255,255,0.1);">`
      html += `<div style="font-weight:700;margin-bottom:6px;color:#fff;">${type.replace(/_/g, " ")}</div>`
      html += `<div><b>${d.metric}:</b> ${d.value}</div>`
      html += `<div><b>Kendaraan:</b> ${d.vehicle_count}</div>`
      if (d.route_id) html += `<div><b>Route:</b> ${d.route_id}</div>`
      if (meta.stop_name) html += `<div><b>Halte:</b> ${String(meta.stop_name)}</div>`
      if (meta.avg_duration_min) html += `<div><b>Avg durasi:</b> ${String(meta.avg_duration_min)} min</div>`
      if (meta.max_speed) html += `<div><b>Max speed:</b> ${String(meta.max_speed)} km/h</div>`
      if (meta.point_count) html += `<div><b>Data points:</b> ${String(meta.point_count)}</div>`
      html += `</div>`

      marker.bindPopup(html, { className: "heatmap-popup", closeButton: false })
      marker.addTo(map)
      markersRef.current.push(marker)
    })
  }, [data, type, gradient])

  return <div ref={containerRef} className="h-full w-full" />
}
