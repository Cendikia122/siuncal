"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle, Clock, Filter, MapPin, Search, User, ChevronRight } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { apiFetch, getRealtimeUrl, MOCK_MODE } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { useAuth } from "@/hooks/use-auth"
import { INCIDENT_STATUS_LABEL, INCIDENT_SEVERITY_LABEL, INCIDENT_TYPE_LABEL, label } from "@/lib/labels"
import { buildRealtimeFeedUrl } from "@/lib/realtime-feed"

type IncidentItem = {
  id: string
  type: string
  severity: string
  status: string
  description?: string | null
  timestamp?: string | null
  vehicle_plate?: string | null
  route_id?: string | null
  location?: string | null
  assigned_to?: string | null
  assigned_name?: string | null
}

type UserItem = {
  user_id: string
  full_name: string
}

type SlaItem = {
  incident_id: string
  type: string
  severity: string
  status: string
  created_at: string
  ack_minutes?: number | null
  resolve_minutes?: number | null
  ack_breached?: boolean
  resolve_breached?: boolean
  plate_no?: string | null
  route_id?: string | null
}

type ItemsResponse<T> = {
  items?: T[]
}

type SlaResponse = ItemsResponse<SlaItem> & {
  summary?: Record<string, unknown> | null
}

export default function IncidentsPage() {
  const { hasRole } = useAuth()
  const canViewSla = hasRole("ANALISA")
  const [incidents, setIncidents] = useState<IncidentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [slaError, setSlaError] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [severityFilter, setSeverityFilter] = useState("ALL")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [assignees, setAssignees] = useState<UserItem[]>([])
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({})
  const [slaItems, setSlaItems] = useState<SlaItem[]>([])
  const [slaSummary, setSlaSummary] = useState<Record<string, unknown> | null>(null)
  const [slaDate, setSlaDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [exportingSla, setExportingSla] = useState(false)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const buildIncidentListPath = useCallback(() => {
    const params = new URLSearchParams()
    if (statusFilter !== "ALL") params.set("status", statusFilter)
    if (severityFilter !== "ALL") params.set("severity", severityFilter)
    if (typeFilter !== "ALL") params.set("type", typeFilter)
    if (debouncedSearch) params.set("search", debouncedSearch)
    return `/incidents${params.toString() ? `?${params.toString()}` : ""}`
  }, [statusFilter, severityFilter, typeFilter, debouncedSearch])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setError("")
        const data = await apiFetch<ItemsResponse<IncidentItem>>(buildIncidentListPath())
        if (!active) return
        setIncidents(data.items || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat insiden")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [buildIncidentListPath])

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

  useEffect(() => {
    let active = true
    const loadSla = async () => {
      if (!canViewSla) {
        setSlaItems([])
        setSlaSummary(null)
        setSlaError("")
        return
      }
      try {
        setSlaError("")
        const data = await apiFetch<SlaResponse>(`/incidents/sla?date=${slaDate}`)
        if (!active) return
        setSlaItems(data.items || [])
        setSlaSummary(data.summary || null)
      } catch (err) {
        if (!active) return
        setSlaError(err instanceof Error ? err.message : "Gagal memuat SLA")
      }
    }
    loadSla()
    return () => {
      active = false
    }
  }, [slaDate, canViewSla])

  useEffect(() => {
    if (MOCK_MODE) return

    const wsUrl = buildRealtimeFeedUrl(getRealtimeUrl(), {
      incidentStatus: statusFilter,
      incidentSeverity: severityFilter,
      incidentType: typeFilter
    })
    const socket = new WebSocket(wsUrl)
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === "EVENT_NEW") {
          const reload = async () => {
            try {
              const data = await apiFetch<ItemsResponse<IncidentItem>>(buildIncidentListPath())
              setIncidents(data.items || [])
            } catch {
              setError("Gagal memuat insiden realtime")
            }
          }
          reload()
        }
      } catch {
        setError("Gagal memuat insiden realtime")
      }
    }
    return () => socket.close()
  }, [buildIncidentListPath, severityFilter, statusFilter, typeFilter])

  const handleAction = async (incidentId: string, action: string) => {
    setError("")
    try {
      const assigned_to = assignSelections[incidentId]
      if (action === "ASSIGN" && !assigned_to) {
        setError("Pilih petugas sebelum melakukan assign")
        return
      }
      await apiFetch(`/incidents/${incidentId}/actions`, {
        method: "POST",
        body: JSON.stringify({
          action,
          assigned_to: assigned_to || null
        })
      })
      const data = await apiFetch<ItemsResponse<IncidentItem>>(buildIncidentListPath())
      setIncidents(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui insiden")
    }
  }

  const totalToday = incidents.length
  const criticalCount = incidents.filter((incident) => incident.severity === "CRITICAL").length
  const inProgressCount = incidents.filter((incident) => incident.status === "IN_PROGRESS").length
  const resolvedCount = incidents.filter((incident) => incident.status === "RESOLVED").length
  const hasActiveFilter = statusFilter !== "ALL" || severityFilter !== "ALL" || typeFilter !== "ALL" || searchQuery.trim().length > 0

  const resetFilters = () => {
    setSearchQuery("")
    setDebouncedSearch("")
    setStatusFilter("ALL")
    setSeverityFilter("ALL")
    setTypeFilter("ALL")
  }

  const handleExportSla = () => {
    if (slaItems.length === 0) return
    setExportingSla(true)
    const headers = ["incident_id", "type", "severity", "status", "created_at", "ack_minutes", "resolve_minutes", "ack_breached", "resolve_breached", "plate_no", "route_id"]
    const rows = slaItems.map((item) =>
      [
        item.incident_id,
        item.type,
        item.severity,
        item.status,
        item.created_at,
        item.ack_minutes ?? "",
        item.resolve_minutes ?? "",
        item.ack_breached ? "YES" : "NO",
        item.resolve_breached ? "YES" : "NO",
        item.plate_no || "",
        item.route_id || ""
      ].join(",")
    )
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `incident-sla-${slaDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setExportingSla(false)
  }

  const handleExportSlaPdf = () => {
    if (slaItems.length === 0) return
    setExportingSla(true)
    const doc = new jsPDF()
    doc.text(`SLA Insiden - ${slaDate}`, 14, 16)
    autoTable(doc, {
      startY: 24,
      head: [["ID", "Type", "Severity", "Status", "Ack (m)", "Resolve (m)", "Plate", "Route"]],
      body: slaItems.map((item) => [
        item.incident_id,
        item.type,
        item.severity,
        item.status,
        item.ack_minutes ?? "-",
        item.resolve_minutes ?? "-",
        item.plate_no || "-",
        item.route_id || "-"
      ])
    })
    doc.save(`incident-sla-${slaDate}.pdf`)
    setExportingSla(false)
  }

  return (
    <section aria-label="Pusat Insiden" className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-red-500/10 p-2">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pusat Insiden</h1>
            <p className="text-muted-foreground">Monitoring dan penanganan anomali serta laporan darurat.</p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <section aria-label="Ringkasan Insiden" className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Insiden Hari Ini", value: String(totalToday), color: "text-white", border: "border-white/10 bg-zinc-900/50" },
          { label: "Insiden Kritis (SOS)", value: String(criticalCount), color: "text-red-500", border: "border-red-500/20 bg-red-500/5" },
          { label: "Sedang Ditangani", value: String(inProgressCount), color: "text-blue-500", border: "border-blue-500/20 bg-blue-500/5" },
          { label: "Selesai", value: String(resolvedCount), color: "text-emerald-500", border: "border-emerald-500/20 bg-emerald-500/5" },
        ].map((stat, i) => (
          <div key={i} className={`p-5 rounded-2xl border ${stat.border} relative overflow-hidden group`}>
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">{stat.label}</div>
            <div className={`text-3xl font-extrabold tracking-tight ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </section>

      {/* Filters */}
      <section aria-label="Filter dan Pencarian" className="flex flex-col md:flex-row md:items-center gap-3 bg-zinc-900/50 p-3 rounded-lg border border-white/5" data-tour="incident-filters">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            aria-label="Cari ID Insiden / Plat Nomor"
            placeholder="Cari ID Insiden / Plat Nomor..."
            className="w-full h-9 bg-black/20 border border-white/10 rounded-md pl-9 pr-4 text-sm outline-none focus:border-red-500/50 focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filter Status"
            className="h-9 px-3 rounded-md border border-white/10 bg-black/20 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">Semua Status</option>
            {Object.entries(INCIDENT_STATUS_LABEL).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
          <select
            aria-label="Filter Tingkat"
            className="h-9 px-3 rounded-md border border-white/10 bg-black/20 text-sm"
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
          >
            <option value="ALL">Semua Tingkat</option>
            {Object.entries(INCIDENT_SEVERITY_LABEL).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
          <select
            aria-label="Filter Tipe"
            className="h-9 px-3 rounded-md border border-white/10 bg-black/20 text-sm"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="ALL">Semua Tipe</option>
            {Object.entries(INCIDENT_TYPE_LABEL).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={resetFilters} disabled={!hasActiveFilter}>
            <Filter className="w-4 h-4" /> Reset Filter
          </Button>
        </div>
      </section>

      <section aria-label="Daftar Insiden" className="space-y-4" data-tour="incident-actions">
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Daftar Insiden Aktif</h2>
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="bg-zinc-900/30 border border-white/5 rounded-xl p-4">
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
            {error}
          </div>
        )}
        {incidents.map((incident) => (
          <div key={incident.id} className={`group rounded-2xl p-5 transition-all ${
            incident.severity === 'CRITICAL' ? 'bg-red-500/5 border border-red-500/20 hover:border-red-500/40' :
            incident.severity === 'HIGH' ? 'bg-orange-500/5 border border-orange-500/20 hover:border-orange-500/40' :
            'bg-zinc-900/40 border border-white/5 hover:border-white/20'
          }`}>
            <div className="flex flex-col md:flex-row items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                {/* Severity Indicator */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${incident.severity === 'CRITICAL' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                  incident.severity === 'HIGH' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                    'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                  }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-zinc-100">{label(INCIDENT_TYPE_LABEL, incident.type)}</h3>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${incident.severity === 'CRITICAL' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                      incident.severity === 'HIGH' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                        'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                      }`}>
                      {label(INCIDENT_SEVERITY_LABEL, incident.severity)}
                    </span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded border border-white/10 bg-black/20 text-zinc-300">
                      {label(INCIDENT_STATUS_LABEL, incident.status)}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-zinc-500">
                    ID: {incident.id.split('-')[0]}...
                  </div>
                </div>
              </div>

              <div className="text-xs text-zinc-400 flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                <Clock className="w-3.5 h-3.5" /> 
                {incident.timestamp ? new Date(incident.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "-"}
              </div>
            </div>

            <div className="mb-5 text-sm text-zinc-300 leading-relaxed pl-2 md:pl-16">
              {incident.description}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mb-5 pl-2 md:pl-16">
              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Kendaraan: <span className="text-zinc-200 font-medium">{incident.vehicle_plate || "-"}</span> (Trayek {incident.route_id || "-"})
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                Lokasi: <span className="text-zinc-200 font-medium">{incident.location}</span>
              </div>
              {incident.assigned_name && (
                <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                  <User className="w-3.5 h-3.5 text-purple-400" />
                  PIC: <span className="text-zinc-200 font-medium">{incident.assigned_name}</span>
                </div>
              )}
            </div>

            {/* Actions (Bottom Row) */}
            <div className="flex flex-col md:flex-row items-center justify-between pt-4 border-t border-white/5 pl-2 md:pl-16 gap-4">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {assignees.length > 0 && (
                  <select
                    aria-label="Pilih Petugas"
                    className="h-8 px-2 rounded-md border border-white/10 bg-black/20 text-xs focus:ring-1 focus:ring-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    value={assignSelections[incident.id] || ""}
                    onChange={(event) =>
                      setAssignSelections((prev) => ({ ...prev, [incident.id]: event.target.value }))
                    }
                  >
                    <option value="">Pilih Petugas...</option>
                    {assignees.map((user) => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                )}
                {incident.status === "OPEN" && (
                    <Button type="button" size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs" onClick={() => handleAction(incident.id, "ACKNOWLEDGE")}>
                      Akui
                    </Button>
                )}
                {incident.status !== "RESOLVED" && incident.status !== "FALSE_ALARM" && (
                  <>
                    <Button type="button" size="sm" variant="outline" className="h-8 text-xs bg-zinc-800" onClick={() => handleAction(incident.id, "ASSIGN")}>
                      Assign
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-8 text-xs bg-emerald-900/30 text-emerald-400 border-emerald-500/20 hover:bg-emerald-900/50 hover:text-emerald-300" onClick={() => handleAction(incident.id, "RESOLVE")}>
                      Selesaikan
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8 text-xs text-zinc-500 hover:text-white" onClick={() => handleAction(incident.id, "FALSE_ALARM")}>
                      Bukan Insiden
                    </Button>
                  </>
                )}
              </div>
              
              <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-white h-8 text-xs w-full md:w-auto flex items-center justify-center md:justify-end gap-1" asChild>
                <Link href={`/dashboard/incidents/${incident.id}`}>
                  Lihat Detail <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
        {!loading && !error && incidents.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-zinc-900/20 p-8 text-center">
            <div className="text-sm font-medium text-white">Belum ada insiden sesuai filter.</div>
            <div className="text-sm text-zinc-500 mt-1">
              Insiden hanya muncul setelah alert memenuhi rule eskalasi severity atau frekuensi.
            </div>
          </div>
        )}
      </section>

      <section aria-label="SLA Insiden" className="space-y-4" data-tour="incident-sla">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">SLA Insiden</h2>
            <p className="text-xs text-muted-foreground">Monitoring waktu respons dan resolusi.</p>
          </div>
          {canViewSla && (
          <div className="flex items-center gap-2">
            <input
              aria-label="Tanggal SLA"
              type="date"
              className="h-9 px-3 rounded-md border border-white/10 bg-black/20 text-sm"
              value={slaDate}
              onChange={(event) => setSlaDate(event.target.value)}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleExportSla} disabled={exportingSla}>
              {exportingSla ? "Mengekspor..." : "Ekspor CSV SLA"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleExportSlaPdf} disabled={exportingSla}>
              {exportingSla ? "Mengekspor..." : "Ekspor PDF SLA"}
            </Button>
          </div>
          )}
        </div>

        {!canViewSla && (
          <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-4 text-sm text-zinc-400">
            Laporan SLA tersedia untuk role Analisa.
          </div>
        )}

        {canViewSla && slaSummary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { label: "Total", value: slaSummary.total, color: "text-white" },
              { label: "Ack Breach", value: slaSummary.ack_breached, color: "text-orange-400" },
              { label: "Resolve Breach", value: slaSummary.resolve_breached, color: "text-red-400" },
              { label: "Belum Ack", value: slaSummary.missing_ack, color: "text-yellow-400" },
              { label: "Belum Resolve", value: slaSummary.missing_resolve, color: "text-zinc-400" }
            ].map((stat) => (
              <div key={stat.label} className="bg-zinc-900/40 border border-white/5 rounded-xl p-3">
                <div className="text-[10px] text-zinc-500 mb-1 uppercase">{stat.label}</div>
                <div className={`text-xl font-bold ${stat.color}`}>{String(stat.value ?? "-")}</div>
              </div>
            ))}
          </div>
        )}

        {canViewSla && slaError && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
            {slaError}
          </div>
        )}

        {canViewSla && (
        <div className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[600px]">
            <thead className="bg-white/5 uppercase text-[11px] font-bold text-zinc-500 tracking-wide">
              <tr>
                <th scope="col" className="px-6 py-4">Insiden</th>
                <th scope="col" className="px-6 py-4">Armada</th>
                <th scope="col" className="px-6 py-4 hidden md:table-cell">Ack (m)</th>
                <th scope="col" className="px-6 py-4 hidden md:table-cell">Resolve (m)</th>
                <th scope="col" className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {slaItems.map((item) => (
                <tr key={item.incident_id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-white font-medium">{label(INCIDENT_TYPE_LABEL, item.type)}</td>
                  <td className="px-6 py-4 text-zinc-400">{item.plate_no || "-"}</td>
                  <td className={`px-6 py-4 text-xs hidden md:table-cell ${item.ack_breached ? "text-orange-400" : "text-zinc-400"}`}>
                    {item.ack_minutes ?? "-"}
                  </td>
                  <td className={`px-6 py-4 text-xs hidden md:table-cell ${item.resolve_breached ? "text-red-400" : "text-zinc-400"}`}>
                    {item.resolve_minutes ?? "-"}
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-300">{label(INCIDENT_STATUS_LABEL, item.status)}</td>
                </tr>
              ))}
              {slaItems.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-center text-zinc-500 text-sm" colSpan={5}>
                    Belum ada data SLA.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </section>
  )
}
