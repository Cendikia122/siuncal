"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { use, useEffect, useState } from "react"
import { ArrowLeft, AlertTriangle, MapPin, Clock, User, CheckCircle, XCircle, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { INCIDENT_SEVERITY_LABEL, INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, label } from "@/lib/labels"

const MapView = dynamic(() => import("@/components/map/map-view"), { ssr: false })

type IncidentDetail = {
  incident_id: string
  type: string
  severity: string
  status: string
  description?: string | null
  location_desc?: string | null
  lat?: number | null
  lon?: number | null
  created_at?: string | null
  resolved_at?: string | null
  plate_no?: string | null
  route_id?: string | null
  assigned_to?: string | null
  assigned_name?: string | null
}

type IncidentAction = {
  action_id: string
  action: string
  notes?: string | null
  actor_name?: string | null
  created_at: string
}

type UserItem = {
  user_id: string
  full_name: string
}

type IncidentDetailResponse = {
  incident: IncidentDetail
  actions?: IncidentAction[]
}

type UsersResponse = {
  items?: UserItem[]
}

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params)
  const id = unwrappedParams.id

  const [incident, setIncident] = useState<IncidentDetail | null>(null)
  const [actions, setActions] = useState<IncidentAction[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [actionSuccess, setActionSuccess] = useState("")
  const [actionNotes, setActionNotes] = useState("")
  const [selectedAssignee, setSelectedAssignee] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadIncident = async () => {
    const data = await apiFetch<IncidentDetailResponse>(`/incidents/${id}`)
    setIncident(data.incident)
    setActions(data.actions || [])
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        await loadIncident()
        const usersData = await apiFetch<UsersResponse>("/incident-assignees")
        if (!active) return
        setUsers(usersData.items || [])
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Gagal memuat insiden")
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

  const handleAction = async (action: string) => {
    setActionError("")
    setActionSuccess("")
    setSubmitting(true)
    try {
      await apiFetch(`/incidents/${id}/actions`, {
        method: "POST",
        body: JSON.stringify({
          action,
          notes: actionNotes || null,
          assigned_to: action === "ASSIGN" ? selectedAssignee || null : null
        })
      })
      setActionSuccess(`Aksi "${action}" berhasil dilakukan`)
      setActionNotes("")
      setSelectedAssignee("")
      await loadIncident()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal melakukan aksi")
    } finally {
      setSubmitting(false)
    }
  }

  const isOpen = incident?.status === "OPEN"
  const isInProgress = incident?.status === "IN_PROGRESS"
  const isResolved = incident?.status === "RESOLVED" || incident?.status === "FALSE_ALARM"

  // Keyboard shortcuts for fast triage: a=acknowledge, r=resolve, f=false alarm.
  // Ignored while typing in a field or when an action is in flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return
      if (submitting || isResolved) return
      const key = e.key.toLowerCase()
      if (key === "a" && isOpen) { e.preventDefault(); handleAction("ACKNOWLEDGE") }
      else if (key === "r" && (isOpen || isInProgress)) { e.preventDefault(); handleAction("RESOLVE") }
      else if (key === "f" && (isOpen || isInProgress)) { e.preventDefault(); handleAction("FALSE_ALARM") }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isInProgress, isResolved, submitting, actionNotes, selectedAssignee])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-500/10 border-red-500/30 text-red-400"
      case "HIGH":
        return "bg-orange-500/10 border-orange-500/30 text-orange-400"
      case "MEDIUM":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
      default:
        return "bg-zinc-500/10 border-zinc-500/30 text-zinc-400"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-red-500/10 border-red-500/30 text-red-400"
      case "IN_PROGRESS":
        return "bg-blue-500/10 border-blue-500/30 text-blue-400"
      case "RESOLVED":
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
      case "FALSE_ALARM":
        return "bg-zinc-500/10 border-zinc-500/30 text-zinc-400"
      default:
        return "bg-zinc-500/10 border-zinc-500/30 text-zinc-400"
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case "ACKNOWLEDGE":
        return <CheckCircle className="w-3 h-3 text-blue-400" />
      case "ASSIGN":
        return <UserPlus className="w-3 h-3 text-purple-400" />
      case "RESOLVE":
        return <CheckCircle className="w-3 h-3 text-emerald-400" />
      case "FALSE_ALARM":
        return <XCircle className="w-3 h-3 text-zinc-400" />
      default:
        return <Clock className="w-3 h-3 text-zinc-400" />
    }
  }

  return (
    <div className="p-6 space-y-6">
      <section aria-label="Header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/incidents">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Detail Insiden</h1>
            <p className="text-muted-foreground">Ringkasan detail dan timeline tindakan.</p>
          </div>
        </div>
      </section>

      {loading && <div className="text-sm text-muted-foreground">Memuat detail insiden...</div>}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
          {error}
        </div>
      )}

      {incident && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section aria-label="Peta lokasi insiden">
              <div className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden h-[360px]">
                <MapView
                  markers={
                    incident.lat && incident.lon
                      ? [
                        {
                          id: incident.incident_id,
                          lat: Number(incident.lat),
                          lng: Number(incident.lon),
                          title: incident.type,
                          status: incident.severity,
                          type: "INCIDENT"
                        }
                      ]
                      : []
                  }
                />
              </div>
            </section>

            <section aria-label="Ringkasan insiden">
              <div className="bg-card/50 border border-border rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Ringkasan Insiden</h2>
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full border ${getSeverityColor(incident.severity)}`}>
                      {label(INCIDENT_SEVERITY_LABEL, incident.severity)}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(incident.status)}`}>
                      {label(INCIDENT_STATUS_LABEL, incident.status)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getSeverityColor(incident.severity)}`}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{label(INCIDENT_TYPE_LABEL, incident.type)}</div>
                    <div className="text-xs text-zinc-500 font-mono">{incident.incident_id}</div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">{incident.description}</div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{incident.location_desc || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{incident.created_at ? new Date(incident.created_at).toLocaleString() : "-"}</span>
                  </div>
                </div>

                {(incident.plate_no || incident.route_id) && (
                  <div className="bg-black/20 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-4">
                      {incident.plate_no && (
                        <div>
                          <span className="text-zinc-500">Armada:</span>{" "}
                          <span className="text-white font-medium">{incident.plate_no}</span>
                        </div>
                      )}
                      {incident.route_id && (
                        <div>
                          <span className="text-zinc-500">Trayek:</span>{" "}
                          <span className="text-white font-medium">{incident.route_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {incident.assigned_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-purple-400" />
                    <span className="text-zinc-400">Ditugaskan ke:</span>
                    <span className="text-white font-medium">{incident.assigned_name}</span>
                  </div>
                )}

                {incident.resolved_at && (
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>Diselesaikan pada {new Date(incident.resolved_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Action Panel */}
            {!isResolved && (
              <section aria-label="Panel tindakan">
                <form className="bg-card/50 border border-border rounded-xl p-6 space-y-4">
                  <h2 className="font-semibold text-lg">Tindakan</h2>

                  {actionError && (
                    <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
                      {actionError}
                    </div>
                  )}
                  {actionSuccess && (
                    <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3">
                      {actionSuccess}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">Catatan (opsional)</label>
                      <textarea
                        aria-label="Tambahkan catatan"
                        className="w-full h-20 mt-1 px-3 py-2 rounded-md border border-input bg-background/50 focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none text-sm resize-none"
                        placeholder="Tambahkan catatan untuk tindakan ini..."
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                      />
                    </div>

                    {users.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase">Tugaskan ke</label>
                        <select
                          aria-label="Tugaskan petugas"
                          className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none text-sm"
                          value={selectedAssignee}
                          onChange={(e) => setSelectedAssignee(e.target.value)}
                        >
                          <option value="">Pilih petugas...</option>
                          {users.map((user) => (
                            <option key={user.user_id} value={user.user_id}>
                              {user.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      {isOpen && (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleAction("ACKNOWLEDGE")}
                          disabled={submitting}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Akui
                        </Button>
                      )}

                      {(isOpen || isInProgress) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction("ASSIGN")}
                          disabled={submitting || !selectedAssignee}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Tugaskan
                        </Button>
                      )}

                      {(isOpen || isInProgress) && (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleAction("RESOLVE")}
                          disabled={submitting}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Selesaikan
                        </Button>
                      )}

                      {(isOpen || isInProgress) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-zinc-500 hover:text-white"
                          onClick={() => handleAction("FALSE_ALARM")}
                          disabled={submitting}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Peringatan Palsu
                        </Button>
                      )}
                    </div>
                    {!isResolved && (
                      <p className="text-[11px] text-muted-foreground pt-2">
                        Pintasan keyboard:{" "}
                        <kbd className="px-1 rounded bg-secondary/60 border border-border">A</kbd> akui ·{" "}
                        <kbd className="px-1 rounded bg-secondary/60 border border-border">R</kbd> selesaikan ·{" "}
                        <kbd className="px-1 rounded bg-secondary/60 border border-border">F</kbd> peringatan palsu
                      </p>
                    )}
                  </div>
                </form>
              </section>
            )}
          </div>

          <div className="space-y-6">
            <section aria-label="Log aksi">
              <div className="bg-card/50 border border-border rounded-xl p-6 space-y-3">
                <h2 className="font-semibold text-lg">Log Aksi</h2>
                {actions.length === 0 && <div className="text-sm text-muted-foreground">Belum ada aksi.</div>}
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {actions.map((action) => (
                    <div key={action.action_id} className="flex gap-3 text-xs">
                      <div className="flex-shrink-0 mt-0.5">
                        {getActionIcon(action.action)}
                      </div>
                      <div className="flex-1 border-l border-white/10 pl-3">
                        <div className="text-white font-medium">{action.action}</div>
                        {action.notes && <div className="text-zinc-400 mt-1">{action.notes}</div>}
                        <div className="text-[10px] text-zinc-500 mt-1">
                          {action.actor_name || "System"} • {new Date(action.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Quick Stats */}
            <section aria-label="Statistik">
              <div className="bg-card/50 border border-border rounded-xl p-6 space-y-3">
                <h2 className="font-semibold text-lg">Statistik</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Aksi</span>
                    <span className="text-white font-medium">{actions.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Waktu Respon</span>
                    <span className="text-white font-medium">
                      {actions.find((a) => a.action === "ACKNOWLEDGE")
                        ? `${Math.round(
                          (new Date(actions.find((a) => a.action === "ACKNOWLEDGE")!.created_at).getTime() -
                            new Date(incident.created_at || "").getTime()) /
                          60000
                        )} menit`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Waktu Resolusi</span>
                    <span className="text-white font-medium">
                      {incident.resolved_at && incident.created_at
                        ? `${Math.round(
                          (new Date(incident.resolved_at).getTime() - new Date(incident.created_at).getTime()) / 60000
                        )} menit`
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
