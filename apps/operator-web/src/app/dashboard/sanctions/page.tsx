"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Gavel, Plus, Download, X, RotateCcw, Ban } from "lucide-react"
import { Pagination } from "@/components/ui/pagination"
import { RoleGate } from "@/components/auth/role-gate"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch, apiDownload } from "@/lib/api"
import { SANCTION_STATUS_LABEL, SANCTION_TYPE_LABEL, RISK_LEVEL_LABEL, INCIDENT_TYPE_LABEL, INCIDENT_SEVERITY_LABEL, INCIDENT_STATUS_LABEL, label } from "@/lib/labels"

type Sanction = {
  sanction_id: string
  vehicle_id: string | null
  owner_id: string | null
  type: string
  level: string
  reason: string
  evidence: Record<string, unknown>
  incident_id: string | null
  collective_anomaly_id: string | null
  decided_at: string
  effective_from: string
  effective_until: string | null
  status: string
  notes: string | null
  plate_no: string | null
  owner_name: string | null
  decided_by_name: string | null
}

type VehicleOption = {
  vehicle_id: string
  plate_no: string
  owner_id: string | null
  owner_name?: string | null
  risk_score?: number | null
  risk_level?: string | null
}

type IncidentOption = {
  incident_id: string
  type: string
  severity: string
  status: string
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  EXPIRED: "bg-zinc-500/10 text-muted-foreground border-zinc-500/20",
  REVOKED: "bg-red-500/10 text-red-400 border-red-500/20",
  RENEWED: "bg-blue-500/10 text-blue-400 border-blue-500/20"
}

const LEVEL_COLORS: Record<string, string> = {
  LOW: "bg-zinc-500/10 text-muted-foreground",
  MEDIUM: "bg-yellow-500/10 text-yellow-400",
  HIGH: "bg-orange-500/10 text-orange-400",
  CRITICAL: "bg-red-500/10 text-red-400"
}

const TYPE_LABELS = SANCTION_TYPE_LABEL

const RISK_TO_LEVEL: Record<string, { type: string; level: string }> = {
  LOW: { type: "WARNING", level: "LOW" },
  MEDIUM: { type: "WARNING", level: "MEDIUM" },
  HIGH: { type: "COACHING", level: "HIGH" },
  CRITICAL: { type: "ADMINISTRATIVE", level: "CRITICAL" }
}

export default function SanctionsPage() {
  const [deepLinkFilters] = useState(() => {
    if (typeof window === "undefined") return { ownerId: "", vehicleId: "", incidentId: "" }
    const params = new URLSearchParams(window.location.search)
    return {
      ownerId: params.get("owner_id") || "",
      vehicleId: params.get("vehicle_id") || "",
      incidentId: params.get("incident_id") || ""
    }
  })
  const { ownerId, vehicleId, incidentId } = deepLinkFilters
  const hasDeepLinkFilter = Boolean(ownerId || vehicleId || incidentId)
  const [sanctions, setSanctions] = useState<Sanction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterType, setFilterType] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [actionLoading, setActionLoading] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 15

  const loadSanctions = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set("status", filterStatus)
      if (filterType) params.set("type", filterType)
      if (ownerId) params.set("owner_id", ownerId)
      if (vehicleId) params.set("vehicle_id", vehicleId)
      if (incidentId) params.set("incident_id", incidentId)
      const data = await apiFetch<{ items: Sanction[] }>(`/sanctions?${params}`)
      setSanctions(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat sanctions")
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterType, ownerId, vehicleId, incidentId])

  useEffect(() => { loadSanctions() }, [loadSanctions])
  useEffect(() => { setPage(1) }, [filterStatus, filterType, ownerId, vehicleId, incidentId])

  const handleAction = async (sanctionId: string, action: string) => {
    if (!confirm(`Yakin ingin ${action} sanksi ini?`)) return
    setActionLoading(sanctionId)
    try {
      await apiFetch(`/sanctions/${sanctionId}/actions`, {
        method: "POST",
        body: JSON.stringify({ action, notes: `${action} by operator` })
      })
      await loadSanctions()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Gagal ${action}`)
    } finally {
      setActionLoading("")
    }
  }

  return (
    <RoleGate roles="ANALISA" showDenied>
      <div className="p-6 space-y-6" data-tour="sanctions-overview">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" data-tour="sanctions-header">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Gavel className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Sanksi & Tindakan</h1>
              <p className="text-sm text-muted-foreground">Kelola sanksi formal untuk kendaraan dan pemilik armada.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => apiDownload("/sanctions/export?format=csv", "sanctions.csv")}>
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => apiDownload("/sanctions/export?format=pdf", "sanctions.pdf")}>
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-1" /> Buat Sanksi
            </Button>
          </div>
        </div>

        {hasDeepLinkFilter && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            <span className="font-semibold">Filter tautan aktif:</span>
            {vehicleId && <span className="rounded bg-black/20 px-2 py-1 font-mono">vehicle {vehicleId.slice(0, 8)}...</span>}
            {ownerId && <span className="rounded bg-black/20 px-2 py-1 font-mono">owner {ownerId.slice(0, 8)}...</span>}
            {incidentId && <span className="rounded bg-black/20 px-2 py-1 font-mono">incident {incidentId.slice(0, 8)}...</span>}
            <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-100 hover:text-white" asChild>
              <Link href="/dashboard/sanctions">Hapus filter tautan</Link>
            </Button>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <select className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-zinc-300" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="EXPIRED">Kedaluwarsa</option>
            <option value="REVOKED">Dicabut</option>
            <option value="RENEWED">Diperpanjang</option>
          </select>
          <select className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-zinc-300" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Semua Tipe</option>
            <option value="WARNING">Peringatan</option>
            <option value="COACHING">Pembinaan</option>
            <option value="ADMINISTRATIVE">Administratif</option>
            <option value="SUSPENSION">Penangguhan</option>
            <option value="REVOCATION">Pencabutan</option>
          </select>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : sanctions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="rounded-2xl border border-white/5 bg-card/30 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 text-[11px] text-zinc-500 uppercase font-bold tracking-wide">
                  <th className="text-left px-4 py-3">Kendaraan / Owner</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Tipe</th>
                  <th className="text-left px-4 py-3">Level</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Berlaku</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Diputuskan</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sanctions.slice((page - 1) * pageSize, page * pageSize).map((s) => (
                  <tr key={s.sanction_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-zinc-100">{s.plate_no || "-"}</div>
                      <div className="text-xs text-zinc-500">{s.owner_name || "-"}</div>
                      {s.incident_id && (
                        <Link href={`/dashboard/incidents/${s.incident_id}`} className="mt-1 block text-xs text-blue-400 hover:text-blue-300">
                          Lihat incident
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-zinc-300">{TYPE_LABELS[s.type] || s.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-md ${LEVEL_COLORS[s.level] || ""}`}>{label(RISK_LEVEL_LABEL, s.level)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-md border ${STATUS_COLORS[s.status] || ""}`}>{label(SANCTION_STATUS_LABEL, s.status)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {s.effective_from || "-"} — {s.effective_until || "~"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="text-xs text-zinc-300">{s.decided_by_name || "-"}</div>
                      <div className="text-[10px] text-zinc-500">{s.decided_at ? new Date(s.decided_at).toLocaleDateString() : "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status === "ACTIVE" && (
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-400 hover:text-blue-300" disabled={actionLoading === s.sanction_id} onClick={() => handleAction(s.sanction_id, "RENEW")}>
                            <RotateCcw className="w-3 h-3 mr-1" /> Renew
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300" disabled={actionLoading === s.sanction_id} onClick={() => handleAction(s.sanction_id, "REVOKE")}>
                            <Ban className="w-3 h-3 mr-1" /> Revoke
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={pageSize} total={sanctions.length} onPageChange={setPage} />
          </div>
        )}

        {showCreate && (
          <CreateSanctionDialog
            initialVehicleId={vehicleId}
            initialIncidentId={incidentId}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); loadSanctions(); }}
          />
        )}
      </div>
    </RoleGate>
  )
}

function CreateSanctionDialog({ initialVehicleId = "", initialIncidentId = "", onClose, onCreated }: { initialVehicleId?: string; initialIncidentId?: string; onClose: () => void; onCreated: () => void }) {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [incidents, setIncidents] = useState<IncidentOption[]>([])
  const [form, setForm] = useState({ vehicle_id: initialVehicleId, owner_id: "", type: "WARNING", level: "LOW", reason: "", incident_id: initialIncidentId, effective_from: new Date().toISOString().slice(0, 10), effective_until: "", notes: "" })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    apiFetch<{ items: VehicleOption[] }>("/vehicles").then((r) => setVehicles(r.items || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (form.vehicle_id) {
      const v = vehicles.find((veh) => veh.vehicle_id === form.vehicle_id)
      if (v) {
        setForm((f) => ({ ...f, owner_id: v.owner_id || "" }))
        const suggested = v.risk_level ? RISK_TO_LEVEL[v.risk_level] : null
        if (suggested) setForm((f) => ({ ...f, type: suggested.type, level: suggested.level }))
      }
      apiFetch<{ items: IncidentOption[] }>(`/incidents?vehicle_id=${form.vehicle_id}&limit=10`).then((r) => setIncidents(r.items || [])).catch(() => {})
    }
  }, [form.vehicle_id, vehicles])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!form.vehicle_id) errors.vehicle_id = "Pilih kendaraan"
    if (!form.reason.trim()) errors.reason = "Alasan wajib diisi"
    if (form.reason.trim().length > 0 && form.reason.trim().length < 10) errors.reason = "Alasan minimal 10 karakter"
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setFieldErrors({})
    setSubmitting(true)
    setError("")
    try {
      await apiFetch("/sanctions", {
        method: "POST",
        body: JSON.stringify({
          vehicle_id: form.vehicle_id || null,
          owner_id: form.owner_id || null,
          type: form.type,
          level: form.level,
          reason: form.reason,
          incident_id: form.incident_id || null,
          effective_from: form.effective_from,
          effective_until: form.effective_until || null,
          notes: form.notes || null
        })
      })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat sanksi")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sanction-dialog-title" className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Gavel className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 id="sanction-dialog-title" className="text-lg font-bold text-zinc-100">Buat Sanksi Baru</h2>
              <p className="text-xs text-zinc-500">Semua sanksi memerlukan keputusan manual.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Kendaraan</label>
            <select className={`w-full bg-card border rounded-md px-3 py-2 text-sm text-zinc-300 ${fieldErrors.vehicle_id ? "border-red-500/50" : "border-border"}`} value={form.vehicle_id} onChange={(e) => { setForm({ ...form, vehicle_id: e.target.value }); setFieldErrors((p) => { const n = { ...p }; delete n.vehicle_id; return n }) }} required>
              <option value="">Pilih kendaraan...</option>
              {vehicles.map((v) => <option key={v.vehicle_id} value={v.vehicle_id}>{v.plate_no} {v.risk_level ? `(${label(RISK_LEVEL_LABEL, v.risk_level)})` : ""}</option>)}
            </select>
            {fieldErrors.vehicle_id && <p className="text-xs text-red-400 mt-1">{fieldErrors.vehicle_id}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Tipe Sanksi</label>
              <select className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-zinc-300" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="WARNING">Peringatan</option>
                <option value="COACHING">Pembinaan</option>
                <option value="ADMINISTRATIVE">Administratif</option>
                <option value="SUSPENSION">Penangguhan</option>
                <option value="REVOCATION">Pencabutan</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Level</label>
              <select className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-zinc-300" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                <option value="LOW">Rendah</option>
                <option value="MEDIUM">Sedang</option>
                <option value="HIGH">Tinggi</option>
                <option value="CRITICAL">Kritis</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Alasan *</label>
            <textarea className={`w-full bg-card border rounded-md px-3 py-2 text-sm text-zinc-300 min-h-[80px] ${fieldErrors.reason ? "border-red-500/50" : "border-border"}`} value={form.reason} onChange={(e) => { setForm({ ...form, reason: e.target.value }); setFieldErrors((p) => { const n = { ...p }; delete n.reason; return n }) }} placeholder="Alasan pemberian sanksi..." required />
            {fieldErrors.reason && <p className="text-xs text-red-400 mt-1">{fieldErrors.reason}</p>}
          </div>

          {incidents.length > 0 && (
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Link ke Incident (opsional)</label>
              <select className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-zinc-300" value={form.incident_id} onChange={(e) => setForm({ ...form, incident_id: e.target.value })}>
                <option value="">Tanpa link incident</option>
                {incidents.map((i) => <option key={i.incident_id} value={i.incident_id}>{label(INCIDENT_TYPE_LABEL, i.type)} ({label(INCIDENT_SEVERITY_LABEL, i.severity)}) — {label(INCIDENT_STATUS_LABEL, i.status)}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Berlaku Dari</label>
              <input type="date" className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-zinc-300" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Berlaku Sampai</label>
              <input type="date" className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-zinc-300" value={form.effective_until} onChange={(e) => setForm({ ...form, effective_until: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Catatan (opsional)</label>
            <textarea className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-zinc-300 min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Catatan tambahan..." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
              {submitting ? "Menyimpan..." : "Buat Sanksi"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-card/50 flex items-center justify-center mx-auto mb-4">
        <Gavel className="w-7 h-7 text-zinc-600" />
      </div>
      <div className="text-sm text-zinc-500">Belum ada sanksi.</div>
      <div className="text-xs text-zinc-600 mt-1">Buat sanksi baru untuk kendaraan atau pemilik yang bermasalah.</div>
    </div>
  )
}
