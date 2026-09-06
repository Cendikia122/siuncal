"use client"

import { useEffect, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, Clock, Database, RadioTower, Server, XCircle } from "lucide-react"
import { RoleGate } from "@/components/auth/role-gate"
import { apiFetch } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { SERVICE_STATUS_LABEL, label } from "@/lib/labels"

type ServiceStatus = {
  service: string
  status: "OK" | "DEGRADED" | "ERROR" | "UNKNOWN"
  checked_at?: string
  response_ms?: number
  message?: string
}

type TelemetryBucket = {
  minute: string
  count: number
}

type JobStatus = {
  job: string
  status: "OK" | "DEGRADED" | "ERROR" | "UNKNOWN"
  message?: string
}

type UploadMetrics = {
  public_report_invalid_image_rejections: number
  public_report_invalid_image_rejection_window_hours?: number
  public_report_invalid_image_rejection_warning_threshold?: number
  public_report_invalid_image_rejection_error_threshold?: number
  public_report_invalid_image_rejection_status?: ServiceStatus["status"]
}

type ObservabilitySummary = {
  checked_at: string
  services: ServiceStatus[]
  telemetry_per_minute: TelemetryBucket[]
  last_successful_report_daily?: string | null
  active_counts: {
    active_anomalies: number
    active_alerts: number
    active_incidents: number
  }
  upload_metrics?: UploadMetrics
  job_errors: JobStatus[]
}

const statusStyles: Record<ServiceStatus["status"], string> = {
  OK: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  DEGRADED: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
  ERROR: "border-red-500/20 bg-red-500/10 text-red-300",
  UNKNOWN: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300"
}

const statusIcons = {
  OK: CheckCircle2,
  DEGRADED: AlertTriangle,
  ERROR: XCircle,
  UNKNOWN: Clock
}

export default function ObservabilityPage() {
  const [summary, setSummary] = useState<ObservabilitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const uploadMetric = summary?.upload_metrics
  const uploadValidationStatus = uploadMetric?.public_report_invalid_image_rejection_status || "OK"
  const showUploadValidationAlert = uploadValidationStatus === "DEGRADED" || uploadValidationStatus === "ERROR"

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const data = await apiFetch<ObservabilitySummary>("/observability/summary")
        if (!active) return
        setSummary(data)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Gagal memuat observability")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <RoleGate roles="ANALISA" showDenied>
      <div className="p-6 space-y-6" data-tour="observability-view">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-500/10 p-2">
              <Activity className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Observabilitas Sistem</h1>
              <p className="text-sm text-muted-foreground">
                Ringkasan kesehatan service, aliran telemetri, dan status job operasional.
              </p>
            </div>
          </div>
          {showUploadValidationAlert && uploadMetric && (
            <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${statusStyles[uploadValidationStatus]}`}>
              <AlertTriangle className="h-4 w-4" />
              <span>
                Upload validation {label(SERVICE_STATUS_LABEL, uploadValidationStatus)}: {uploadMetric.public_report_invalid_image_rejections} invalid image/{uploadMetric.public_report_invalid_image_rejection_window_hours || 24} jam
              </span>
            </div>
          )}
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <Skeleton key={item} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
            {error}
          </div>
        )}

        {summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricBlock icon={RadioTower} label="Telemetry/min" value={String(summary.telemetry_per_minute[0]?.count || 0)} />
              <MetricBlock icon={AlertTriangle} label="Anomaly aktif" value={String(summary.active_counts.active_anomalies)} />
              <MetricBlock icon={Activity} label="Alert aktif" value={String(summary.active_counts.active_alerts)} />
              <MetricBlock icon={Server} label="Incident aktif" value={String(summary.active_counts.active_incidents)} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <section className="xl:col-span-2 rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <h2 className="font-semibold">Status Layanan</h2>
                </div>
                <div className="divide-y divide-white/5">
                  {summary.services.map((service) => (
                    <StatusRow key={service.service} status={service} />
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-white/10 bg-zinc-900/30 p-5 space-y-4">
                <div>
                  <h2 className="font-semibold">Report Harian</h2>
                  <p className="text-xs text-zinc-500 mt-1">Last successful report:daily</p>
                </div>
                <div className="text-2xl font-bold text-white">
                  {summary.last_successful_report_daily
                    ? new Date(summary.last_successful_report_daily).toLocaleDateString()
                    : "-"}
                </div>
                <div className="text-xs text-zinc-500">
                  Checked {new Date(summary.checked_at).toLocaleString()}
                </div>
              </section>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <section className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <h2 className="font-semibold">Telemetry 15 Menit Terakhir</h2>
                </div>
                <div className="divide-y divide-white/5">
                  {summary.telemetry_per_minute.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-zinc-500">Belum ada telemetry terbaru.</div>
                  ) : (
                    summary.telemetry_per_minute.map((bucket) => (
                      <div key={bucket.minute} className="px-5 py-3 flex items-center justify-between text-sm">
                        <span className="text-zinc-400">{new Date(bucket.minute).toLocaleTimeString()}</span>
                        <span className="font-mono text-white">{bucket.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <h2 className="font-semibold">Gangguan Layanan / Job</h2>
                </div>
                <div className="divide-y divide-white/5">
                  {summary.job_errors.map((job) => (
                    <StatusRow
                      key={job.job}
                      status={{ service: job.job, status: job.status, message: job.message }}
                    />
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </RoleGate>
  )
}

function MetricBlock({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function StatusRow({ status }: { status: ServiceStatus }) {
  const Icon = statusIcons[status.status]
  return (
    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${statusStyles[status.status]}`}>
          {status.service === "db" ? <Database className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
        </div>
        <div>
          <div className="font-medium text-white">{status.service.replaceAll("_", " ")}</div>
          <div className="text-xs text-zinc-500">{status.message || "-"}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {status.response_ms !== undefined && <span className="text-xs text-zinc-500">{status.response_ms}ms</span>}
        <span className={`text-xs px-2 py-1 rounded-md border ${statusStyles[status.status]}`}>
          {label(SERVICE_STATUS_LABEL, status.status)}
        </span>
      </div>
    </div>
  )
}
