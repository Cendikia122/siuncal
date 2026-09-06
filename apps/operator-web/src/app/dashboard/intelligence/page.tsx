"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertTriangle, Bus, Map, Radar, Route, ShieldAlert, Activity, Zap, MapPin, ArrowRight, Clock, Network } from "lucide-react"
import { RoleGate } from "@/components/auth/role-gate"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api"
import { INCIDENT_SEVERITY_LABEL, label } from "@/lib/labels"
import { RISK_LEVEL_COLORS, RISK_LEVEL_DOT_COLORS, SEVERITY_BADGE_COLORS, STATUS_MUTED } from "@/lib/status-colors"

type HighRiskVehicle = {
  vehicle_id: string
  plate_no: string
  route_id?: string | null
  owner_name?: string | null
  risk_score?: number | null
  risk_level?: string | null
  incident_count_7d: number
  anomaly_count_7d: number
  drill_down: {
    vehicle_detail: string
    playback: string
    incidents: string
  }
}

type ProblematicRoute = {
  route_id: string
  route_name?: string | null
  anomaly_count_7d: number
  alert_count_7d: number
  incident_count_7d: number
  avg_risk_score?: number | null
}

type RecurringAnomaly = {
  vehicle_id: string
  plate_no: string
  route_id?: string | null
  rule: string
  occurrence_count: number
  last_seen_at: string
  drill_down: {
    vehicle_detail: string
    playback: string
  }
}

type CollectiveAnomaly = {
  collective_anomaly_id: string
  type: string
  severity: string
  status: string
  evidence: Record<string, unknown>
  involved_vehicles: string[]
  detected_at: string
  escalation_count: number
}

type FleetIntelligenceResponse = {
  generated_at: string
  top_high_risk_vehicles: HighRiskVehicle[]
  top_problematic_routes: ProblematicRoute[]
  recurring_anomalies: RecurringAnomaly[]
}

const COLLECTIVE_TYPE_LABELS: Record<string, string> = {
  OWNER_MULTI_HIGH_RISK: "Pemilik Multi Risiko Tinggi",
  ROUTE_CLUSTER_VIOLATION: "Pelanggaran Klaster Trayek",
  DEVICE_REASSIGN_ABUSE: "Penyalahgunaan Perangkat",
  TIMING_COORDINATION: "Koordinasi Waktu",
}

export default function IntelligencePage() {
  const [data, setData] = useState<FleetIntelligenceResponse | null>(null)
  const [collectiveAnomalies, setCollectiveAnomalies] = useState<CollectiveAnomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [escalating, setEscalating] = useState("")

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [fleetResponse, collectiveResponse] = await Promise.all([
          apiFetch<FleetIntelligenceResponse>("/intelligence/fleet"),
          apiFetch<{ items: CollectiveAnomaly[] }>("/collective-anomalies?status=OPEN")
        ])
        if (!active) return
        setData(fleetResponse)
        setCollectiveAnomalies(collectiveResponse.items || [])
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Gagal memuat fleet intelligence")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const handleEscalate = async (id: string) => {
    if (!confirm("Eskalasi collective anomaly ini menjadi incident?")) return
    setEscalating(id)
    try {
      await apiFetch(`/collective-anomalies/${id}/escalate`, { method: "POST" })
      setCollectiveAnomalies((prev) => prev.filter((ca) => ca.collective_anomaly_id !== id))
    } catch {
      // ignore
    } finally {
      setEscalating("")
    }
  }

  return (
    <RoleGate roles="ANALISA" showDenied>
      <div className="p-6 space-y-6" data-tour="intelligence-overview">
        <div className="flex flex-col gap-2" data-tour="intelligence-header">
          <h1 className="text-2xl font-bold tracking-tight">Fleet Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Slice prioritas untuk kendaraan berisiko, rute bermasalah, dan anomaly yang berulang.
          </p>
        </div>

        {loading && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-80 rounded-xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Metric icon={Bus} label="Kendaraan Risiko Tinggi" value={data.top_high_risk_vehicles.length} colorClass="bg-red-500" />
              <Metric icon={Route} label="Trayek Bermasalah" value={data.top_problematic_routes.length} colorClass="bg-orange-500" />
              <Metric icon={Radar} label="Anomali Berulang" value={data.recurring_anomalies.length} colorClass="bg-yellow-500" />
              <Metric icon={Network} label="Anomali Kolektif" value={collectiveAnomalies.length} colorClass="bg-purple-500" />
            </div>

            {collectiveAnomalies.length > 0 && (
              <section className="rounded-2xl border border-purple-500/20 bg-zinc-900/30 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 bg-black/20 flex items-center gap-3">
                  <div className="p-2 rounded-xl border border-purple-500/20 bg-purple-500/10">
                    <Network className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-zinc-100">Anomali Kolektif</h2>
                    <p className="text-xs text-zinc-500">Pola pelanggaran lintas entitas yang terdeteksi otomatis.</p>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {collectiveAnomalies.map((ca) => (
                    <div key={ca.collective_anomaly_id} className="p-4 rounded-xl border border-white/5 bg-black/20 hover:bg-zinc-900/50 transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-xs font-bold text-purple-300">{COLLECTIVE_TYPE_LABELS[ca.type] || ca.type}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_BADGE_COLORS[ca.severity] ?? STATUS_MUTED}`}>
                              {label(INCIDENT_SEVERITY_LABEL, ca.severity)}
                            </span>
                            <span className="text-[10px] text-zinc-500">{ca.involved_vehicles.length} kendaraan</span>
                            {ca.escalation_count > 0 && <span className="text-[10px] text-zinc-500">Eskalasi #{ca.escalation_count}</span>}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                          disabled={escalating === ca.collective_anomaly_id}
                          onClick={() => handleEscalate(ca.collective_anomaly_id)}
                        >
                          {escalating === ca.collective_anomaly_id ? "..." : "Eskalasi"}
                        </Button>
                      </div>
                      <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Detected: {new Date(ca.detected_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              <section className="rounded-2xl border border-white/5 bg-zinc-900/30 overflow-hidden flex flex-col">
                <SectionHeader 
                  icon={ShieldAlert} 
                  title="Kendaraan Risiko Tinggi"
                  description="Kendaraan dengan skor risiko tertinggi."
                  colorClass="text-red-400 bg-red-500/10 border-red-500/20"
                />
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {data.top_high_risk_vehicles.length === 0 ? (
                    <EmptyState text="Belum ada kendaraan risiko tinggi." />
                  ) : data.top_high_risk_vehicles.map((vehicle) => (
                    <div key={vehicle.vehicle_id} className="group p-4 rounded-xl border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/20 transition-all">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <Link href={vehicle.drill_down.vehicle_detail} className="text-base font-bold text-zinc-100 hover:text-white transition-colors flex items-center gap-2">
                            {vehicle.plate_no}
                          </Link>
                          <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
                            <span className="bg-white/5 px-2 py-0.5 rounded text-zinc-400">Trayek {vehicle.route_id || "-"}</span>
                            <span>•</span>
                            <span>{vehicle.owner_name || "-"}</span>
                          </div>
                        </div>
                        <RiskBadge score={vehicle.risk_score} level={vehicle.risk_level} />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4 pl-2">
                        <SmallStat label="Insiden (7h)" value={vehicle.incident_count_7d} />
                        <SmallStat label="Anomali (7h)" value={vehicle.anomaly_count_7d} />
                      </div>
                      
                      <div className="flex gap-2 pl-2">
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs bg-zinc-900 border-white/10 hover:bg-white/10" asChild>
                          <Link href={vehicle.drill_down.vehicle_detail}>Detail <ArrowRight className="w-3 h-3 ml-1.5" /></Link>
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs bg-zinc-900 border-white/10 hover:bg-white/10" asChild>
                          <Link href={vehicle.drill_down.playback}>Playback</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/5 bg-zinc-900/30 overflow-hidden flex flex-col">
                <SectionHeader 
                  icon={Map} 
                  title="Trayek Bermasalah"
                  description="Trayek dengan anomali & insiden terbanyak."
                  colorClass="text-orange-400 bg-orange-500/10 border-orange-500/20"
                />
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {data.top_problematic_routes.length === 0 ? (
                    <EmptyState text="Belum ada rute bermasalah." />
                  ) : data.top_problematic_routes.map((route) => (
                    <div key={route.route_id} className="group p-4 rounded-xl border border-orange-500/10 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/20 transition-all">
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-orange-400" />
                          <span className="text-base font-bold text-zinc-100">Trayek {route.route_id}</span>
                        </div>
                        <div className="text-xs text-zinc-500">{route.route_name || "Tidak ada deskripsi rute"}</div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pl-2">
                        <SmallStat label="Total Anomali" value={route.anomaly_count_7d} />
                        <SmallStat label="Total Insiden" value={route.incident_count_7d} />
                        <SmallStat label="Peringatan" value={route.alert_count_7d} />
                        <SmallStat label="Rata-rata Skor Risiko" value={route.avg_risk_score ?? "-"} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/5 bg-zinc-900/30 overflow-hidden flex flex-col">
                <SectionHeader 
                  icon={AlertTriangle} 
                  title="Anomali Berulang"
                  description="Pola pelanggaran yang terus berulang."
                  colorClass="text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
                />
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {data.recurring_anomalies.length === 0 ? (
                    <EmptyState text="Belum ada anomali berulang." />
                  ) : data.recurring_anomalies.map((anomaly) => (
                    <div key={`${anomaly.vehicle_id}-${anomaly.rule}`} className="group p-4 rounded-xl border border-yellow-500/10 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/20 transition-all">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <Link href={anomaly.drill_down.vehicle_detail} className="text-base font-bold text-zinc-100 hover:text-white transition-colors flex items-center gap-2">
                            {anomaly.plate_no}
                          </Link>
                          <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
                            <span className="bg-white/5 px-2 py-0.5 rounded text-zinc-400">Trayek {anomaly.route_id || "-"}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-bold px-2 py-1 rounded-md border border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
                            {anomaly.occurrence_count}x Terjadi
                          </span>
                        </div>
                      </div>
                      
                      <div className="pl-2 mb-4">
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5 border border-white/5">
                          <Zap className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                          <span className="text-xs text-zinc-300 leading-relaxed font-medium">{anomaly.rule}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pl-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                          <Clock className="w-3 h-3" />
                          Terakhir: {new Date(anomaly.last_seen_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-400 hover:text-white px-2" asChild>
                          <Link href={anomaly.drill_down.playback}>Playback <ArrowRight className="w-3 h-3 ml-1" /></Link>
                        </Button>
                      </div>
                    </div>
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

function Metric({ icon: Icon, label, value, colorClass }: { icon: React.ElementType, label: string, value: number, colorClass: string }) {
  const textColor = colorClass.replace('bg-', 'text-')
  const borderColor = colorClass.replace('bg-', 'border-') + '/20'
  return (
    <div className={`rounded-2xl border ${borderColor} bg-zinc-900/40 p-5 hover:bg-zinc-900/60 transition-all`}>
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-3">
        <div className={`p-2 rounded-lg bg-black/40 border border-white/5 ${textColor}`}>
          <Icon className="w-4 h-4" />
        </div>
        {label}
      </div>
      <div className={`text-4xl font-bold tracking-tight ${textColor}`}>{value}</div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, description, colorClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" }: { icon: React.ElementType, title: string, description?: string, colorClass?: string }) {
  return (
    <div className="px-6 py-5 border-b border-white/5 bg-black/20">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl border ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
        </div>
      </div>
    </div>
  )
}

function SmallStat({ label, value }: { label: string, value: number | string }) {
  return (
    <div className="rounded-xl bg-black/20 border border-white/5 px-3 py-2 flex flex-col items-center justify-center text-center">
      <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1">{label}</div>
      <div className="font-mono text-base text-zinc-200 font-semibold">{value}</div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-8 text-sm text-zinc-500 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-900/50 flex items-center justify-center mb-3">
        <Activity className="w-5 h-5 text-zinc-600" />
      </div>
      {text}
    </div>
  )
}

function RiskBadge({ score, level }: { score?: number | null, level?: string | null }) {
  const colors = RISK_LEVEL_COLORS[level ?? ""] ?? STATUS_MUTED
  const dot = RISK_LEVEL_DOT_COLORS[level ?? ""] ?? "bg-zinc-500"

  return (
    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border font-medium ${colors}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span>{score ?? "-"}</span>
      <span className="opacity-75">{level || ""}</span>
    </div>
  )
}
