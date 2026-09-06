"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch, apiUrl } from "@/lib/api"
import { cn } from "@/lib/utils"
import { AlertTriangle, Bot, CheckCircle2, Eye, MapPin, RefreshCw, ShieldCheck, XCircle } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PUBLIC_REPORT_STATUS_LABEL, label } from "@/lib/labels"

type PublicReport = {
  public_report_id: string
  reporter_name?: string | null
  vehicle_id?: string | null
  incident_id?: string | null
  route_id?: string | null
  plate_no: string
  category: string
  status: string
  plate_match_status: string
  description: string
  lat: number
  lon: number
  accuracy_m?: number | null
  reported_at: string
  vehicle_last_lat?: number | null
  vehicle_last_lon?: number | null
  vehicle_last_seen_at?: string | null
  distance_to_vehicle_m?: number | null
  route_name?: string | null
  latest_speed_kmh?: number | null
  active_anomaly?: string | null
  active_alert?: string | null
  attachment_count: number
  review_notes?: string | null
  latest_review?: PublicReportReview | null
}

type PublicReportReview = {
  review_id: string
  verdict: "CONFIRMED" | "LIKELY" | "INCONCLUSIVE" | "REJECT_SUSPECTED_SPAM"
  confidence_score: number
  reason_summary: string
  evidence_snapshot?: {
    monitoring?: {
      latest_vehicle?: {
        distance_to_reporter_m?: number | null
        speed_kmh?: number | null
        ts?: string | null
      } | null
      telemetry_window?: {
        point_count?: number
        avg_speed_kmh?: number | null
        max_speed_kmh?: number | null
        overspeed_points?: number
        low_speed_duration_minutes?: number
      }
      route_context?: {
        is_near_official_stop?: boolean
        nearest_stop?: {
          name?: string
          distance_m?: number
        } | null
      }
      matched_anomaly?: {
        rule?: string
        severity?: string
        status?: string
      } | null
      matched_alert?: {
        rule?: string
        severity?: string
        status?: string
      } | null
    }
  } | null
  ai_summary?: {
    summary?: string
    confidence_explanation?: string
    description_classification?: string
    planned_ocr?: {
      status?: string
      note?: string
    }
  } | null
  matched_anomaly_id?: string | null
  matched_alert_id?: string | null
  matched_incident_id?: string | null
  auto_escalated: boolean
  created_at: string
}

type PublicReportAttachment = {
  attachment_id: string
  content_type: string
  file_size_bytes: number
  checksum_sha256?: string | null
  original_filename?: string | null
  uploaded_at: string
  download_url: string
}

type PublicReportAction = {
  action_id: string
  action: string
  notes?: string | null
  created_at: string
  actor_name?: string | null
}

type ListResponse = {
  items?: PublicReport[]
}

type DetailResponse = {
  report: PublicReport
  attachments: PublicReportAttachment[]
  actions: PublicReportAction[]
}

const statusOptions = ["ALL", "PENDING_REVIEW", "ACKNOWLEDGED", "REJECTED", "ESCALATED_TO_INCIDENT", "RESOLVED"]

const statusVariant = (status: string) => {
  if (status === "PENDING_REVIEW") return "default"
  if (status === "ESCALATED_TO_INCIDENT") return "destructive"
  if (status === "RESOLVED") return "secondary"
  return "outline"
}

const verdictVariant = (verdict?: string) => {
  if (verdict === "CONFIRMED") return "default"
  if (verdict === "LIKELY") return "secondary"
  if (verdict === "REJECT_SUSPECTED_SPAM") return "destructive"
  return "outline"
}

const formatDate = (value?: string | null) => {
  if (!value) return "-"
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value))
}

const formatDistance = (value?: number | null) => {
  if (typeof value !== "number") return "Belum tersedia"
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km`
  return `${Math.round(value)} m`
}

export default function PublicReportsPage() {
  const [items, setItems] = useState<PublicReport[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [statusFilter, setStatusFilter] = useState("PENDING_REVIEW")
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [acting, setActing] = useState("")
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState("")

  const selectedReport = useMemo(
    () => items.find((item) => item.public_report_id === selectedId) || null,
    [items, selectedId]
  )

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "ALL") params.set("status", statusFilter)
      const data = await apiFetch<ListResponse>(`/operator/public-reports${params.toString() ? `?${params.toString()}` : ""}`)
      const nextItems = data.items || []
      setItems(nextItems)
      setSelectedId((current) => current || nextItems[0]?.public_report_id || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat public reports")
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setError("")
    try {
      const data = await apiFetch<DetailResponse>(`/operator/public-reports/${id}`)
      setDetail(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail public report")
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
  }, [loadDetail, selectedId])

  const submitAction = async (action: string) => {
    if (!selectedId) return
    setActing(action)
    setError("")
    try {
      await apiFetch(`/operator/public-reports/${selectedId}/actions`, {
        method: "POST",
        body: JSON.stringify({ action })
      })
      await loadReports()
      await loadDetail(selectedId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui public report")
    } finally {
      setActing("")
    }
  }

  const runAutomation = async () => {
    setReviewing(true)
    setError("")
    try {
      await apiFetch("/operator/public-reports/reviews/run", {
        method: "POST",
        body: JSON.stringify({ limit: 50 })
      })
      await loadReports()
      if (selectedId) await loadDetail(selectedId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menjalankan automated review")
    } finally {
      setReviewing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between" data-tour="public-report-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Public Reports</h1>
          <p className="text-muted-foreground">Review laporan masyarakat, bukti foto, lokasi pelapor, dan konteks GPS kendaraan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void runAutomation()} disabled={reviewing}>
            <Bot className="h-4 w-4" />
            {reviewing ? "Reviewing..." : "Run automation"}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void loadReports()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Gagal memproses laporan</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {statusOptions.map((status) => (
          <Button
            key={status}
            variant={status === statusFilter ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSelectedId(null)
              setDetail(null)
              setStatusFilter(status)
            }}
          >
            {label(PUBLIC_REPORT_STATUS_LABEL, status)}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(480px,1.4fr)]">
        <Card data-tour="public-report-queue">
          <CardHeader>
            <CardTitle>Antrean Review</CardTitle>
            <CardDescription>Laporan terbaru dari mobile app masyarakat.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-lg" />)
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Belum ada laporan untuk filter ini.</div>
            ) : (
              items.map((item) => (
                <button
                  key={item.public_report_id}
                  className={cn(
                    "w-full rounded-lg border p-4 text-left transition hover:border-emerald-500/60 hover:bg-emerald-500/5",
                    selectedId === item.public_report_id ? "border-emerald-500 bg-emerald-500/10" : "border-border"
                  )}
                  onClick={() => setSelectedId(item.public_report_id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{item.plate_no}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{item.category.replaceAll("_", " ")}</div>
                    </div>
                    <Badge variant={statusVariant(item.status)}>{item.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>{formatDate(item.reported_at)}</span>
                    <span>{item.plate_match_status.replaceAll("_", " ")}</span>
                    <span>{item.attachment_count} attachment</span>
                    <span>{formatDistance(item.distance_to_vehicle_m)}</span>
                  </div>
                  {item.latest_review ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={verdictVariant(item.latest_review.verdict)}>
                        {item.latest_review.verdict.replaceAll("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Confidence {Math.round(item.latest_review.confidence_score * 100)}%
                      </span>
                    </div>
                  ) : null}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <ReportDetail
          detail={detail}
          fallbackReport={selectedReport}
          loading={detailLoading}
          acting={acting}
          onAction={(action) => void submitAction(action)}
        />
      </div>
    </div>
  )
}

function ReportDetail({
  detail,
  fallbackReport,
  loading,
  acting,
  onAction
}: {
  detail: DetailResponse | null
  fallbackReport: PublicReport | null
  loading: boolean
  acting: string
  onAction: (action: string) => void
}) {
  const report = detail?.report || fallbackReport

  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detail Laporan</CardTitle>
          <CardDescription>Pilih laporan dari antrean untuk membuka detail.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Tidak ada laporan yang dipilih.</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-tour="public-report-evidence">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>{report.plate_no}</CardTitle>
            <CardDescription>{report.category.replaceAll("_", " ")} dilaporkan {formatDate(report.reported_at)}</CardDescription>
          </div>
          <Badge variant={statusVariant(report.status)}>{label(PUBLIC_REPORT_STATUS_LABEL, report.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? <Skeleton className="h-40 rounded-lg" /> : null}

        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Match plat" value={report.plate_match_status.replaceAll("_", " ")} />
          <Metric label="Jarak pelapor" value={formatDistance(report.distance_to_vehicle_m)} />
          <Metric label="Route" value={report.route_name || report.route_id || "Belum match"} />
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Konteks monitoring</AlertTitle>
          <AlertDescription>
            Speed terakhir {typeof report.latest_speed_kmh === "number" ? `${report.latest_speed_kmh.toFixed(1)} km/jam` : "belum tersedia"}.
            {" "}Anomaly aktif: {report.active_anomaly || "tidak ada"}. Alert aktif: {report.active_alert || "tidak ada"}.
          </AlertDescription>
        </Alert>

        <AutomatedReviewPanel review={report.latest_review || null} />

        <div className="space-y-2">
          <div className="text-sm font-semibold">Deskripsi warga</div>
          <p className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">{report.description}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <LocationBox title="Lokasi pelapor" lat={report.lat} lon={report.lon} href={`https://www.google.com/maps?q=${report.lat},${report.lon}`} />
          <LocationBox title="GPS terakhir kendaraan" lat={report.vehicle_last_lat} lon={report.vehicle_last_lon} timestamp={report.vehicle_last_seen_at} href={report.vehicle_id ? `/dashboard/vehicles/${report.vehicle_id}` : undefined} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Eye className="h-4 w-4" />
            Bukti Foto
          </div>
          {detail?.attachments?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {detail.attachments.map((attachment) => (
                <div key={attachment.attachment_id} className="overflow-hidden rounded-lg border bg-muted/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={apiUrl(attachment.download_url)}
                    alt={attachment.original_filename || "Bukti laporan masyarakat"}
                    className="aspect-video w-full object-cover"
                  />
                  <div className="p-3 text-xs text-muted-foreground">
                    {attachment.content_type} · {(attachment.file_size_bytes / 1024).toFixed(1)} KB
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Attachment belum dimuat.</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-2" disabled={Boolean(acting)} onClick={() => onAction("ACKNOWLEDGE")}>
            <CheckCircle2 className="h-4 w-4" />
            {acting === "ACKNOWLEDGE" ? "Memproses..." : "Terima"}
          </Button>
          <Button size="sm" variant="glow" className="gap-2" disabled={Boolean(acting)} onClick={() => onAction("ESCALATE_TO_INCIDENT")}>
            <AlertTriangle className="h-4 w-4" />
            {acting === "ESCALATE_TO_INCIDENT" ? "Memproses..." : "Eskalasi"}
          </Button>
          <Button size="sm" variant="outline" disabled={Boolean(acting)} onClick={() => onAction("RESOLVE")}>Resolve</Button>
          <Button size="sm" variant="outline" className="gap-2 text-red-500" disabled={Boolean(acting)} onClick={() => onAction("REJECT")}>
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        </div>

        {detail?.actions?.length ? (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Riwayat tindakan</div>
            {detail.actions.map((action) => (
              <div key={action.action_id} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{action.action.replaceAll("_", " ")}</div>
                <div className="text-xs text-muted-foreground">{action.actor_name || "Petugas"} · {formatDate(action.created_at)}</div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AutomatedReviewPanel({ review }: { review: PublicReportReview | null }) {
  const monitoring = review?.evidence_snapshot?.monitoring
  const telemetry = monitoring?.telemetry_window
  const routeContext = monitoring?.route_context

  if (!review) {
    return (
      <Alert>
        <Bot className="h-4 w-4" />
        <AlertTitle>Automated review belum tersedia</AlertTitle>
        <AlertDescription>Jalankan automation untuk menghasilkan verdict, confidence, dan evidence monitoring.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="h-4 w-4 text-emerald-500" />
            Automated Review
          </div>
          <p className="text-sm text-muted-foreground">{review.reason_summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={verdictVariant(review.verdict)}>{review.verdict.replaceAll("_", " ")}</Badge>
          <Badge variant="outline">{Math.round(review.confidence_score * 100)}%</Badge>
          {review.auto_escalated ? <Badge variant="destructive">Auto escalated</Badge> : null}
        </div>
      </div>

      {review.ai_summary?.summary ? (
        <Alert>
          <Bot className="h-4 w-4" />
          <AlertTitle>Ringkasan otomatis (rules-assisted)</AlertTitle>
          <AlertDescription>
            {review.ai_summary.summary} {review.ai_summary.confidence_explanation}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Telemetry points" value={String(telemetry?.point_count ?? 0)} />
        <Metric label="Avg speed" value={typeof telemetry?.avg_speed_kmh === "number" ? `${telemetry.avg_speed_kmh.toFixed(1)} km/jam` : "-"} />
        <Metric label="Overspeed points" value={String(telemetry?.overspeed_points ?? 0)} />
        <Metric label="Low speed duration" value={`${telemetry?.low_speed_duration_minutes ?? 0} menit`} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Anomaly match" value={monitoring?.matched_anomaly?.rule || "Tidak ada"} />
        <Metric label="Alert match" value={monitoring?.matched_alert?.rule || "Tidak ada"} />
        <Metric
          label="Official stop context"
          value={routeContext?.is_near_official_stop ? (routeContext.nearest_stop?.name || "Dekat stop/geofence") : "Di luar stop resmi"}
        />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  )
}

function LocationBox({ title, lat, lon, timestamp, href }: { title: string; lat?: number | null; lon?: number | null; timestamp?: string | null; href?: string }) {
  const hasCoords = typeof lat === "number" && typeof lon === "number"
  const inner = (
    <div className={cn("rounded-lg border bg-muted/20 p-3", href && hasCoords && "cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors")}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MapPin className="h-4 w-4 text-emerald-500" />
        {title}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">
        {hasCoords ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : "Belum tersedia"}
      </div>
      {timestamp ? <div className="mt-1 text-xs text-muted-foreground">{formatDate(timestamp)}</div> : null}
    </div>
  )
  if (href && hasCoords) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
  }
  return inner
}
