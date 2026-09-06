"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, Building2, Edit, FileText, User, Bus, ShieldAlert, Siren, Gavel } from "lucide-react"
import Link from "next/link"
import { use, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"
import { OWNER_STATUS_LABEL, INCIDENT_TYPE_LABEL, INCIDENT_SEVERITY_LABEL, INCIDENT_STATUS_LABEL, VEHICLE_STATUS_LABEL, label } from "@/lib/labels"
import { RiskBadge } from "@/components/ui/risk-badge"

type OwnerDetail = {
  owner_id: string
  owner_type: string
  name: string
  phone_primary?: string | null
  email?: string | null
  base_name?: string | null
  status: string
}

type OwnerVehicle = {
  vehicle_id: string
  plate_no: string
  route_id?: string | null
  status: string
  risk_score?: number | null
  risk_level?: string | null
  incident_count_7d?: number | null
}

type OwnerSanction = {
  sanction_id: string
  type: string
  level: string
  status: string
  reason: string
  effective_from: string
  effective_until: string | null
  decided_at: string
}

type OwnerDetailResponse = {
  owner: OwnerDetail
  vehicles?: OwnerVehicle[]
  risk_context?: OwnerRiskContext | null
  incidents_7d?: OwnerIncident[]
  active_sanctions?: OwnerSanction[]
  active_sanction_count?: number
}

type OwnerRiskContext = {
  total_vehicles: number
  avg_risk_score?: number | null
  high_risk_vehicle_count: number
  critical_risk_vehicle_count: number
  active_incident_count: number
  incident_count_7d: number
}

type OwnerIncident = {
  incident_id: string
  vehicle_id: string
  plate_no: string
  type: string
  severity: string
  status: string
  description?: string | null
  location_desc?: string | null
  created_at: string
}

export default function OwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Fix params unwrapping error in Next.js 15
  const unwrappedParams = use(params)
  const id = unwrappedParams.id
  const { hasRole } = useAuth()
  const canManageOwners = hasRole("ANALISA")

  const [owner, setOwner] = useState<OwnerDetail | null>(null)
  const [ownerVehicles, setOwnerVehicles] = useState<OwnerVehicle[]>([])
  const [riskContext, setRiskContext] = useState<OwnerRiskContext | null>(null)
  const [incidents7d, setIncidents7d] = useState<OwnerIncident[]>([])
  const [activeSanctions, setActiveSanctions] = useState<OwnerSanction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: "",
    phone_primary: "",
    email: "",
    base_name: "",
    status: ""
  })
  const [success, setSuccess] = useState("")

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const data = await apiFetch<OwnerDetailResponse>(`/owners/${id}`)
        if (!active) return
        setOwner(data.owner)
        setOwnerVehicles(data.vehicles || [])
        setRiskContext(data.risk_context || null)
        setIncidents7d(data.incidents_7d || [])
        setActiveSanctions(data.active_sanctions || [])
        setEditForm({
          name: data.owner?.name || "",
          phone_primary: data.owner?.phone_primary || "",
          email: data.owner?.email || "",
          base_name: data.owner?.base_name || "",
          status: data.owner?.status || ""
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat detail pemilik")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [id])

  const handleSave = async (override?: Partial<typeof editForm>) => {
    setError("")
    setSuccess("")
    try {
      await apiFetch(`/owners/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...editForm, ...override })
      })
      setSuccess("Profil pemilik berhasil diperbarui.")
      setEditing(false)
      const data = await apiFetch<OwnerDetailResponse>(`/owners/${id}`)
      setOwner(data.owner)
      setOwnerVehicles(data.vehicles || [])
      setRiskContext(data.risk_context || null)
      setIncidents7d(data.incidents_7d || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui pemilik")
    }
  }

  return (
    <div className="p-4 lg:p-5 max-w-7xl mx-auto space-y-4">
      {loading && (
        <div className="text-sm text-muted-foreground">Memuat detail pemilik...</div>
      )}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
          {error}
        </div>
      )}
      {!loading && !owner && !error && (
        <div className="text-sm text-muted-foreground">Data pemilik tidak ditemukan.</div>
      )}

      {activeSanctions.length > 0 && (
        <Link href={`/dashboard/sanctions?owner_id=${id}`} className="flex items-center gap-3 p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors">
          <Gavel className="w-4 h-4 text-yellow-400" />
          <span className="text-sm text-yellow-300 font-medium">Pemilik ini memiliki {activeSanctions.length} sanksi aktif</span>
        </Link>
      )}

      {owner && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/dashboard/owners">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                  {owner.owner_type === 'PERSONAL' ? <User className="w-6 h-6 text-muted-foreground" /> : <Building2 className="w-6 h-6 text-muted-foreground" />}
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">{owner.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold bg-secondary px-2 py-0.5 rounded text-muted-foreground uppercase">{label(OWNER_STATUS_LABEL, owner.owner_type)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border border-current ${owner.status === 'VERIFIED' ? 'text-emerald-500' : 'text-yellow-500'}`}>
                      {label(OWNER_STATUS_LABEL, owner.status)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {canManageOwners && (
                <Button type="button" variant="outline" className="gap-2" onClick={() => setEditing((prev) => !prev)}>
                  <Edit className="w-4 h-4" /> {editing ? "Batal" : "Edit Profil"}
                </Button>
              )}
              {canManageOwners && owner.status === "PENDING" && (
                <Button
                  type="button"
                  variant="glow"
                  className="gap-2"
                  onClick={() => handleSave({ status: "VERIFIED" })}
                >
                  Verifikasi
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.5fr] gap-4 border-t border-white/10 pt-4">
            <section className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Profil & Kontak
                </h2>
                <span className="text-xs text-muted-foreground">Data pemilik</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2 text-sm">
                <InfoRow label="Telepon" value={owner.phone_primary || "-"} />
                <InfoRow label="Email" value={owner.email || "-"} />
                <InfoRow label="Alamat" value={owner.base_name || "-"} />
                <InfoRow label="Status" value={owner.status || "-"} />
              </div>
            </section>

            {canManageOwners && (
              <OwnerSummaryCards riskContext={riskContext} />
            )}

            {canManageOwners && editing && (
              <section className="xl:col-span-2 bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-base">Edit Profil Pemilik</h3>
                  {success && <div className="text-xs text-emerald-400">{success}</div>}
                </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input
                      className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 w-full"
                      placeholder="Nama"
                      aria-label="Nama"
                      value={editForm.name}
                      onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                    />
                    <input
                      className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 w-full"
                      placeholder="Telepon"
                      aria-label="Telepon"
                      value={editForm.phone_primary}
                      onChange={(event) => setEditForm({ ...editForm, phone_primary: event.target.value })}
                    />
                    <input
                      className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 w-full"
                      placeholder="Email"
                      aria-label="Email"
                      value={editForm.email}
                      onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                    />
                    <input
                      className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 w-full"
                      placeholder="Base / Alamat"
                      aria-label="Base / Alamat"
                      value={editForm.base_name}
                      onChange={(event) => setEditForm({ ...editForm, base_name: event.target.value })}
                    />
                    <select
                      className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 w-full"
                      aria-label="Status"
                      value={editForm.status}
                      onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="VERIFIED">VERIFIED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                    <Button type="button" variant="glow" onClick={() => handleSave()} className="md:col-span-5 lg:col-span-1">
                      Simpan Perubahan
                    </Button>
                  </div>
              </section>
            )}

            <div className="xl:col-span-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <OwnerFleet vehicles={ownerVehicles} canManageOwners={canManageOwners} />
              {canManageOwners && (
                <OwnerRiskPanel vehicles={ownerVehicles} incidents={incidents7d} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  )
}

function OwnerFleet({ vehicles, canManageOwners }: { vehicles: OwnerVehicle[], canManageOwners: boolean }) {
  return (
    <section className="bg-card border border-border rounded-lg p-4 min-h-[280px]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <Bus className="w-4 h-4 text-orange-500" />
          Daftar Armada ({vehicles.length})
        </h3>
        {canManageOwners && (
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/vehicles">+ Tambah Armada</Link>
          </Button>
        )}
      </div>

      {vehicles.length > 0 ? (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {vehicles.map((vehicle) => (
            <VehicleRiskRow key={vehicle.vehicle_id} vehicle={vehicle} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground bg-secondary/20 rounded-lg border-dashed border border-border">
          Belum ada armada yang terdaftar atas nama pemilik ini.
        </div>
      )}
    </section>
  )
}

function OwnerSummaryCards({ riskContext }: { riskContext: OwnerRiskContext | null }) {
  const totalVehicles = riskContext?.total_vehicles || 0
  const highVehicles = riskContext?.high_risk_vehicle_count || 0
  const criticalVehicles = riskContext?.critical_risk_vehicle_count || 0
  const activeIncidents = riskContext?.active_incident_count || 0
  const incident7d = riskContext?.incident_count_7d || 0

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <RiskSummaryCard
        icon={ShieldAlert}
        label="Avg risk"
        value={riskContext?.avg_risk_score ?? "-"}
        tone="neutral"
        helper={`${totalVehicles} armada terdaftar`}
        footerLabel="Incident aktif"
        footerValue={activeIncidents}
      />
      <RiskSummaryCard
        icon={ShieldAlert}
        label="High"
        value={highVehicles}
        tone="warning"
        helper={totalVehicles ? `${Math.round((highVehicles / totalVehicles) * 100)}% dari armada` : "Tidak ada armada high"}
        footerLabel="Total armada"
        footerValue={totalVehicles}
      />
      <RiskSummaryCard
        icon={ShieldAlert}
        label="Critical"
        value={criticalVehicles}
        tone="critical"
        helper={criticalVehicles > 0 ? "Butuh prioritas inspeksi" : "Tidak ada critical"}
        footerLabel="High + critical"
        footerValue={highVehicles + criticalVehicles}
      />
      <RiskSummaryCard
        icon={Siren}
        label="Incident 7 hari"
        value={incident7d}
        tone="critical"
        helper={activeIncidents > 0 ? `${activeIncidents} masih open` : "Tidak ada incident aktif"}
        footerLabel="Open incident"
        footerValue={activeIncidents}
      />
    </section>
  )
}

function OwnerRiskPanel({ vehicles, incidents }: { vehicles: OwnerVehicle[], incidents: OwnerIncident[] }) {
  const highRiskVehicles = vehicles.filter((vehicle) => vehicle.risk_level === "HIGH" || vehicle.risk_level === "CRITICAL")

  return (
    <>
      <section className="rounded-lg border border-white/10 bg-zinc-900/30 overflow-hidden min-h-[280px]">
        <div className="px-4 py-3 border-b border-white/10 font-semibold text-base">Kendaraan Bermasalah</div>
        <div className="divide-y divide-white/5 max-h-[360px] overflow-y-auto">
          {highRiskVehicles.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">Belum ada kendaraan high/critical.</div>
          ) : highRiskVehicles.map((vehicle) => (
            <VehicleRiskRow key={vehicle.vehicle_id} vehicle={vehicle} compact />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-zinc-900/30 overflow-hidden min-h-[280px]">
        <div className="px-4 py-3 border-b border-white/10 font-semibold text-base">Incident 7 Hari</div>
        <div className="divide-y divide-white/5 max-h-[360px] overflow-y-auto">
          {incidents.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">Tidak ada incident 7 hari terakhir.</div>
          ) : incidents.map((incident) => (
            <div key={incident.incident_id} className="p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/dashboard/incidents/${incident.incident_id}`} className="font-semibold text-white hover:text-emerald-400">
                    {label(INCIDENT_TYPE_LABEL, incident.type)}
                  </Link>
                  <div className="text-xs text-zinc-500 truncate">{incident.plate_no} · {incident.location_desc || "-"}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-md bg-red-500/10 text-red-300 border border-red-500/20">
                  {label(INCIDENT_SEVERITY_LABEL, incident.severity)}
                </span>
              </div>
              <div className="text-xs text-zinc-500">{new Date(incident.created_at).toLocaleString()} · {label(INCIDENT_STATUS_LABEL, incident.status)}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function VehicleRiskRow({ vehicle, compact = false }: { vehicle: OwnerVehicle, compact?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 bg-secondary/30 border border-border rounded-lg hover:border-primary/50 transition-colors ${compact ? "p-3 m-3" : "p-3"}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-md bg-zinc-800 flex items-center justify-center font-bold text-white text-xs shrink-0">
          {vehicle.route_id}
        </div>
        <div className="min-w-0">
          <Link href={`/dashboard/vehicles/${vehicle.vehicle_id}`} className="font-bold hover:text-emerald-400">
            {vehicle.plate_no}
          </Link>
          <div className="text-xs text-muted-foreground truncate">ID: {vehicle.vehicle_id}</div>
        </div>
      </div>
      <div className="text-right space-y-1 shrink-0">
        <span className={`text-xs px-2 py-1 rounded-full border ${vehicle.status === 'IN_SERVICE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-300'}`}>
          {label(VEHICLE_STATUS_LABEL, vehicle.status)}
        </span>
        <RiskBadge score={vehicle.risk_score} level={vehicle.risk_level} />
      </div>
    </div>
  )
}

function RiskSummaryCard({
  icon: Icon,
  label,
  value,
  tone,
  helper,
  footerLabel,
  footerValue
}: {
  icon: React.ElementType
  label: string
  value: string | number
  tone: "neutral" | "warning" | "critical"
  helper: string
  footerLabel: string
  footerValue: string | number
}) {
  const styles = {
    neutral: {
      root: "bg-zinc-900/30 text-zinc-300 border-white/10",
      bar: "bg-zinc-500/40",
      chip: "bg-white/5 text-zinc-300 border-white/10"
    },
    warning: {
      root: "bg-orange-500/10 text-orange-300 border-orange-500/20",
      bar: "bg-orange-400/50",
      chip: "bg-orange-400/10 text-orange-200 border-orange-400/20"
    },
    critical: {
      root: "bg-red-500/10 text-red-300 border-red-500/20",
      bar: "bg-red-400/50",
      chip: "bg-red-400/10 text-red-200 border-red-400/20"
    }
  }
  const numericValue = typeof value === "number" ? value : Number(value)
  const barWidth = Number.isFinite(numericValue) ? Math.min(100, Math.max(8, numericValue)) : 8

  return (
    <div className={`rounded-lg border p-3 min-h-[116px] flex flex-col justify-between ${styles[tone].root}`}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs opacity-85">
            <Icon className="w-4 h-4" />
            {label}
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles[tone].chip}`}>
            {footerValue}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-[11px] text-right opacity-75 leading-snug">{helper}</div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/25">
          <div className={`h-full rounded-full ${styles[tone].bar}`} style={{ width: `${barWidth}%` }} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] opacity-80">
        <span>{footerLabel}</span>
        <span className="font-semibold">{footerValue}</span>
      </div>
    </div>
  )
}

