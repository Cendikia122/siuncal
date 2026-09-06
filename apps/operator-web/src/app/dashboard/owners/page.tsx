"use client"

import { Button } from "@/components/ui/button"
import { Search, Plus, Phone, Building2, User, ShieldAlert, Siren, Edit, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { useAuth } from "@/hooks/use-auth"
import { OWNER_STATUS_LABEL, OWNER_TYPE_LABEL, label } from "@/lib/labels"

type OwnerItem = {
  owner_id: string
  name: string
  owner_type?: string | null
  status?: string | null
  phone_primary?: string | null
  total_fleet?: number | null
  active_fleet?: number | null
  avg_risk_score?: number | null
  high_risk_vehicle_count?: number | null
  critical_risk_vehicle_count?: number | null
  incident_count_7d?: number | null
}

export default function OwnersPage() {
  const { hasRole } = useAuth()
  const canManageOwners = hasRole("ANALISA")
  const [owners, setOwners] = useState<OwnerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editTarget, setEditTarget] = useState<OwnerItem | null>(null)
  const [editForm, setEditForm] = useState({ name: "", phone_primary: "", owner_type: "", status: "" })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [totalOwners, setTotalOwners] = useState(0)
  const pageSize = 12

  const loadOwners = async (targetPage = page) => {
    const params = new URLSearchParams({
      page: String(targetPage),
      limit: String(pageSize)
    })
    const query = searchQuery.trim()
    if (query) params.set("search", query)

    const data = await apiFetch<{ items: OwnerItem[]; total?: number }>(`/owners?${params.toString()}`)
    setOwners(data.items || [])
    setTotalOwners(data.total ?? data.items?.length ?? 0)
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError("")
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize)
        })
        const query = searchQuery.trim()
        if (query) params.set("search", query)

        const data = await apiFetch<{ items: OwnerItem[]; total?: number }>(`/owners?${params.toString()}`)
        if (!active) return
        setOwners(data.items || [])
        setTotalOwners(data.total ?? data.items?.length ?? 0)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat data pemilik")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [page, searchQuery])

  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  const openEdit = (owner: OwnerItem) => {
    setEditTarget(owner)
    setEditForm({ name: owner.name, phone_primary: owner.phone_primary || "", owner_type: owner.owner_type || "PERSONAL", status: owner.status || "PENDING" })
    setEditError("")
  }

  const closeEdit = () => {
    setEditTarget(null)
    setEditSaving(false)
    setEditError("")
  }

  const handleEditSave = async () => {
    if (!editTarget) return
    setEditSaving(true)
    setEditError("")
    try {
      await apiFetch(`/owners/${editTarget.owner_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          phone_primary: editForm.phone_primary || null,
          owner_type: editForm.owner_type,
          status: editForm.status,
        })
      })
      closeEdit()
      await loadOwners()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal menyimpan perubahan")
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <section aria-label="Data Pemilik dan Badan Usaha" className="p-6 space-y-6" data-tour="owners-overview">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" data-tour="owners-header">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-500/10 p-2">
            <Building2 className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Data Pemilik & Badan Usaha</h1>
            <p className="text-muted-foreground">Database pemilik angkot, koperasi, dan perusahaan.</p>
          </div>
        </div>
        {canManageOwners && (
          <Button variant="glow" size="sm" className="gap-2" asChild>
            <Link href="/dashboard/owners/new">
              <Plus className="w-4 h-4" /> Registrasi Pemilik Baru
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <section aria-label="Filter Pemilik" className="flex items-center gap-3 bg-card/50 p-3 rounded-lg border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            aria-label="Cari Nama / Badan Usaha"
            placeholder="Cari Nama / Badan Usaha..."
            className="w-full h-9 bg-secondary/50 border border-input rounded-md pl-9 pr-4 text-sm outline-none focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-emerald-500/50 text-foreground placeholder:text-muted-foreground"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </section>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="bg-card/50 border border-border rounded-xl p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
          {error}
        </div>
      )}

      {!loading && !error && owners.length === 0 && (
        <div className="text-center text-sm text-zinc-500 py-8 col-span-full">
          {searchQuery.trim() ? "Tidak ada pemilik yang cocok dengan pencarian." : "Belum ada data."}
        </div>
      )}
      <section aria-label="Daftar Pemilik" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {owners.map((owner) => (
          <div key={owner.owner_id} className="bg-card/50 border border-border rounded-xl p-6 hover:border-primary/20 transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {owner.owner_type === 'PERSONAL' ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                </div>
                <div>
                    <h2 className="font-bold">{owner.name}</h2>
                  <div className="text-xs text-muted-foreground uppercase font-medium">{label(OWNER_TYPE_LABEL, owner.owner_type)}</div>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full border ${owner.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                {label(OWNER_STATUS_LABEL, owner.status)}
              </span>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Armada</span>
                <span className="font-mono">{owner.total_fleet} Unit</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Armada Aktif</span>
                <span className="font-mono text-emerald-500">{owner.active_fleet} Unit</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <RiskMetric
                  icon={ShieldAlert}
                  label="Avg risk"
                  value={owner.avg_risk_score ?? "-"}
                  tone="neutral"
                />
                <RiskMetric
                  icon={ShieldAlert}
                  label="High/Critical"
                  value={`${owner.high_risk_vehicle_count || 0}/${owner.critical_risk_vehicle_count || 0}`}
                  tone={(owner.critical_risk_vehicle_count || 0) > 0 ? "critical" : "warning"}
                />
                <RiskMetric
                  icon={Siren}
                  label="Incident 7d"
                  value={owner.incident_count_7d || 0}
                  tone={(owner.incident_count_7d || 0) > 0 ? "critical" : "neutral"}
                />
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Kontak</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3 h-3" /> {owner.phone_primary || "-"}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button variant="outline" size="sm" className="w-full text-xs h-8" asChild>
                <Link href={`/dashboard/owners/${owner.owner_id}`}>Lihat Detail</Link>
              </Button>
              {canManageOwners && (
                <Button type="button" variant="outline" size="sm" className="text-xs h-8" aria-label="Edit pemilik" onClick={() => openEdit(owner)}>
                  <Edit className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>
      <Pagination page={page} pageSize={pageSize} total={totalOwners} onPageChange={setPage} />
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) closeEdit() }}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-owner-title" className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 id="edit-owner-title" className="text-lg font-bold">Edit Pemilik</h2>
                <p className="text-xs text-muted-foreground">{editTarget.name}</p>
              </div>
              <button type="button" aria-label="Tutup" onClick={closeEdit} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {editError && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3 mb-4">{editError}</div>}

            <form onSubmit={(e) => { e.preventDefault(); handleEditSave(); }} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Nama Pemilik</label>
                <input className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Tipe Pemilik</label>
                <select className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm" value={editForm.owner_type} onChange={(e) => setEditForm({ ...editForm, owner_type: e.target.value })}>
                  <option value="PERSONAL">Pribadi</option>
                  <option value="COOP">Koperasi</option>
                  <option value="COMPANY">Perusahaan</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">No. Telepon</label>
                <input className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm" value={editForm.phone_primary} onChange={(e) => setEditForm({ ...editForm, phone_primary: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Status</label>
                <select className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="PENDING">Pending</option>
                  <option value="VERIFIED">Terverifikasi</option>
                  <option value="SUSPENDED">Ditangguhkan</option>
                  <option value="INACTIVE">Nonaktif</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeEdit}>Batal</Button>
                <Button type="submit" disabled={editSaving}>
                  {editSaving ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

function RiskMetric({ icon: Icon, label, value, tone }: { icon: React.ElementType, label: string, value: string | number, tone: "neutral" | "warning" | "critical" }) {
  const styles = {
    neutral: "bg-zinc-900/60 text-zinc-300 border-white/10",
    warning: "bg-orange-500/10 text-orange-300 border-orange-500/20",
    critical: "bg-red-500/10 text-red-300 border-red-500/20"
  }

  return (
    <div className={`rounded-lg border px-2 py-2 ${styles[tone]}`}>
      <div className="flex items-center gap-1 text-[10px] text-current/70">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  )
}
