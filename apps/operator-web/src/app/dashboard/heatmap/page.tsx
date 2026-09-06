"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { Flame, Download, RefreshCw, MapPin, AlertTriangle, Gauge } from "lucide-react"
import { RoleGate } from "@/components/auth/role-gate"
import { apiFetch, emitActionFeedback } from "@/lib/api"
import { toPng } from "html-to-image"

const HeatmapMap = dynamic(() => import("@/components/heatmap/heatmap-map"), { ssr: false })

type HeatmapType = "STOP_DENSITY" | "NGETEM_ZONE" | "OFF_ROUTE_ZONE" | "SPEED_ZONE"
type TimeRange = "24h" | "7d" | "30d"

type HeatmapPoint = {
  grid_lat: number
  grid_lon: number
  route_id: string | null
  metric: string
  value: number
  vehicle_count: number
  metadata: Record<string, unknown>
  created_at: string
}

type Route = { route_id: string; name: string }

type InsightRow = {
  route_id: string
  route_name?: string
  stop_name?: string
  total_stops?: number
  total_ngetem?: number
  total_off_route?: number
  avg_speed?: number
  max_speed?: number
  total_vehicles: number
}

type Insights = {
  busiest_stops: InsightRow[]
  most_ngetem_routes: InsightRow[]
  most_off_route_routes: InsightRow[]
  highest_speed_routes: InsightRow[]
}

type StatusType = { type: string; last_generated: string; data_points: number }

const TYPE_CONFIG: Record<HeatmapType, { label: string; icon: typeof Flame; gradient: Record<number, string>; description: string }> = {
  STOP_DENSITY: {
    label: "Stop Density",
    icon: MapPin,
    gradient: { 0.2: "#10b981", 0.5: "#f59e0b", 0.8: "#ef4444" },
    description: "Kepadatan kendaraan berhenti di sekitar halte (speed < 5 km/h, radius 50m dari halte).",
  },
  NGETEM_ZONE: {
    label: "Ngetem Zone",
    icon: AlertTriangle,
    gradient: { 0.2: "#f59e0b", 0.5: "#f97316", 0.8: "#ef4444" },
    description: "Zona berhenti lama (ngetem) berdasarkan anomaly NGETEM yang terdeteksi.",
  },
  OFF_ROUTE_ZONE: {
    label: "Off-Route Zone",
    icon: MapPin,
    gradient: { 0.2: "#fbbf24", 0.5: "#f97316", 0.8: "#dc2626" },
    description: "Zona konsentrasi pelanggaran keluar trayek berdasarkan anomaly OFF_ROUTE.",
  },
  SPEED_ZONE: {
    label: "Speed Zone",
    icon: Gauge,
    gradient: { 0.2: "#22c55e", 0.5: "#eab308", 0.8: "#ef4444" },
    description: "Kecepatan rata-rata per segmen. Hijau = normal, kuning = pelan, merah = kencang.",
  },
}

export default function HeatmapPage() {
  const [type, setType] = useState<HeatmapType>("STOP_DENSITY")
  const [range, setRange] = useState<TimeRange>("24h")
  const [routeId, setRouteId] = useState<string>("")
  const [data, setData] = useState<HeatmapPoint[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState<StatusType[]>([])
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiFetch<{ items: Route[] }>("/routes")
      .then((r) => setRoutes(r.items || []))
      .catch(() => {})
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type, range })
      if (routeId) params.set("route_id", routeId)
      const res = await apiFetch<{ data: HeatmapPoint[] }>(`/analytics/heatmap?${params}`)
      setData(res.data || [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [type, range, routeId])

  const loadInsights = useCallback(async () => {
    try {
      const res = await apiFetch<{ insights: Insights }>(`/analytics/heatmap/insights?range=${range}`)
      setInsights(res.insights || null)
    } catch {
      setInsights(null)
    }
  }, [range])

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch<{ types: StatusType[] }>("/analytics/heatmap/status")
      setStatus(res.types || [])
    } catch {
      setStatus([])
    }
  }, [])

  useEffect(() => {
    loadData()
    loadInsights()
    loadStatus()
  }, [loadData, loadInsights, loadStatus])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const hours = range === "24h" ? 24 : range === "7d" ? 168 : 720
      await apiFetch("/analytics/heatmap/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ALL", hours }),
      })
      emitActionFeedback({ type: "success", title: "Generate heatmap dimulai", message: "Data akan diperbarui beberapa detik lagi." })
      setTimeout(() => {
        loadData()
        loadInsights()
        loadStatus()
        setGenerating(false)
        emitActionFeedback({ type: "info", title: "Heatmap diperbarui", message: "Data heatmap terbaru sudah dimuat ulang." })
      }, 5000)
    } catch (err) {
      setGenerating(false)
      emitActionFeedback({ type: "error", title: "Generate heatmap gagal", message: err instanceof Error ? err.message : "Coba ulangi beberapa saat lagi." })
    }
  }

  const handleExportPng = async () => {
    if (!mapRef.current) {
      emitActionFeedback({ type: "info", title: "Peta belum siap", message: "Tunggu peta heatmap selesai dimuat sebelum export PNG." })
      return
    }
    try {
      const dataUrl = await toPng(mapRef.current, { backgroundColor: "#18181b" })
      const link = document.createElement("a")
      link.download = `heatmap-${type}-${range}-${new Date().toISOString().slice(0, 10)}.png`
      link.href = dataUrl
      link.click()
      emitActionFeedback({ type: "success", title: "PNG berhasil dibuat", message: "File heatmap mulai diunduh." })
    } catch (err) {
      emitActionFeedback({ type: "error", title: "Export PNG gagal", message: err instanceof Error ? err.message : "Coba ulangi export." })
    }
  }

  const config = TYPE_CONFIG[type]

  return (
    <RoleGate roles="ANALISA" showDenied>
      <div className="p-6">
        <section aria-label="Header heatmap">
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/10 p-2">
                <Flame className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Heatmap Operasional</h1>
                <p className="text-sm text-zinc-500">Visualisasi zona panas berdasarkan data GPS real dan anomaly.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/20 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
                {generating ? "Generating..." : "Generate"}
              </button>
              <button
                type="button"
                onClick={handleExportPng}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                <Download className="h-4 w-4" />
                PNG
              </button>
            </div>
          </div>
        </section>

        <section aria-label="Filter dan kontrol" data-tour="heatmap-controls">
          <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3">
            <div className="flex overflow-x-auto rounded-lg border border-white/10 bg-zinc-900 p-1 max-w-full">
              {(Object.keys(TYPE_CONFIG) as HeatmapType[]).map((t) => {
                const cfg = TYPE_CONFIG[t]
                const Icon = cfg.icon
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      type === t ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>

            <div className="flex rounded-lg border border-white/10 bg-zinc-900 p-1">
              {(["24h", "7d", "30d"] as TimeRange[]).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    range === r ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {r === "24h" ? "24 Jam Terakhir" : r === "7d" ? "7 Hari Terakhir" : "30 Hari Terakhir"}
                </button>
              ))}
            </div>

            <select
              aria-label="Pilih route"
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              <option value="">Semua Route</option>
              {routes.map((r) => (
                <option key={r.route_id} value={r.route_id}>
                  {r.name}
                </option>
              ))}
            </select>

            <span className="text-xs text-zinc-600">
              {loading ? "Memuat..." : `${data.length} titik data`}
            </span>
          </div>

          {/* Description */}
          <div className="mb-4 rounded-lg border border-white/5 bg-zinc-900/50 px-4 py-3">
            <p className="text-xs text-zinc-400">{config.description}</p>
          </div>
        </section>

        {/* Map */}
        <section aria-label="Peta heatmap" data-tour="heatmap-view">
          <div ref={mapRef} className="mb-6 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 h-[500px]">
            {data.length > 0 ? (
              <HeatmapMap data={data} type={type} gradient={config.gradient} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-zinc-600">
                  <Flame className="mx-auto mb-3 h-10 w-10" />
                  <p className="text-sm">
                    {loading ? "Memuat data heatmap..." : "Belum ada data heatmap. Klik \"Generate Data\" untuk memulai."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Status Cards */}
        {status.length > 0 && (
          <section aria-label="Status heatmap">
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {status.map((s) => (
                <div key={s.type} className="rounded-lg border border-white/5 bg-zinc-900 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{s.type.replace(/_/g, " ")}</div>
                  <div className="mt-1 text-lg font-bold text-white">{s.data_points}</div>
                  <div className="text-[10px] text-zinc-600">
                    Last: {new Date(s.last_generated).toLocaleString("id-ID")}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Insights */}
        {insights && (
          <section aria-label="Insight heatmap">
            <div className="grid gap-4 md:grid-cols-2">
              <InsightCard
                title="Halte Tersibuk"
                icon={MapPin}
                borderColor="border-emerald-500/20"
                iconColor="text-emerald-500"
                rows={insights.busiest_stops}
                columns={[
                  { key: "stop_name", label: "Halte" },
                  { key: "total_stops", label: "Stop Count" },
                  { key: "total_vehicles", label: "Kendaraan" },
                ]}
              />
              <InsightCard
                title="Route Ngetem Tersering"
                icon={AlertTriangle}
                borderColor="border-orange-500/20"
                iconColor="text-orange-500"
                rows={insights.most_ngetem_routes}
                columns={[
                  { key: "route_name", label: "Route" },
                  { key: "total_ngetem", label: "Ngetem" },
                  { key: "total_vehicles", label: "Kendaraan" },
                ]}
              />
              <InsightCard
                title="Route Off-Route Tertinggi"
                icon={MapPin}
                borderColor="border-red-500/20"
                iconColor="text-red-500"
                rows={insights.most_off_route_routes}
                columns={[
                  { key: "route_name", label: "Route" },
                  { key: "total_off_route", label: "Off-Route" },
                  { key: "total_vehicles", label: "Kendaraan" },
                ]}
              />
              <InsightCard
                title="Route Kecepatan Tinggi"
                icon={Gauge}
                borderColor="border-blue-500/20"
                iconColor="text-blue-500"
                rows={insights.highest_speed_routes}
                columns={[
                  { key: "route_name", label: "Route" },
                  { key: "avg_speed", label: "Avg Speed" },
                  { key: "max_speed", label: "Max Speed" },
                ]}
              />
            </div>
          </section>
        )}
      </div>
    </RoleGate>
  )
}

function InsightCard({
  title,
  icon: Icon,
  borderColor,
  iconColor,
  rows,
  columns,
}: {
  title: string
  icon: typeof Flame
  borderColor: string
  iconColor: string
  rows: InsightRow[]
  columns: { key: string; label: string }[]
}) {
  return (
    <div className={`rounded-xl border bg-zinc-900 p-4 ${borderColor}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-600">Belum ada data.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col) => (
                <th key={col.key} scope="col" className="py-1 text-left font-medium text-zinc-500">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="py-1.5 text-zinc-300">
                    {String((row as Record<string, unknown>)[col.key] ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
