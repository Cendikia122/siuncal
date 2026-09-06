"use client"

import { useEffect, useState } from "react"
import { MapPin, Map as MapIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { GEOFENCE_TYPE_LABEL, label } from "@/lib/labels"
import dynamic from "next/dynamic"

const GeofenceDrawMap = dynamic(() => import("@/components/map/geofence-draw-map"), { ssr: false })

type GeofenceItem = {
  geofence_id: string
  name: string
  type: string
  route_id: string | null
  geom: { type: string, coordinates: number[][][] } | null
}

type RouteItem = {
  route_id: string
  name: string
}

export default function GeofencesPage() {
  const [geofences, setGeofences] = useState<GeofenceItem[]>([])
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [form, setForm] = useState({
    name: "",
    type: "BASE",
    route_id: "",
    coordinates: ""
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const load = async () => {
    const [geofenceData, routeData] = await Promise.all([
      apiFetch("/geofences"),
      apiFetch("/routes")
    ])
    setGeofences(geofenceData.items || [])
    setRoutes(routeData.items || [])
  }

  useEffect(() => {
    let active = true
    const init = async () => {
      setError("")
      try {
        await load()
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Gagal memuat geofence")
      } finally {
        if (active) setLoading(false)
      }
    }
    init()
    return () => {
      active = false
    }
  }, [])

  const handleCreate = async () => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const coordinates = JSON.parse(form.coordinates)
      await apiFetch("/geofences", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          route_id: form.route_id || null,
          coordinates
        })
      })
      setForm({ name: "", type: "BASE", route_id: "", coordinates: "" })
      setSuccess("Geofence berhasil ditambahkan.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah geofence")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      await apiFetch(`/geofences/${id}`, { method: "DELETE" })
      setSuccess("Geofence dihapus.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus geofence")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label="Manajemen Geofence" className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-violet-500/10 p-2">
          <MapPin className="h-6 w-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Geofence Base & Terminal</h1>
          <p className="text-muted-foreground">Kelola area base/pool dan terminal.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((item) => (
            <div key={item} className="bg-zinc-900/30 border border-white/10 rounded-xl p-4">
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="bg-card/50 border border-border rounded-xl p-6 space-y-4" data-tour="geofence-editor">
            <h2 className="font-semibold text-sm">Tambah Geofence</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                aria-label="Nama Geofence"
                className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                placeholder="Nama Geofence"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <select
                aria-label="Tipe Geofence"
                className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
              >
                <option value="BASE">BASE / POOL</option>
                <option value="TERMINAL">TERMINAL</option>
                <option value="STOP">STOP</option>
                <option value="HALTE">HALTE</option>
                <option value="DANGER_ZONE">DANGER ZONE</option>
                <option value="RESTRICTED">RESTRICTED</option>
              </select>
              <select
                aria-label="Trayek"
                className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                value={form.route_id}
                onChange={(event) => setForm({ ...form, route_id: event.target.value })}
              >
                <option value="">Semua Trayek</option>
                {routes.map((route) => (
                  <option key={route.route_id} value={route.route_id}>
                    {route.route_id} - {route.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <MapIcon className="w-3.5 h-3.5" /> Gambar Area di Peta
              </label>
              <GeofenceDrawMap
                value={form.coordinates}
                onChange={(coords) => setForm({ ...form, coordinates: coords })}
              />
              {form.coordinates && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">Lihat JSON koordinat</summary>
                  <pre className="mt-1 p-2 bg-card rounded border border-border font-mono text-[10px] overflow-x-auto max-h-[80px]">
                    {form.coordinates}
                  </pre>
                </details>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="glow" size="sm" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Geofence"}
              </Button>
              {success && <span className="text-xs text-emerald-400">{success}</span>}
            </div>
            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
                {error}
              </div>
            )}
          </form>

          <div className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 uppercase text-xs font-semibold text-zinc-400">
                <tr>
                  <th scope="col" className="px-6 py-4">Nama</th>
                  <th scope="col" className="px-6 py-4">Tipe</th>
                  <th scope="col" className="px-6 py-4">Trayek</th>
                  <th scope="col" className="px-6 py-4 hidden md:table-cell">Koordinat</th>
                  <th scope="col" className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {geofences.map((geofence) => (
                  <tr key={geofence.geofence_id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-white font-medium">{geofence.name}</td>
                    <td className="px-6 py-4 text-zinc-400">{label(GEOFENCE_TYPE_LABEL, geofence.type)}</td>
                    <td className="px-6 py-4 text-zinc-400">{geofence.route_id || "-"}</td>
                    <td className="px-6 py-4 text-xs text-zinc-500 max-w-[240px] truncate hidden md:table-cell">
                      {geofence.geom ? JSON.stringify(geofence.geom.coordinates) : "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(geofence.geofence_id)}>
                        Hapus
                      </Button>
                    </td>
                  </tr>
                ))}
                {geofences.length === 0 && (
                  <tr>
                    <td className="px-6 py-6 text-center text-zinc-500 text-sm" colSpan={5}>
                      Belum ada geofence.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
