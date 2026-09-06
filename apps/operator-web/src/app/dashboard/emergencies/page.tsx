"use client"

import { Button } from "@/components/ui/button"
import { apiFetch, apiUrl } from "@/lib/api"
import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, label } from "@/lib/labels"
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, MapPin, Navigation, ShieldAlert, Siren, Upload, UserCheck } from "lucide-react"
import Link from "next/link"
import type { ElementType } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"

type EmergencyItem = {
  id: string
  incident_id: string
  type: string
  status: string
  severity: string
  description?: string | null
  location?: string | null
  lat?: number | null
  lon?: number | null
  created_at: string
  acknowledged_at?: string | null
  assigned_to?: string | null
  assigned_name?: string | null
  source?: string | null
  emergency_category?: string | null
  trust_level?: string | null
  escalation_state?: string | null
  escalation_target?: string | null
  escalation_breached_seconds?: number | null
  ack_due_at?: string | null
  assignment_due_at?: string | null
  plate_no?: string | null
  route_id?: string | null
  nearest_vehicle?: {
    vehicle_id: string
    plate_no?: string | null
    route_id?: string | null
    distance_m?: number | null
  } | null
  sla?: {
    ack_due_at?: string | null
    assignment_due_at?: string | null
  } | null
}

type UserItem = {
  user_id: string
  full_name: string
}

type ItemsResponse<T> = {
  items?: T[]
}

const closedStatuses = new Set(["RESOLVED", "FALSE_ALARM", "CLOSED"])

const getCsrfToken = () => {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|; )sentra_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export default function EmergencyBoardPage() {
  const [items, setItems] = useState<EmergencyItem[]>([])
  const [assignees, setAssignees] = useState<UserItem[]>([])
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({})
  const [proofFiles, setProofFiles] = useState<Record<string, File | null>>({})
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      setError("")
      const data = await apiFetch<ItemsResponse<EmergencyItem>>("/emergencies")
      setItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat emergency")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await apiFetch<ItemsResponse<UserItem>>("/incident-assignees")
        setAssignees(data.items || [])
      } catch {
        setAssignees([])
      }
    }
    loadUsers()
  }, [])

  const summary = useMemo(() => {
    const active = items.filter((item) => !closedStatuses.has(item.status))
    return {
      total: active.length,
      ackOverdue: active.filter((item) => item.escalation_state === "ACK_OVERDUE").length,
      assignOverdue: active.filter((item) => item.escalation_state === "ASSIGNMENT_OVERDUE").length,
      assigned: active.filter((item) => item.assigned_to).length,
    }
  }, [items])

  const uploadProof = async (incidentId: string) => {
    const file = proofFiles[incidentId]
    if (!file) {
      throw new Error("Pilih file bukti terlebih dahulu")
    }
    const form = new FormData()
    form.set("proof", file)
    const note = resolutionNotes[incidentId]
    if (note) form.set("notes", note)
    const csrf = getCsrfToken()
    const response = await fetch(apiUrl(`/incidents/${incidentId}/proofs`), {
      method: "POST",
      credentials: "include",
      headers: csrf ? { "x-csrf-token": csrf } : undefined,
      body: form,
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.error?.message || `Upload bukti gagal (${response.status})`)
    }
  }

  const runAction = async (incidentId: string, action: string) => {
    setError("")
    try {
      const assignedTo = assignSelections[incidentId]
      if (action === "ASSIGN" && !assignedTo) {
        setError("Pilih petugas lapangan sebelum assign")
        return
      }
      if (action === "PROOF_UPLOAD") {
        await uploadProof(incidentId)
        setProofFiles((prev) => ({ ...prev, [incidentId]: null }))
        await load()
        return
      }
      if (action === "RESOLVE" && proofFiles[incidentId]) {
        await uploadProof(incidentId)
      }

      await apiFetch(`/incidents/${incidentId}/actions`, {
        method: "POST",
        body: JSON.stringify({
          action,
          assigned_to: assignedTo || null,
          resolution_notes: resolutionNotes[incidentId] || null,
          escalation_target: action === "ESCALATE" ? "SUPERVISOR" : null,
        })
      })
      if (action === "RESOLVE") setProofFiles((prev) => ({ ...prev, [incidentId]: null }))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui emergency")
    }
  }

  return (
    <section aria-label="Emergency Board" className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-red-500/10 p-2">
            <Siren className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Emergency Board</h1>
            <p className="text-muted-foreground">SOS penumpang, panic button, SLA, dan penugasan petugas lapangan.</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      <section aria-label="Ringkasan emergency" className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Metric icon={Siren} label="Emergency aktif" value={summary.total} tone="text-red-400" />
        <Metric icon={Clock3} label="Ack overdue" value={summary.ackOverdue} tone="text-orange-400" />
        <Metric icon={UserCheck} label="Assign overdue" value={summary.assignOverdue} tone="text-yellow-300" />
        <Metric icon={CheckCircle2} label="Sudah assigned" value={summary.assigned} tone="text-emerald-400" />
      </section>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section aria-label="Daftar emergency" className="space-y-4">
        {loading && <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-6 text-sm text-zinc-400">Memuat emergency...</div>}

        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-zinc-900/20 p-8 text-center">
            <div className="text-sm font-medium text-white">Tidak ada emergency aktif.</div>
            <div className="mt-1 text-sm text-zinc-500">SOS baru akan muncul di sini secara otomatis.</div>
          </div>
        )}

        {items.map((item) => (
          <EmergencyRow
            key={item.incident_id}
            item={item}
            now={now}
            assignees={assignees}
            selectedAssignee={assignSelections[item.incident_id] || ""}
            proofFile={proofFiles[item.incident_id] || null}
            resolutionNote={resolutionNotes[item.incident_id] || ""}
            onAssigneeChange={(value) => setAssignSelections((prev) => ({ ...prev, [item.incident_id]: value }))}
            onProofFileChange={(value) => setProofFiles((prev) => ({ ...prev, [item.incident_id]: value }))}
            onResolutionNoteChange={(value) => setResolutionNotes((prev) => ({ ...prev, [item.incident_id]: value }))}
            onAction={(action) => runAction(item.incident_id, action)}
          />
        ))}
      </section>
    </section>
  )
}

function Metric({ icon: Icon, label, value, tone }: { icon: ElementType, label: string, value: number, tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  )
}

function EmergencyRow({
  item,
  now,
  assignees,
  selectedAssignee,
  proofFile,
  resolutionNote,
  onAssigneeChange,
  onProofFileChange,
  onResolutionNoteChange,
  onAction,
}: {
  item: EmergencyItem
  now: number
  assignees: UserItem[]
  selectedAssignee: string
  proofFile: File | null
  resolutionNote: string
  onAssigneeChange: (value: string) => void
  onProofFileChange: (value: File | null) => void
  onResolutionNoteChange: (value: string) => void
  onAction: (action: string) => void
}) {
  const ackRemaining = secondsUntil(item.sla?.ack_due_at || item.ack_due_at, now)
  const assignRemaining = secondsUntil(item.sla?.assignment_due_at || item.assignment_due_at, now)
  const canAct = !closedStatuses.has(item.status)
  const mapsUrl = item.lat && item.lon ? `https://www.google.com/maps?q=${item.lat},${item.lon}` : null

  return (
    <article className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-bold uppercase text-red-300">
              {label(INCIDENT_TYPE_LABEL, item.type)}
            </span>
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300">
              {label(INCIDENT_STATUS_LABEL, item.status)}
            </span>
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300">
              {item.source || "-"} / {item.trust_level || "-"}
            </span>
            {item.escalation_state && item.escalation_state !== "ON_TRACK" && (
              <span className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-300">
                {item.escalation_state}
              </span>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">{item.description || "Emergency aktif"}</h2>
            <div className="mt-1 text-xs font-mono text-zinc-500">{item.incident_id}</div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
            <Info icon={MapPin} text={item.location || "Lokasi belum tersedia"} />
            <Info icon={AlertTriangle} text={`Kategori ${item.emergency_category || "-"}`} />
            <Info icon={Navigation} text={item.plate_no ? `${item.plate_no} / Trayek ${item.route_id || "-"}` : "Kendaraan belum dipilih"} />
            {item.nearest_vehicle && (
              <Info
                icon={Navigation}
                text={`Terdekat ${item.nearest_vehicle.plate_no || "-"} (${formatMeters(item.nearest_vehicle.distance_m)})`}
              />
            )}
            {item.assigned_name && <Info icon={UserCheck} text={`PIC ${item.assigned_name}`} />}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SlaTimer label="Acknowledge" seconds={ackRemaining} />
            <SlaTimer label="Assign responder" seconds={assignRemaining} />
          </div>
        </div>

        <div className="w-full shrink-0 space-y-3 lg:w-[360px]">
          <select
            aria-label="Pilih responder"
            className="h-9 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-zinc-200"
            value={selectedAssignee}
            onChange={(event) => onAssigneeChange(event.target.value)}
            disabled={!canAct}
          >
            <option value="">Pilih petugas/responder</option>
            {assignees.map((user) => (
              <option key={user.user_id} value={user.user_id}>{user.full_name}</option>
            ))}
          </select>

          <input
            aria-label="File bukti"
            className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => onProofFileChange(event.target.files?.[0] || null)}
            disabled={!canAct}
          />
          {proofFile && <div className="text-xs text-zinc-500">{proofFile.name}</div>}

          <textarea
            aria-label="Catatan resolusi"
            className="min-h-20 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200"
            placeholder="Catatan penanganan/resolusi"
            value={resolutionNote}
            onChange={(event) => onResolutionNoteChange(event.target.value)}
            disabled={!canAct}
          />

          <div className="flex flex-wrap gap-2">
            {item.status === "OPEN" && (
              <Button size="sm" type="button" onClick={() => onAction("ACKNOWLEDGE")}>
                Akui
              </Button>
            )}
            {canAct && (
              <>
                <Button size="sm" type="button" variant="outline" onClick={() => onAction("ASSIGN")}>
                  Assign
                </Button>
                <Button size="sm" type="button" variant="outline" onClick={() => onAction("PROOF_UPLOAD")}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> Bukti
                </Button>
                <Button size="sm" type="button" variant="outline" onClick={() => onAction("ESCALATE")}>
                  <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Eskalasi
                </Button>
                <Button size="sm" type="button" className="bg-emerald-700 hover:bg-emerald-600" onClick={() => onAction("RESOLVE")}>
                  Selesai
                </Button>
              </>
            )}
            <Button size="sm" type="button" variant="ghost" asChild>
              <Link href={`/dashboard/incidents/${item.incident_id}`}>Detail</Link>
            </Button>
            {mapsUrl && (
              <Button size="sm" type="button" variant="ghost" asChild>
                <a href={mapsUrl} target="_blank" rel="noreferrer">
                  Maps <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function Info({ icon: Icon, text }: { icon: ElementType, text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1">
      <Icon className="h-3.5 w-3.5 text-zinc-500" /> {text}
    </span>
  )
}

function SlaTimer({ label, seconds }: { label: string, seconds: number | null }) {
  const breached = seconds !== null && seconds < 0
  return (
    <div className={`rounded-lg border px-3 py-2 ${breached ? "border-red-500/30 bg-red-500/10" : "border-white/10 bg-black/20"}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${breached ? "text-red-300" : "text-zinc-200"}`}>
        {seconds === null ? "-" : breached ? `Lewat ${formatDuration(Math.abs(seconds))}` : formatDuration(seconds)}
      </div>
    </div>
  )
}

function secondsUntil(value: string | null | undefined, now: number) {
  if (!value) return null
  const due = new Date(value).getTime()
  if (!Number.isFinite(due)) return null
  return Math.ceil((due - now) / 1000)
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const remaining = safe % 60
  if (minutes === 0) return `${remaining}s`
  return `${minutes}m ${remaining.toString().padStart(2, "0")}s`
}

function formatMeters(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-"
  if (Number(value) >= 1000) return `${(Number(value) / 1000).toFixed(1)} km`
  return `${Math.round(Number(value))} m`
}
