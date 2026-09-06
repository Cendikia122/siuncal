"use client"

import { useEffect, useRef } from "react"
import { MapContainer, TileLayer, useMap } from "react-leaflet"
import type { FeatureCollection, Polygon } from "geojson"
import type { LeafletEvent } from "leaflet"
import L from "leaflet"
import "leaflet-draw"
import "leaflet/dist/leaflet.css"
import "leaflet-draw/dist/leaflet.draw.css"

type Props = {
  value: string
  onChange: (json: string) => void
}

function DrawControl({ value, onChange }: { value: string; onChange: (json: string) => void }) {
  const map = useMap()
  const drawnRef = useRef<L.FeatureGroup>(null!)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const drawn = new L.FeatureGroup()
    map.addLayer(drawn)
    drawnRef.current = drawn

    const drawControl = new (L.Control as unknown as { Draw: new (opts: Record<string, unknown>) => L.Control }).Draw({
      edit: { featureGroup: drawn },
      draw: {
        polygon: { allowIntersection: false, showArea: true },
        polyline: false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false,
      },
    })
    map.addControl(drawControl)

    const sync = () => {
      const layers = drawn.getLayers()
      if (layers.length === 0) {
        onChange("")
        return
      }
      const geojson = drawn.toGeoJSON() as FeatureCollection
      const coords = geojson.features[0]?.geometry as Polygon | undefined
      if (coords?.coordinates) {
        onChange(JSON.stringify(coords.coordinates))
      }
    }

    map.on(L.Draw.Event.CREATED, (e: LeafletEvent) => {
      const created = e as unknown as { layer: L.Polygon }
      drawn.addLayer(created.layer)
      sync()
    })
    map.on(L.Draw.Event.EDITED, sync)
    map.on(L.Draw.Event.DELETED, sync)

    return () => {
      map.removeControl(drawControl)
      map.removeLayer(drawn)
    }
  }, [map, onChange])

  useEffect(() => {
    if (!value || !drawnRef.current) return
    const existing = drawnRef.current.getLayers().length
    if (existing > 0) return
    try {
      const raw = JSON.parse(value) as number[][][]
      if (!Array.isArray(raw) || raw.length === 0) return
      const points: [number, number][] = raw[0].map((c) => [c[1] as number, c[0] as number])
      const polygon = L.polygon(points)
      drawnRef.current.addLayer(polygon)
      map.fitBounds(polygon.getBounds().pad(0.1))
    } catch {
      // invalid JSON, ignore
    }
  }, [value, map])

  return null
}

export default function GeofenceDrawMap({ value, onChange }: Props) {
  return (
    <MapContainer
      center={[-6.5944, 106.7892]}
      zoom={13}
      style={{ height: 350, width: "100%" }}
      className="rounded-md border border-input bg-zinc-900"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      <DrawControl value={value} onChange={onChange} />
    </MapContainer>
  )
}
