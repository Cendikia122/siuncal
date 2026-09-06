"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { use, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Pause, Play, Gauge, MapPin, AlertTriangle, Clock, Save, Gavel } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { apiFetch } from "@/lib/api"
import { VEHICLE_STATUS_LABEL, INCIDENT_TYPE_LABEL, INCIDENT_STATUS_LABEL, label } from "@/lib/labels"
import { RiskBadge } from "@/components/ui/risk-badge"
import { RISK_LEVEL_BAR_COLORS, SEVERITY_ICON_COLORS, INCIDENT_STATUS_COLORS, STATUS_MUTED } from "@/lib/status-colors"

const MapView = dynamic(() => import("@/components/map/map-view"), { ssr: false })

type PlaybackPoint = {
  ts: string
  lat: number
  lon: number
  speed?: number
  heading?: number
  status?: string
  match_provider?: string | null
  match_status?: "MATCHED" | "LOW_CONFIDENCE" | "NO_ROUTE" | null
  road_segment?: string | null
  match_confidence?: number | null
  snapped_lat?: number | null
  snapped_lon?: number | null
  snap_distance_m?: number | null
  distance_along_route_m?: number | null
  matched_heading?: number | null
}

type VehicleDetail = {
  vehicle_id: string
  plate_no: string
  status?: string | null
  vehicle_code?: string | null
  brand?: string | null
  model?: string | null
  year?: number | null
  color?: string | null
  capacity?: number | null
  route_id?: string | null
  owner_name?: string | null
  owner_type?: string | null
  phone_primary?: string | null
  last_ping?: string | null
  risk_score?: number | null
  risk_level?: string | null
  active_sanction_count?: number
}

type VehicleDocument = {
  document_id: string
  doc_type: string
  file_url?: string | null
  expiry_date?: string | null
}

type VehicleAssignment = {
  driver_name?: string | null
  driver_phone?: string | null
  device_serial?: string | null
  imei_or_serial?: string | null
  shift_name?: string | null
  shift_start?: string | null
  shift_end?: string | null
}

type VehicleIncident = {
  incident_id: string
  type: string
  severity: string
  status: string
  description?: string | null
  location_desc?: string | null
  created_at: string
  resolved_at?: string | null
}

type PlaybackEvent = {
  event_id: string
  type: string
  severity: string
  status: string
  description?: string | null
  location_desc?: string | null
  ts_start: string
  ts_end?: string | null
}

type PlaybackRecord = {
  record_id: string
  start: string
  end: string
  point_count: number
  event_count: number
  storage_bucket: string
  storage_key: string
  object_url?: string | null
  byte_size?: number | null
  created_at: string
}

type VehicleDetailResponse = {
  vehicle: VehicleDetail
  documents?: VehicleDocument[]
  assignment?: VehicleAssignment | null
}

type PlaybackResponse = {
  positions?: PlaybackPoint[]
  events?: PlaybackEvent[]
  start?: string
  end?: string
  limit?: number
  truncated?: boolean
}

type VehicleIncidentsResponse = {
  items?: VehicleIncident[]
}

type PlaybackRecordsResponse = {
  items?: PlaybackRecord[]
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params)
  const id = unwrappedParams.id

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null)
  const [documents, setDocuments] = useState<VehicleDocument[]>([])
  const [assignment, setAssignment] = useState<VehicleAssignment | null>(null)
  const [incidents, setIncidents] = useState<VehicleIncident[]>([])
  const [playbackEvents, setPlaybackEvents] = useState<PlaybackEvent[]>([])
  const [playbackRecords, setPlaybackRecords] = useState<PlaybackRecord[]>([])
  const [positions, setPositions] = useState<PlaybackPoint[]>([])
  const [rawPositions, setRawPositions] = useState<PlaybackPoint[]>([])
  const [playbackTruncated, setPlaybackTruncated] = useState(false)
  const [playIndex, setPlayIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [start, setStart] = useState(() => toLocalDateTime(new Date(Date.now() - 2 * 60 * 60 * 1000)))
  const [end, setEnd] = useState(() => toLocalDateTime(new Date()))
  const [rangePreset, setRangePreset] = useState<"1H" | "2H" | "TODAY" | "CUSTOM">("2H")
  const [playbackMode, setPlaybackMode] = useState<"MATCHED" | "RAW">("MATCHED")
  const [smoothEnabled, setSmoothEnabled] = useState(true)
  const [activeTab, setActiveTab] = useState<"POSISI" | "VEHICLE" | "OWNER" | "SHIFT">("POSISI")
  const [loading, setLoading] = useState(true)
  const [savingRecord, setSavingRecord] = useState(false)
  const [error, setError] = useState("")

  const currentPosition = positions[playIndex]

  const matchedPointCount = useMemo(
    () => rawPositions.filter((point) => isMatchedPlaybackPoint(point)).length,
    [rawPositions]
  )

  const historyPath = useMemo(() => {
    if (!positions.length) return []
    return positions.slice(0, playIndex + 1).map((point) => [point.lat, point.lon] as [number, number])
  }, [playIndex, positions])

  const loadVehicle = async () => {
    const data = await apiFetch<VehicleDetailResponse>(`/vehicles/${id}`)
    setVehicle(data.vehicle)
    setDocuments(data.documents || [])
    setAssignment(data.assignment || null)
  }

  const loadPlayback = async () => {
    const params = new URLSearchParams({
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      limit: "5000"
    })
    const data = await apiFetch<PlaybackResponse>(`/vehicles/${id}/playback?${params.toString()}`)
    const mapped = (data.positions || []).map((item) => ({
      ...item,
      lat: Number(item.lat),
      lon: Number(item.lon),
      snapped_lat: item.snapped_lat === null || item.snapped_lat === undefined ? null : Number(item.snapped_lat),
      snapped_lon: item.snapped_lon === null || item.snapped_lon === undefined ? null : Number(item.snapped_lon),
      snap_distance_m: item.snap_distance_m === null || item.snap_distance_m === undefined ? null : Number(item.snap_distance_m),
      distance_along_route_m: item.distance_along_route_m === null || item.distance_along_route_m === undefined ? null : Number(item.distance_along_route_m),
      matched_heading: item.matched_heading === null || item.matched_heading === undefined ? null : Number(item.matched_heading),
      match_confidence: item.match_confidence === null || item.match_confidence === undefined ? null : Number(item.match_confidence)
    }))
    setRawPositions(mapped)
    setPlaybackEvents(data.events || [])
    setPlaybackTruncated(Boolean(data.truncated))
    setPositions(projectPlaybackTrack(mapped, playbackMode, smoothEnabled))
    setPlayIndex(0)
    setIsPlaying(false)
  }

  const loadPlaybackRecords = async () => {
    const data = await apiFetch<PlaybackRecordsResponse>(`/vehicles/${id}/playback/records?limit=5`)
    setPlaybackRecords(data.items || [])
  }

  const loadPlaybackFromRecord = async (record: PlaybackRecord) => {
    setError("")
    setStart(toLocalDateTime(new Date(record.start)))
    setEnd(toLocalDateTime(new Date(record.end)))
    setRangePreset("CUSTOM")
    
    try {
      const params = new URLSearchParams({
        start: record.start,
        end: record.end,
        limit: "5000"
      })
      const data = await apiFetch<PlaybackResponse>(`/vehicles/${id}/playback?${params.toString()}`)
      const mapped = (data.positions || []).map((item) => ({
        ...item,
        lat: Number(item.lat),
        lon: Number(item.lon),
        snapped_lat: item.snapped_lat === null || item.snapped_lat === undefined ? null : Number(item.snapped_lat),
        snapped_lon: item.snapped_lon === null || item.snapped_lon === undefined ? null : Number(item.snapped_lon),
        snap_distance_m: item.snap_distance_m === null || item.snap_distance_m === undefined ? null : Number(item.snap_distance_m),
        distance_along_route_m: item.distance_along_route_m === null || item.distance_along_route_m === undefined ? null : Number(item.distance_along_route_m),
        matched_heading: item.matched_heading === null || item.matched_heading === undefined ? null : Number(item.matched_heading),
        match_confidence: item.match_confidence === null || item.match_confidence === undefined ? null : Number(item.match_confidence)
      }))
      setRawPositions(mapped)
      setPlaybackEvents(data.events || [])
      setPlaybackTruncated(Boolean(data.truncated))
      setPositions(projectPlaybackTrack(mapped, playbackMode, smoothEnabled))
      setPlayIndex(0)
      if (mapped.length > 0) {
        setIsPlaying(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat playback dari record")
    }
  }

  const applyRangePreset = (preset: "1H" | "2H" | "TODAY") => {
    const now = new Date()
    const nextStart = new Date(now)
    if (preset === "1H") {
      nextStart.setHours(now.getHours() - 1)
    } else if (preset === "2H") {
      nextStart.setHours(now.getHours() - 2)
    } else {
      nextStart.setHours(0, 0, 0, 0)
    }
    setRangePreset(preset)
    setStart(toLocalDateTime(nextStart))
    setEnd(toLocalDateTime(now))
  }

  const handleSavePlaybackRecord = async () => {
    setError("")
    setSavingRecord(true)
    try {
      await apiFetch(`/vehicles/${id}/playback/records`, {
        method: "POST",
        body: JSON.stringify({
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          limit: 5000
        })
      })
      await loadPlaybackRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan record playback")
    } finally {
      setSavingRecord(false)
    }
  }

  useEffect(() => {
    setPositions(projectPlaybackTrack(rawPositions, playbackMode, smoothEnabled))
  }, [rawPositions, playbackMode, smoothEnabled])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        await loadVehicle()
        await loadPlayback()
        try {
          await loadPlaybackRecords()
        } catch {
          // Playback records require the latest migration and are not critical for viewing telemetry.
        }
        // Load incidents
        try {
          const incidentsData = await apiFetch<VehicleIncidentsResponse>(`/vehicles/${id}/incidents`)
          if (active) setIncidents(incidentsData.items || [])
        } catch {
          // Incidents load failure is not critical
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Gagal memuat data kendaraan")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!isPlaying || positions.length === 0) return
    const interval = window.setInterval(() => {
      setPlayIndex((prev) => {
        if (prev >= positions.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, Math.max(200, 1000 / speed))

    return () => window.clearInterval(interval)
  }, [isPlaying, positions.length, speed])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/vehicles">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Detail Armada</h1>
          <p className="text-muted-foreground">Playback dan riwayat perjalanan kendaraan.</p>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Memuat data kendaraan...</div>}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
          {error}
        </div>
      )}

      {vehicle && vehicle.active_sanction_count != null && vehicle.active_sanction_count > 0 && (
        <Link href={`/dashboard/sanctions?vehicle_id=${vehicle.vehicle_id}`} className="flex items-center gap-3 p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors">
          <Gavel className="w-4 h-4 text-yellow-400" />
          <span className="text-sm text-yellow-300 font-medium">Kendaraan ini memiliki {vehicle.active_sanction_count} sanksi aktif</span>
        </Link>
      )}

      {vehicle && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden h-[420px]">
              <MapView
                markers={
                  currentPosition
                    ? [
                      {
                        id: vehicle.vehicle_id,
                        lat: currentPosition.lat,
                        lng: currentPosition.lon,
                        title: vehicle.plate_no,
                        status: currentPosition.status ?? vehicle.status ?? undefined,
                        heading: currentPosition.matched_heading ?? currentPosition.heading ?? undefined,
                        type: "VEHICLE"
                      }
                    ]
                    : []
                }
                historyPath={historyPath}
              />
            </div>

            <div className="bg-card/50 border border-border rounded-xl p-6 space-y-4" data-tour="vehicle-playback">
              <h3 className="font-semibold text-lg">Playback Kontrol</h3>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: "1H", label: "1 jam" },
                  { key: "2H", label: "2 jam" },
                  { key: "TODAY", label: "Hari ini" }
                ].map((preset) => (
                  <Button
                    key={preset.key}
                    size="sm"
                    variant={rangePreset === preset.key ? "default" : "outline"}
                    onClick={() => applyRangePreset(preset.key as "1H" | "2H" | "TODAY")}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label htmlFor="playback-start" className="text-xs font-medium uppercase text-muted-foreground">Start</label>
                  <input
                    id="playback-start"
                    type="datetime-local"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none"
                    value={start}
                    onChange={(event) => {
                      setRangePreset("CUSTOM")
                      setStart(event.target.value)
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="playback-end" className="text-xs font-medium uppercase text-muted-foreground">End</label>
                  <input
                    id="playback-end"
                    type="datetime-local"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none"
                    value={end}
                    onChange={(event) => {
                      setRangePreset("CUSTOM")
                      setEnd(event.target.value)
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="playback-speed" className="text-xs font-medium uppercase text-muted-foreground">Speed</label>
                  <select
                    id="playback-speed"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none"
                    value={speed}
                    onChange={(event) => setSpeed(Number(event.target.value))}
                  >
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={4}>4x</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={playbackMode}
                    onValueChange={(value) => {
                      if (value === "MATCHED" || value === "RAW") setPlaybackMode(value)
                    }}
                    aria-label="Mode playback"
                  >
                    <ToggleGroupItem value="MATCHED" aria-label="Matched playback">
                      Matched
                    </ToggleGroupItem>
                    <ToggleGroupItem value="RAW" aria-label="Raw GPS playback">
                      Raw GPS
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="accent-emerald-500"
                      checked={smoothEnabled}
                      onChange={(event) => setSmoothEnabled(event.target.checked)}
                    />
                    Smooth Track
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={loadPlayback}>
                    Muat Playback
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSavePlaybackRecord}
                    disabled={savingRecord || positions.length === 0}
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {savingRecord ? "Menyimpan..." : "Simpan Record"}
                  </Button>
                  <Button
                    variant="glow"
                    onClick={() => setIsPlaying((prev) => !prev)}
                    disabled={positions.length === 0}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {isPlaying ? "Pause" : "Play"}
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {positions.length > 0
                  ? `Posisi ${playIndex + 1} / ${positions.length} — ${matchedPointCount} tercocok`
                  : "Belum ada data — muat playback untuk memulai"}
              </div>
              {playbackTruncated && (
                <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
                  Data playback dipotong di 5.000 point. Persempit rentang waktu untuk investigasi lebih detail.
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Event pada rentang ini</div>
                  {playbackEvents.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Tidak ada incident pada rentang playback.</div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {playbackEvents.map((event) => (
                        <Link
                          key={event.event_id}
                          href={`/dashboard/incidents/${event.event_id}`}
                          className="block rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs hover:border-white/20"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-white">{event.type}</span>
                            <span className="text-muted-foreground">{event.severity}</span>
                          </div>
                          <div className="mt-1 text-muted-foreground">{new Date(event.ts_start).toLocaleString()}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                   <div className="text-xs font-semibold text-muted-foreground uppercase">Record MinIO Terakhir</div>
                  {playbackRecords.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Belum ada record playback tersimpan.</div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {playbackRecords.map((record) => (
                        <button
                          key={record.record_id}
                          onClick={() => loadPlaybackFromRecord(record)}
                          className="w-full text-left rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-white">{record.point_count} point</span>
                            <span className="text-muted-foreground">{record.storage_bucket}</span>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            {new Date(record.start).toLocaleString()} - {new Date(record.end).toLocaleString()}
                          </div>
                          <div className="mt-1 truncate text-zinc-500">{record.storage_key}</div>
                          <div className="mt-1 text-emerald-400 text-[10px]">Klik untuk memutar playback</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card/50 border border-border rounded-xl p-6 space-y-3">
              <h3 className="font-semibold text-lg">Ringkasan Armada</h3>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold">{vehicle.plate_no}</div>
                <span className="text-xs px-2 py-1 rounded-full border border-emerald-500/30 text-emerald-400">
                  {label(VEHICLE_STATUS_LABEL, vehicle.status)}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">Trayek {vehicle.route_id}</div>
              {vehicle.risk_score !== null && vehicle.risk_score !== undefined && vehicle.risk_level && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Risk Score</span>
                    <RiskBadge score={vehicle.risk_score} level={vehicle.risk_level} />
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full ${RISK_LEVEL_BAR_COLORS[vehicle.risk_level ?? ""] ?? "bg-zinc-500"}`}
                      style={{ width: `${Math.min(100, Math.max(0, vehicle.risk_score))}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pemilik</span>
                  <span>{vehicle.owner_name || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Kode Armada</span>
                  <span>{vehicle.vehicle_code || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Seen</span>
                  <span>{vehicle.last_ping ? new Date(vehicle.last_ping).toLocaleString() : "-"}</span>
                </div>
              </div>
            </div>

            <div className="bg-card/50 border border-red-500/20 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  Insiden & Anomali
                </h3>
                <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full font-medium">
                  {incidents.length}
                </span>
              </div>
              {incidents.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Belum ada riwayat insiden untuk kendaraan ini.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {incidents.map((incident) => (
                    <div
                      key={incident.incident_id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border hover:border-white/20 transition-colors"
                    >
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${SEVERITY_ICON_COLORS[incident.severity] ?? "bg-zinc-500/10 text-zinc-400"}`}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{label(INCIDENT_TYPE_LABEL, incident.type)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${INCIDENT_STATUS_COLORS[incident.status] ?? STATUS_MUTED}`}>
                            {label(INCIDENT_STATUS_LABEL, incident.status)}
                          </span>
                        </div>
                        {incident.description && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">{incident.description}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(incident.created_at).toLocaleString()}</span>
                          {incident.resolved_at && (
                            <span className="text-emerald-400">
                              • Resolved {new Date(incident.resolved_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <Link href={`/dashboard/incidents/${incident.incident_id}`}>
                        <Button variant="ghost" size="sm" className="text-xs h-7">
                          Detail
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card/50 border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-lg">Informasi Tambahan</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "POSISI", label: "Posisi Terakhir" },
                  { key: "VEHICLE", label: "Kendaraan" },
                  { key: "OWNER", label: "Pemilik" },
                  { key: "SHIFT", label: "Shift & Driver" }
                ].map((tab) => (
                  <Button
                    key={tab.key}
                    size="sm"
                    variant={activeTab === tab.key ? "default" : "outline"}
                    className="text-xs"
                    onClick={() => setActiveTab(tab.key as "POSISI" | "VEHICLE" | "OWNER" | "SHIFT")}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>

              {activeTab === "POSISI" && (
                currentPosition ? (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Waktu</span>
                      <span>{new Date(currentPosition.ts).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Koordinat</span>
                      <span>
                        {currentPosition.lat.toFixed(5)}, {currentPosition.lon.toFixed(5)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Mode</span>
                      <span>{playbackMode === "MATCHED" ? "Matched" : "Raw GPS"}</span>
                    </div>
                    {playbackMode === "MATCHED" && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Confidence</span>
                          <span>{formatPercent(currentPosition.match_confidence)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Snap Distance</span>
                          <span>{formatMeters(currentPosition.snap_distance_m)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Progress</span>
                          <span>{formatMeters(currentPosition.distance_along_route_m)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Gauge className="w-4 h-4" /> Kecepatan
                      </span>
                      <span>{currentPosition.speed ? `${currentPosition.speed} km/h` : "-"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Status
                      </span>
                      <span>{label(VEHICLE_STATUS_LABEL, currentPosition.status || vehicle.status)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Belum ada data posisi.</div>
                )
              )}

              {activeTab === "OWNER" && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Nama</span>
                    <span>{vehicle.owner_name || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tipe</span>
                    <span>{vehicle.owner_type || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Kontak</span>
                    <span>{vehicle.phone_primary || "-"}</span>
                  </div>
                </div>
              )}

              {activeTab === "VEHICLE" && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Kode Armada</span>
                    <span>{vehicle.vehicle_code || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status Operasional</span>
                    <span>{label(VEHICLE_STATUS_LABEL, vehicle.status)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Trayek</span>
                    <span>{vehicle.route_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Skor Risiko</span>
                    {vehicle.risk_score !== null && vehicle.risk_score !== undefined && vehicle.risk_level ? (
                      <RiskBadge score={vehicle.risk_score} level={vehicle.risk_level} />
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                  <div className="pt-3 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">Dokumen Kendaraan</div>
                    {documents.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Belum ada dokumen terdaftar.</div>
                    ) : (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div key={doc.document_id} className="flex items-center justify-between text-xs bg-secondary/30 border border-border rounded-md px-2 py-1">
                            <span>{doc.doc_type}</span>
                            <span className="text-muted-foreground">{doc.expiry_date || "-"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "SHIFT" && (
                <div className="space-y-2 text-sm">
                  {assignment ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Driver</span>
                        <span>{assignment.driver_name || "-"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">No HP</span>
                        <span>{assignment.driver_phone || "-"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Device</span>
                        <span>{assignment.imei_or_serial || "-"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Shift</span>
                        <span>
                          {assignment.shift_name || "-"} {assignment.shift_start || ""} - {assignment.shift_end || ""}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Belum ada data shift & driver yang terdaftar untuk kendaraan ini.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function toLocalDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`
}

function isMatchedPlaybackPoint(point: PlaybackPoint) {
  return point.match_status === "MATCHED"
    && point.snapped_lat !== null
    && point.snapped_lat !== undefined
    && point.snapped_lon !== null
    && point.snapped_lon !== undefined
}

function projectPlaybackTrack(points: PlaybackPoint[], mode: "MATCHED" | "RAW", smoothEnabled: boolean) {
  const projected = points.map((point) => {
    if (mode === "MATCHED" && isMatchedPlaybackPoint(point)) {
      return {
        ...point,
        lat: Number(point.snapped_lat),
        lon: Number(point.snapped_lon),
        heading: point.matched_heading ?? point.heading
      }
    }
    return point
  })

  return smoothEnabled ? smoothTrack(projected) : projected
}

function formatMeters(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  const numeric = Number(value)
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(2)} km`
  return `${Math.round(numeric)} m`
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return `${Math.round(Number(value) * 100)}%`
}

function smoothTrack(points: PlaybackPoint[]) {
  if (points.length < 3) return points
  const cleaned: PlaybackPoint[] = []
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[i - 1]
    const current = points[i]
    const next = points[i + 1]
    if (!prev || !next) {
      cleaned.push(current)
      continue
    }
    const smoothedLat = (prev.lat + current.lat + next.lat) / 3
    const smoothedLon = (prev.lon + current.lon + next.lon) / 3
    cleaned.push({ ...current, lat: smoothedLat, lon: smoothedLon })
  }
  return cleaned
}
