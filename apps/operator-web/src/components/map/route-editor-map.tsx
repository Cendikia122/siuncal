"use client"

import dynamic from "next/dynamic"
import { useState, useCallback } from "react"
import { useMapEvents } from "react-leaflet"
import { Button } from "@/components/ui/button"
import {
  Pencil,
  MousePointer2,
  Trash2,
  RotateCcw,
  RotateCw,
  Save,
  X,
  MapPin,
  Route as RouteIcon,
  Circle,
} from "lucide-react"

// Dynamic import of map components (no SSR)
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false })
const Polyline = dynamic(() => import("react-leaflet").then((m) => m.Polyline), { ssr: false })
const CircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false })
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false })
const Tooltip = dynamic(() => import("react-leaflet").then((m) => m.Tooltip), { ssr: false })

function MapClickHandler({ onClick }: { onClick: (latlng: [number, number]) => void }) {
  useMapEvents({
    click: (e) => {
      onClick([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

export type RouteEditorMode = "view" | "draw" | "edit" | "stop"

export type LatLng = [number, number]

export type StopPoint = {
  id: string
  name: string
  latlng: LatLng
  seq: number
}

type Props = {
  initialPath?: LatLng[]
  initialStops?: StopPoint[]
  corridorWidth?: number
  routeColor?: string
  onSave?: (path: LatLng[], corridorWidth: number) => void
  onSaveStops?: (stops: StopPoint[]) => void
  onCancel?: () => void
  readOnly?: boolean
  center?: LatLng
  zoom?: number
}

export default function RouteEditorMap({
  initialPath = [],
  initialStops = [],
  corridorWidth: initialCorridorWidth = 50,
  routeColor = "#10b981",
  onSave,
  onSaveStops,
  onCancel,
  readOnly = false,
  center = [-6.5944, 106.7892], // Kota Bogor
  zoom = 13,
}: Props) {
  const [mode, setMode] = useState<RouteEditorMode>("view")
  const [path, setPath] = useState<LatLng[]>(initialPath)
  const [stops, setStops] = useState<StopPoint[]>(initialStops)
  const [corridorWidth, setCorridorWidth] = useState(initialCorridorWidth)
  const [history, setHistory] = useState<LatLng[][]>([initialPath])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null)
  const [stopName, setStopName] = useState("")
  const [pendingStopLocation, setPendingStopLocation] = useState<LatLng | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const addToHistory = useCallback((newPath: LatLng[]) => {
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndex + 1)
      return [...truncated, newPath]
    })
    setHistoryIndex((prev) => prev + 1)
  }, [historyIndex])

  const handleMapClick = useCallback(
    (latlng: LatLng) => {
      if (readOnly) return

      if (mode === "draw") {
        const newPath = [...path, latlng]
        setPath(newPath)
        addToHistory(newPath)
        setHasChanges(true)
      } else if (mode === "stop") {
        setPendingStopLocation(latlng)
      }
    },
    [mode, path, addToHistory, readOnly]
  )

  const handlePointClick = useCallback(
    (index: number) => {
      if (mode === "edit") {
        setSelectedPointIndex(index)
      }
    },
    [mode]
  )

  const handleDeletePoint = useCallback(
    (index: number) => {
      const newPath = path.filter((_, i) => i !== index)
      setPath(newPath)
      addToHistory(newPath)
      setSelectedPointIndex(null)
      setHasChanges(true)
    },
    [path, addToHistory]
  )

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1)
      setPath(history[historyIndex - 1])
      setHasChanges(true)
    }
  }, [historyIndex, history])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1)
      setPath(history[historyIndex + 1])
      setHasChanges(true)
    }
  }, [historyIndex, history])

  const handleClearAll = useCallback(() => {
    if (confirm("Hapus semua titik rute?")) {
      const newPath: LatLng[] = []
      setPath(newPath)
      addToHistory(newPath)
      setSelectedPointIndex(null)
      setHasChanges(true)
    }
  }, [addToHistory])

  const handleAddStop = useCallback(() => {
    if (!pendingStopLocation || !stopName.trim()) return

    const newStop: StopPoint = {
      id: `stop-${Date.now()}`,
      name: stopName,
      latlng: pendingStopLocation,
      seq: stops.length + 1,
    }
    setStops([...stops, newStop])
    setPendingStopLocation(null)
    setStopName("")
    setHasChanges(true)
  }, [pendingStopLocation, stopName, stops])

  const handleDeleteStop = useCallback(
    (stopId: string) => {
      setStops((prev) => prev.filter((s) => s.id !== stopId))
      setHasChanges(true)
    },
    []
  )

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(path, corridorWidth)
    }
    if (onSaveStops) {
      onSaveStops(stops)
    }
    setHasChanges(false)
  }, [path, corridorWidth, stops, onSave, onSaveStops])

  const handleCancel = useCallback(() => {
    if (hasChanges && !confirm("Ada perubahan yang belum disimpan. Yakin ingin membatalkan?")) {
      return
    }
    setPath(initialPath)
    setStops(initialStops)
    setMode("view")
    if (onCancel) onCancel()
  }, [hasChanges, initialPath, initialStops, onCancel])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 bg-zinc-900/50 border border-white/10 rounded-lg p-3">
          <div className="flex items-center gap-1 border-r border-white/10 pr-3 mr-3">
            <Button
              variant={mode === "view" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("view")}
              className="gap-2"
            >
              <MousePointer2 className="w-4 h-4" />
              <span className="hidden sm:inline">View</span>
            </Button>
            <Button
              variant={mode === "draw" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("draw")}
              className="gap-2"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Draw</span>
            </Button>
            <Button
              variant={mode === "edit" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("edit")}
              className="gap-2"
            >
              <RouteIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              variant={mode === "stop" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("stop")}
              className="gap-2"
            >
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Stop</span>
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex === 0}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
            >
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              disabled={path.length === 0}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 border-l border-white/10 pl-3 ml-auto">
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-zinc-400" />
              <input
                type="number"
                className="w-16 h-8 px-2 text-sm bg-black/20 border border-white/10 rounded"
                value={corridorWidth}
                onChange={(e) => {
                  setCorridorWidth(Number(e.target.value))
                  setHasChanges(true)
                }}
                min={10}
                max={500}
              />
              <span className="text-xs text-zinc-400">m</span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-white/10 pl-3">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="w-4 h-4" />
            </Button>
            <Button
              variant="glow"
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Mode Instructions */}
      {!readOnly && (
        <div className="text-xs text-zinc-400 bg-zinc-900/30 rounded px-3 py-2">
          {mode === "draw" && "🖊️ Klik di peta untuk menambah titik rute"}
          {mode === "edit" && "✏️ Klik titik untuk memilih, lalu klik \"Hapus\" untuk menghapus titik"}
          {mode === "stop" && "📍 Klik di peta untuk menambah halte"}
          {mode === "view" && "👁️ Mode view - geser dan zoom peta"}
        </div>
      )}

      {/* Stop Name Input (when adding stop) */}
      {pendingStopLocation && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <MapPin className="w-4 h-4 text-amber-400" />
          <input
            type="text"
            className="flex-1 h-8 px-3 text-sm bg-black/20 border border-white/10 rounded"
            placeholder="Nama halte..."
            value={stopName}
            onChange={(e) => setStopName(e.target.value)}
            autoFocus
          />
          <Button size="sm" onClick={handleAddStop} disabled={!stopName.trim()}>
            Tambah
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPendingStopLocation(null)
              setStopName("")
            }}
          >
            Batal
          </Button>
        </div>
      )}

      {/* Map */}
      <div className="h-[500px] rounded-xl overflow-hidden border border-white/10">
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: "100%", width: "100%" }}
          className="bg-zinc-900"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          {!readOnly && <MapClickHandler onClick={handleMapClick} />}

          {/* Route Line */}
          {path.length >= 2 && (
            <Polyline
              positions={path}
              pathOptions={{
                color: routeColor,
                weight: 4,
                opacity: 0.8,
              }}
            />
          )}

          {/* Route Points */}
          {path.map((point, index) => (
            <CircleMarker
              key={`point-${index}`}
              center={point}
              radius={selectedPointIndex === index ? 10 : 6}
              pathOptions={{
                color: selectedPointIndex === index ? "#ef4444" : routeColor,
                fillColor: selectedPointIndex === index ? "#ef4444" : "#fff",
                fillOpacity: 1,
                weight: 2,
              }}
              eventHandlers={{
                click: () => handlePointClick(index),
              }}
            >
              <Tooltip permanent={false}>
                <div className="text-xs">
                  Titik {index + 1}
                  <br />
                  {point[0].toFixed(5)}, {point[1].toFixed(5)}
                </div>
              </Tooltip>
              {mode === "edit" && selectedPointIndex === index && (
                <Popup>
                  <div className="text-center">
                    <div className="font-semibold mb-2">Titik {index + 1}</div>
                    <button
                      className="px-3 py-1 bg-red-500 text-white text-xs rounded"
                      onClick={() => handleDeletePoint(index)}
                    >
                      Hapus Titik
                    </button>
                  </div>
                </Popup>
              )}
            </CircleMarker>
          ))}

          {/* Pending Stop Location */}
          {pendingStopLocation && (
            <CircleMarker
              center={pendingStopLocation}
              radius={10}
              pathOptions={{
                color: "#f59e0b",
                fillColor: "#f59e0b",
                fillOpacity: 0.5,
                weight: 2,
                dashArray: "5,5",
              }}
            />
          )}

          {/* Stops */}
          {stops.map((stop) => (
            <CircleMarker
              key={stop.id}
              center={stop.latlng}
              radius={8}
              pathOptions={{
                color: "#3b82f6",
                fillColor: "#3b82f6",
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>
                <div className="text-center">
                  <div className="font-semibold">{stop.name}</div>
                  <div className="text-xs text-gray-500">Halte #{stop.seq}</div>
                  {!readOnly && (
                    <button
                      className="mt-2 px-3 py-1 bg-red-500 text-white text-xs rounded"
                      onClick={() => handleDeleteStop(stop.id)}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </Popup>
              <Tooltip permanent>
                <span className="text-xs font-semibold">{stop.seq}</span>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-zinc-900/50 border border-white/10 rounded-lg p-3">
          <div className="text-zinc-400">Total Titik</div>
          <div className="text-lg font-bold text-white">{path.length}</div>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-lg p-3">
          <div className="text-zinc-400">Total Halte</div>
          <div className="text-lg font-bold text-blue-400">{stops.length}</div>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-lg p-3">
          <div className="text-zinc-400">Lebar Koridor</div>
          <div className="text-lg font-bold text-emerald-400">{corridorWidth}m</div>
        </div>
        <div className="bg-zinc-900/50 border border-white/10 rounded-lg p-3">
          <div className="text-zinc-400">Perubahan</div>
          <div className={`text-lg font-bold ${hasChanges ? "text-amber-400" : "text-zinc-500"}`}>
            {hasChanges ? "Belum disimpan" : "Tersimpan"}
          </div>
        </div>
      </div>
    </div>
  )
}
