"use client"

import { useEffect, useMemo, useState } from "react"
import type { ElementType } from "react"
import { AlertTriangle, CheckCircle2, Clock, Download, Gauge, RefreshCw, Route, Satellite, WifiOff } from "lucide-react"
import { RoleGate } from "@/components/auth/role-gate"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiDownload, apiFetch } from "@/lib/api"

type TelemetryQualityLevel = "GOOD" | "WATCH" | "DEGRADED" | "CRITICAL"

type TelemetryQualityVehicle = {
  vehicle_id: string
  plate_no: string
  route_id: string
  route_name?: string | null
  owner_name?: string | null
  imei_or_serial?: string | null
  status?: string | null
  last_ping?: string | null
  minutes_since_last_ping?: number | null
  stale: boolean
  assignment_mismatch: boolean
  ping_count: number
  expected_ping_count: number
  missing_ping_count: number
  duplicate_timestamp_count: number
  drift_count: number
  tracking_valid_pct: number
  quality_score: number
  quality_level: TelemetryQualityLevel
}

type TelemetryQualityGroup = {
  route_id?: string
  route_name?: string
  device_id?: string
  imei_or_serial?: string
  total_vehicles: number
  stale_vehicles: number
  missing_ping_count: number
  drift_count: number
  duplicate_timestamp_count: number
  tracking_valid_pct: number
  quality_score: number
  quality_level: TelemetryQualityLevel
}

type TelemetryQualityReport = {
  window: {
    start: string
    end: string
    hours: number
    target_interval_sec: number
    stale_minutes: number
    drift_threshold_m: number
    expected_ping_count: number
  }
  summary: {
    total_vehicles: number
    stale_vehicles: number
    assignment_mismatch_vehicles: number
    missing_ping_count: number
    drift_count: number
    duplicate_timestamp_count: number
    tracking_valid_pct: number
    quality_score: number
    sla_target_pct: number
    sla_met: boolean
    rolling_rejections: {
      invalid_device_identity: number
      assignment_mismatch: number
      duplicate_payload: number
    }
  }
  items: TelemetryQualityVehicle[]
  by_route: TelemetryQualityGroup[]
  by_device: TelemetryQualityGroup[]
}

type RouteOption = {
  route_id: string
  name: string
}

type RoutesResponse = {
  items?: RouteOption[]
}

const levelStyles: Record<TelemetryQualityLevel, string> = {
  GOOD: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  WATCH: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  DEGRADED: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
  CRITICAL: "border-red-500/20 bg-red-500/10 text-red-300"
}

const levelLabel: Record<TelemetryQualityLevel, string> = {
  GOOD: "Baik",
  WATCH: "Pantau",
  DEGRADED: "Turun",
  CRITICAL: "Kritis"
}

const formatPct = (value: number | null | undefined) => `${Number(value || 0).toFixed(2)}%`

const formatDateTime = (value?: string | null) => {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}

export default function TelemetryQualityPage() {
  const [report, setReport] = useState<TelemetryQualityReport | null>(null)
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [routeId, setRouteId] = useState("")
  const [hours, setHours] = useState("1")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState("")

  const queryPath = useMemo(() => {
    const params = new URLSearchParams({ hours })
    if (routeId) params.set("route_id", routeId)
    return `/telemetry/quality?${params.toString()}`
  }, [hours, routeId])

  useEffect(() => {
    let active = true
    const loadRoutes = async () => {
      try {
        const data = await apiFetch<RoutesResponse>("/routes")
        if (active) setRoutes(data.items || [])
      } catch {
        if (active) setRoutes([])
      }
    }
    void loadRoutes()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      setError("")
      try {
        const data = await apiFetch<TelemetryQualityReport>(queryPath)
        if (active) setReport(data)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat kualitas GPS")
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [queryPath])

  const refresh = async () => {
    setRefreshing(true)
    setError("")
    try {
      const data = await apiFetch<TelemetryQualityReport>(queryPath)
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat kualitas GPS")
    } finally {
      setRefreshing(false)
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    setError("")
    try {
      const params = new URLSearchParams({ hours })
      if (routeId) params.set("route_id", routeId)
      await apiDownload(
        `/telemetry/quality/export?${params.toString()}`,
        `telemetry-quality-${routeId || "all"}-${hours}h.csv`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal export kualitas GPS")
    } finally {
      setExporting(false)
    }
  }

  return (
    <RoleGate feature="telemetry_quality" showDenied>
      <div className="space-y-6 p-6" data-tour="telemetry-quality-view">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Gauge className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Kualitas GPS</h1>
              <p className="text-sm text-muted-foreground">Validitas tracking, drift, stale, dan mismatch perangkat.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              aria-label="Filter window"
              className="h-9 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-200"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            >
              <option value="1">1 jam</option>
              <option value="6">6 jam</option>
              <option value="24">24 jam</option>
              <option value="720">30 hari</option>
            </select>
            <select
              aria-label="Filter trayek"
              className="h-9 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-200"
              value={routeId}
              onChange={(event) => setRouteId(event.target.value)}
            >
              <option value="">Semua trayek</option>
              {routes.map((route) => (
                <option key={route.route_id} value={route.route_id}>{route.name || route.route_id}</option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <RoleGate feature="export_data">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={exporting || !report}>
                <Download className="h-4 w-4" />
                {exporting ? "Mengekspor..." : "Export CSV"}
              </Button>
            </RoleGate>
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {report && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricBlock
                icon={report.summary.sla_met ? CheckCircle2 : AlertTriangle}
                label="Tracking Valid"
                value={formatPct(report.summary.tracking_valid_pct)}
                detail={`Target ${formatPct(report.summary.sla_target_pct)}`}
                tone={report.summary.sla_met ? "emerald" : "red"}
              />
              <MetricBlock
                icon={WifiOff}
                label="Stale"
                value={String(report.summary.stale_vehicles)}
                detail={`${report.summary.total_vehicles} armada`}
                tone={report.summary.stale_vehicles ? "yellow" : "zinc"}
              />
              <MetricBlock
                icon={Satellite}
                label="GPS Drift"
                value={String(report.summary.drift_count)}
                detail={`>${report.window.drift_threshold_m} m atau low confidence`}
                tone={report.summary.drift_count ? "yellow" : "zinc"}
              />
              <MetricBlock
                icon={Clock}
                label="Missing Ping"
                value={String(report.summary.missing_ping_count)}
                detail={`${report.window.target_interval_sec} detik target`}
                tone={report.summary.missing_ping_count ? "red" : "emerald"}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <section className="rounded-xl border border-white/10 bg-zinc-900/30 xl:col-span-2">
                <div className="flex flex-col gap-2 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold">Kendaraan Prioritas</h2>
                    <p className="mt-1 text-xs text-zinc-500">Window {formatDateTime(report.window.start)} - {formatDateTime(report.window.end)}</p>
                  </div>
                  <span className={`w-fit rounded-md border px-2 py-1 text-xs ${levelStyles[report.summary.sla_met ? "GOOD" : "CRITICAL"]}`}>
                    SLA {report.summary.sla_met ? "terpenuhi" : "belum terpenuhi"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-5 py-3">Armada</th>
                        <th className="px-5 py-3">Trayek</th>
                        <th className="px-5 py-3">Device</th>
                        <th className="px-5 py-3">Valid</th>
                        <th className="px-5 py-3">Missing</th>
                        <th className="px-5 py-3">Drift</th>
                        <th className="px-5 py-3">Last Ping</th>
                        <th className="px-5 py-3">Skor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {report.items.map((item) => (
                        <tr key={item.vehicle_id}>
                          <td className="px-5 py-3">
                            <div className="font-medium text-white">{item.plate_no}</div>
                            <div className="text-xs text-zinc-500">{item.owner_name || "-"}</div>
                          </td>
                          <td className="px-5 py-3 text-zinc-300">{item.route_id}</td>
                          <td className="px-5 py-3 text-zinc-400">{item.imei_or_serial || "Tanpa device aktif"}</td>
                          <td className="px-5 py-3 font-mono text-zinc-200">{formatPct(item.tracking_valid_pct)}</td>
                          <td className="px-5 py-3 font-mono text-zinc-200">{item.missing_ping_count}</td>
                          <td className="px-5 py-3 font-mono text-zinc-200">{item.drift_count}</td>
                          <td className="px-5 py-3 text-zinc-400">{formatDateTime(item.last_ping)}</td>
                          <td className="px-5 py-3">
                            <span className={`rounded-md border px-2 py-1 text-xs ${levelStyles[item.quality_level]}`}>
                              {item.quality_score} · {levelLabel[item.quality_level]}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {report.items.length === 0 && (
                        <tr>
                          <td className="px-5 py-6 text-sm text-zinc-500" colSpan={8}>Tidak ada armada pada filter ini.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-xl border border-white/10 bg-zinc-900/30">
                <div className="border-b border-white/10 px-5 py-4">
                  <h2 className="font-semibold">Rejection Rolling</h2>
                </div>
                <div className="divide-y divide-white/5">
                  <CompactRow label="Invalid identity" value={report.summary.rolling_rejections.invalid_device_identity} />
                  <CompactRow label="Assignment mismatch" value={report.summary.rolling_rejections.assignment_mismatch + report.summary.assignment_mismatch_vehicles} />
                  <CompactRow label="Duplicate payload" value={report.summary.rolling_rejections.duplicate_payload + report.summary.duplicate_timestamp_count} />
                </div>
              </section>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <GroupPanel icon={Route} title="Agregasi Trayek" groups={report.by_route} groupKey="route" />
              <GroupPanel icon={Satellite} title="Agregasi Device" groups={report.by_device} groupKey="device" />
            </div>
          </>
        )}
      </div>
    </RoleGate>
  )
}

function MetricBlock({ icon: Icon, label, value, detail, tone }: { icon: ElementType, label: string, value: string, detail: string, tone: "emerald" | "red" | "yellow" | "zinc" }) {
  const toneClass = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    yellow: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
    zinc: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300"
  }[tone]

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span className={`rounded-md border p-1 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <div className="mt-3 text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{detail}</div>
    </div>
  )
}

function CompactRow({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-white">{value}</span>
    </div>
  )
}

function GroupPanel({ icon: Icon, title, groups, groupKey }: { icon: ElementType, title: string, groups: TelemetryQualityGroup[], groupKey: "route" | "device" }) {
  return (
    <section className="rounded-xl border border-white/10 bg-zinc-900/30">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
        <Icon className="h-4 w-4 text-zinc-400" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-white/5">
        {groups.map((group) => {
          const id = groupKey === "route" ? group.route_id : group.device_id
          const name = groupKey === "route" ? group.route_name : group.imei_or_serial
          return (
            <div key={id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{name || id}</div>
                  <div className="mt-1 text-xs text-zinc-500">{group.total_vehicles} armada · {group.stale_vehicles} stale</div>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-1 text-xs ${levelStyles[group.quality_level]}`}>
                  {group.quality_score}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-zinc-950/70 p-2">
                  <div className="text-zinc-500">Valid</div>
                  <div className="mt-1 font-mono text-zinc-200">{formatPct(group.tracking_valid_pct)}</div>
                </div>
                <div className="rounded-md bg-zinc-950/70 p-2">
                  <div className="text-zinc-500">Missing</div>
                  <div className="mt-1 font-mono text-zinc-200">{group.missing_ping_count}</div>
                </div>
                <div className="rounded-md bg-zinc-950/70 p-2">
                  <div className="text-zinc-500">Drift</div>
                  <div className="mt-1 font-mono text-zinc-200">{group.drift_count}</div>
                </div>
              </div>
            </div>
          )
        })}
        {groups.length === 0 && (
          <div className="px-5 py-6 text-sm text-zinc-500">Belum ada data.</div>
        )}
      </div>
    </section>
  )
}
