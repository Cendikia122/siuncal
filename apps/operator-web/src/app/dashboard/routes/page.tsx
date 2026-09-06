"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { RoleGate } from "@/components/auth/role-gate"
import {
  Map,
  Plus,
  Edit2,
  Trash2,
  Route as RouteIcon,
  ChevronRight,
  Settings2,
} from "lucide-react"

// Dynamic import for the map editor
const RouteEditorMap = dynamic(
  () => import("@/components/map/route-editor-map"),
  { ssr: false, loading: () => <MapSkeleton /> }
)

function MapSkeleton() {
  return (
    <div className="h-[500px] bg-zinc-900/50 rounded-xl flex items-center justify-center">
      <div className="text-zinc-500">Memuat peta...</div>
    </div>
  )
}

type RouteGeometry = {
  type: string
  coordinates: number[][]
}

type RouteItem = {
  route_id: string
  name: string
  color: string | null
  buffer_radius_m: number
  outbound: RouteGeometry | null
  inbound: RouteGeometry | null
}

type StopItem = {
  stop_id: string
  route_id: string
  name: string
  seq: number
  lat: number
  lng: number
}

type LatLng = [number, number]

type StopPoint = {
  id: string
  name: string
  latlng: LatLng
  seq: number
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [stops, setStops] = useState<StopItem[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showEditor, setShowEditor] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const [newRouteForm, setNewRouteForm] = useState({
    route_id: "",
    name: "",
    color: "#10b981",
    buffer_radius_m: 50,
  })

  const selectedRoute = useMemo(
    () => routes.find((route) => route.route_id === selectedRouteId) || null,
    [routes, selectedRouteId]
  )

  // Convert GeoJSON to LatLng array
  const routePath: LatLng[] = useMemo(() => {
    if (!selectedRoute?.outbound?.coordinates) return []
    // GeoJSON is [lng, lat], we need [lat, lng]
    return selectedRoute.outbound.coordinates.map(([lng, lat]) => [lat, lng] as LatLng)
  }, [selectedRoute])

  // Convert stops to StopPoint format
  const routeStops: StopPoint[] = useMemo(() => {
    return stops.map((stop) => ({
      id: stop.stop_id,
      name: stop.name,
      latlng: [stop.lat, stop.lng] as LatLng,
      seq: stop.seq,
    }))
  }, [stops])

  const loadRoutes = async () => {
    const data = await apiFetch("/routes")
    setRoutes(data.items || [])
  }

  const loadStops = async (routeId: string) => {
    if (!routeId) {
      setStops([])
      return
    }
    const data = await apiFetch(`/stops?route_id=${routeId}`)
    setStops(data.items || [])
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      setError("")
      try {
        await loadRoutes()
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Gagal memuat data trayek")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedRouteId) return
    loadStops(selectedRouteId)
  }, [selectedRouteId])

  const handleSelectRoute = (routeId: string) => {
    setSelectedRouteId(routeId)
    setShowEditor(true)
    setIsCreating(false)
    setError("")
    setSuccess("")
  }

  const handleCreateNew = () => {
    setSelectedRouteId("")
    setNewRouteForm({
      route_id: "",
      name: "",
      color: "#10b981",
      buffer_radius_m: 50,
    })
    setIsCreating(true)
    setShowEditor(true)
    setStops([])
    setError("")
    setSuccess("")
  }

  const handleSaveNewRoute = async () => {
    if (!newRouteForm.route_id.trim() || !newRouteForm.name.trim()) {
      setError("Route ID dan Nama wajib diisi")
      return
    }

    setSaving(true)
    setError("")
    try {
      await apiFetch("/routes", {
        method: "POST",
        body: JSON.stringify({
          route_id: newRouteForm.route_id,
          name: newRouteForm.name,
          color: newRouteForm.color,
          buffer_radius_m: newRouteForm.buffer_radius_m,
          outbound: null,
          inbound: null,
        }),
      })
      setSuccess("Trayek berhasil ditambahkan. Sekarang gambar rutenya!")
      await loadRoutes()
      setSelectedRouteId(newRouteForm.route_id)
      setIsCreating(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah trayek")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRoutePath = async (path: LatLng[], corridorWidth: number) => {
    if (!selectedRouteId) return

    setSaving(true)
    setError("")
    setSuccess("")

    try {
      // Convert [lat, lng] back to GeoJSON [lng, lat]
      const coordinates = path.map(([lat, lng]) => [lng, lat])
      const outbound = {
        type: "LineString",
        coordinates,
      }

      await apiFetch(`/routes/${selectedRouteId}`, {
        method: "PATCH",
        body: JSON.stringify({
          outbound,
          buffer_radius_m: corridorWidth,
        }),
      })

      setSuccess("Rute berhasil disimpan ke database!")
      await loadRoutes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan rute")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveStops = async (stopPoints: StopPoint[]) => {
    if (!selectedRouteId) return

    // Note: For simplicity, we're saving one by one
    // In production, you'd want a batch API
    setSaving(true)
    setError("")

    try {
      // Existing stops to delete
      const existingIds = new Set(stops.map((s) => s.stop_id))
      const newIds = new Set(stopPoints.map((s) => s.id))

      // Delete removed stops
      for (const stop of stops) {
        if (!newIds.has(stop.stop_id)) {
          await apiFetch(`/stops/${stop.stop_id}`, { method: "DELETE" })
        }
      }

      // Add new stops
      for (const stop of stopPoints) {
        if (!existingIds.has(stop.id)) {
          await apiFetch("/stops", {
            method: "POST",
            body: JSON.stringify({
              route_id: selectedRouteId,
              name: stop.name,
              seq: stop.seq,
              lat: stop.latlng[0],
              lng: stop.latlng[1],
            }),
          })
        }
      }

      await loadStops(selectedRouteId)
      setSuccess("Halte berhasil diperbarui!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan halte")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRoute = async (routeId: string) => {
    if (!confirm(`Hapus trayek ${routeId}? Semua data rute akan terhapus.`)) return

    setSaving(true)
    setError("")
    try {
      await apiFetch(`/routes/${routeId}`, { method: "DELETE" })
      setSuccess("Trayek berhasil dihapus.")
      if (selectedRouteId === routeId) {
        setSelectedRouteId("")
        setShowEditor(false)
      }
      await loadRoutes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus trayek")
    } finally {
      setSaving(false)
    }
  }

  const handleCloseEditor = () => {
    setShowEditor(false)
    setIsCreating(false)
    setSelectedRouteId("")
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <section aria-label="Header">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <RouteIcon className="w-6 h-6 text-emerald-500" />
              Master Trayek & Stop
            </h1>
            <p className="text-muted-foreground">
              Kelola trayek, gambar rute di peta, dan atur halte resmi.
            </p>
          </div>
          <RoleGate feature="master_data_write">
            <Button type="button" variant="glow" size="sm" className="gap-2" onClick={handleCreateNew}>
              <Plus className="w-4 h-4" />
              Tambah Trayek
            </Button>
          </RoleGate>
        </div>
      </section>

      {/* Messages */}
      <section aria-label="Pesan">
        {success && (
          <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3">
            ✓ {success}
          </div>
        )}
        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
            ✕ {error}
          </div>
        )}
      </section>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="bg-zinc-900/30 border border-white/10 rounded-xl p-4">
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Route List */}
          <section aria-label="Daftar trayek">
            <div className="space-y-4">
              <h2 className="font-semibold text-sm text-zinc-400 uppercase tracking-wide">
                Daftar Trayek ({routes.length})
              </h2>
              <div className="space-y-2">
                {routes.length === 0 && (
                  <div className="text-sm text-zinc-500 bg-zinc-900/30 rounded-lg p-4">
                    Belum ada trayek. Klik &quot;Tambah Trayek&quot; untuk membuat.
                  </div>
                )}
                {routes.map((route) => (
                  <div
                    key={route.route_id}
                    className={`group relative rounded-lg border transition-all cursor-pointer ${selectedRouteId === route.route_id
                      ? "border-emerald-500 bg-emerald-500/5"
                      : "border-white/10 hover:border-white/30 bg-zinc-900/30"
                      }`}
                    onClick={() => handleSelectRoute(route.route_id)}
                  >
                    <div className="p-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: route.color || "#10b981" }}
                        />
                        <span className="font-bold">{route.route_id}</span>
                        <ChevronRight className="w-4 h-4 ml-auto text-zinc-500 group-hover:text-white" />
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">{route.name}</div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Map className="w-3 h-3" />
                          {route.outbound?.coordinates?.length || 0} titik
                        </span>
                        <span className="flex items-center gap-1">
                          <Settings2 className="w-3 h-3" />
                          {route.buffer_radius_m}m
                        </span>
                      </div>
                    </div>
                    <RoleGate feature="master_data_write">
                      <button
                        type="button"
                        className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteRoute(route.route_id)
                        }}
                        aria-label="Hapus trayek"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </RoleGate>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Editor Area */}
          <div className="xl:col-span-3" data-tour="routes-editor">
            {!showEditor && !isCreating && (
              <section aria-label="Tempat editor">
                <div className="h-[500px] bg-zinc-900/30 border border-white/10 border-dashed rounded-xl flex flex-col items-center justify-center">
                  <Map className="w-16 h-16 text-zinc-700 mb-4" />
                  <p className="text-zinc-500 text-center">
                    Pilih trayek dari daftar untuk mengedit rute
                    <br />
                    atau klik &quot;Tambah Trayek&quot; untuk membuat baru
                  </p>
                </div>
              </section>
            )}

            {/* Create New Route Form */}
            {isCreating && !selectedRouteId && (
              <section aria-label="Form trayek baru">
                <form
                  className="bg-zinc-900/30 border border-white/10 rounded-xl p-6 space-y-4"
                  onSubmit={(e) => { e.preventDefault(); handleSaveNewRoute() }}
                >
                  <h2 className="font-semibold flex items-center gap-2">
                    <Plus className="w-5 h-5 text-emerald-500" />
                    Buat Trayek Baru
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Route ID *</label>
                      <input
                        aria-label="Route ID"
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none"
                        placeholder="Contoh: 01, A, CICAHEUM"
                        value={newRouteForm.route_id}
                        onChange={(e) => setNewRouteForm({ ...newRouteForm, route_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Nama Trayek *</label>
                      <input
                        aria-label="Nama Trayek"
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none"
                        placeholder="Contoh: Cicaheum - Ciroyom"
                        value={newRouteForm.name}
                        onChange={(e) => setNewRouteForm({ ...newRouteForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Warna</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          className="w-10 h-10 rounded cursor-pointer"
                          value={newRouteForm.color}
                          onChange={(e) => setNewRouteForm({ ...newRouteForm, color: e.target.value })}
                        />
                        <input
                          aria-label="Warna"
                          className="flex-1 h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none"
                          value={newRouteForm.color}
                          onChange={(e) => setNewRouteForm({ ...newRouteForm, color: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Lebar Koridor (m)</label>
                      <input
                        type="number"
                        aria-label="Lebar Koridor"
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none"
                        value={newRouteForm.buffer_radius_m}
                        onChange={(e) =>
                          setNewRouteForm({ ...newRouteForm, buffer_radius_m: Number(e.target.value) })
                        }
                        min={10}
                        max={500}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="glow" size="sm" onClick={handleSaveNewRoute} disabled={saving}>
                      {saving ? "Menyimpan..." : "Buat & Lanjut ke Gambar Rute"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleCloseEditor}>
                      Batal
                    </Button>
                  </div>
                </form>
              </section>
            )}

            {/* Route Editor Map */}
            {showEditor && selectedRouteId && (
              <section aria-label="Editor rute">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold flex items-center gap-2">
                      <Edit2 className="w-5 h-5 text-emerald-500" />
                      Editor Rute:{" "}
                      <span className="text-emerald-400">{selectedRoute?.name || selectedRouteId}</span>
                    </h2>
                    <Button type="button" variant="ghost" size="sm" onClick={handleCloseEditor}>
                      Tutup Editor
                    </Button>
                  </div>

                  <RoleGate
                    feature="master_data_write"
                    fallback={
                      <RouteEditorMap
                        key={`readonly-${selectedRouteId}`}
                        initialPath={routePath}
                        initialStops={routeStops}
                        corridorWidth={selectedRoute?.buffer_radius_m || 50}
                        routeColor={selectedRoute?.color || "#10b981"}
                        center={routePath[0] || [-6.5944, 106.7892]}
                        readOnly
                      />
                    }
                  >
                    <RouteEditorMap
                      key={`editable-${selectedRouteId}`}
                      initialPath={routePath}
                      initialStops={routeStops}
                      corridorWidth={selectedRoute?.buffer_radius_m || 50}
                      routeColor={selectedRoute?.color || "#10b981"}
                      center={routePath[0] || [-6.5944, 106.7892]}
                      onSave={handleSaveRoutePath}
                      onSaveStops={handleSaveStops}
                      onCancel={handleCloseEditor}
                    />
                  </RoleGate>

                  {saving && (
                    <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
                      ⏳ Menyimpan ke database...
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
