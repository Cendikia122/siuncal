"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Search, Filter, MoreHorizontal, Bus, Gauge, Eye } from "lucide-react"
import { Pagination } from "@/components/ui/pagination"
import Link from "next/link"
import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { VEHICLE_STATUS_LABEL, label } from "@/lib/labels"
import { RiskBadge } from "@/components/ui/risk-badge"
import { VEHICLE_STATUS_COLORS, STATUS_MUTED } from "@/lib/status-colors"
import { Skeleton } from "@/components/ui/skeleton"
import { RoleGate } from "@/components/auth/role-gate"

type VehicleItem = {
  vehicle_id: string
  plate_no: string
  route_id: string
  vehicle_code?: string | null
  owner_name?: string | null
  status: string
  speed?: number
  last_ping?: string | null
  risk_score?: number | null
  risk_level?: string | null
}

type OwnerItem = {
  owner_id: string
  name: string
}

type RouteItem = {
  route_id: string
  name: string
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleItem[]>([])
  const [owners, setOwners] = useState<OwnerItem[]>([])
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [form, setForm] = useState({
    owner_id: "",
    plate_no: "",
    route_id: "",
    vehicle_code: ""
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [routeFilter, setRouteFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [totalVehicles, setTotalVehicles] = useState(0)
  const pageSize = 15

  const loadVehicles = async (targetPage = page) => {
    const params = new URLSearchParams({
      page: String(targetPage),
      limit: String(pageSize)
    })
    const query = searchQuery.trim()
    if (query) params.set("search", query)
    if (routeFilter !== "ALL") params.set("route_id", routeFilter)

    const data = await apiFetch<{ items: VehicleItem[]; total?: number }>(`/vehicles?${params.toString()}`)
    setVehicles(data.items || [])
    setTotalVehicles(data.total ?? data.items?.length ?? 0)
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [ownerData, routeData] = await Promise.all([
          apiFetch<{ items: OwnerItem[] }>("/owners"),
          apiFetch<{ items: RouteItem[] }>("/routes")
        ])
        if (!active) return
        setOwners(ownerData.items || [])
        setRoutes(routeData.items || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat data referensi armada")
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

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
        if (routeFilter !== "ALL") params.set("route_id", routeFilter)

        const data = await apiFetch<{ items: VehicleItem[]; total?: number }>(`/vehicles?${params.toString()}`)
        if (!active) return
        setVehicles(data.items || [])
        setTotalVehicles(data.total ?? data.items?.length ?? 0)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat data armada")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [page, searchQuery, routeFilter])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, routeFilter])

  const handleCreate = async () => {
    if (!form.owner_id || !form.plate_no.trim() || !form.route_id) {
      setError("Pemilik, plat nomor, dan trayek wajib diisi.")
      return
    }
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      await apiFetch("/vehicles", {
        method: "POST",
        body: JSON.stringify(form)
      })
      setSuccess("Armada berhasil ditambahkan.")
      setForm({ owner_id: "", plate_no: "", route_id: "", vehicle_code: "" })
      await loadVehicles(1)
      setPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah armada")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label="Data Armada" className="p-6 space-y-6" data-tour="vehicles-master">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" data-tour="vehicles-header">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2">
            <Bus className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Data Armada</h1>
            <p className="text-muted-foreground">Kelola dan pantau seluruh angkutan kota yang terdaftar.</p>
          </div>
        </div>
        <RoleGate feature="master_data_write">
          <Button type="button" variant="glow" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Tutup Form" : "+ Daftarkan Armada"}
          </Button>
        </RoleGate>
      </div>

      <RoleGate feature="master_data_write">
        {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="bg-card/50 border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-sm">Tambah Armada</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              aria-label="Pilih Pemilik"
              className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              value={form.owner_id}
              onChange={(event) => setForm({ ...form, owner_id: event.target.value })}
            >
              <option value="">Pilih Pemilik</option>
              {owners.map((owner) => (
                <option key={owner.owner_id} value={owner.owner_id}>
                  {owner.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Plat Nomor"
              className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              placeholder="Plat Nomor"
              value={form.plate_no}
              onChange={(event) => setForm({ ...form, plate_no: event.target.value })}
            />
            <select
              aria-label="Pilih Trayek"
              className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              value={form.route_id}
              onChange={(event) => setForm({ ...form, route_id: event.target.value })}
            >
              <option value="">Pilih Trayek</option>
              {routes.map((route) => (
                <option key={route.route_id} value={route.route_id}>
                  {route.route_id} - {route.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Kode Armada"
              className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              placeholder="Kode Armada"
              value={form.vehicle_code}
              onChange={(event) => setForm({ ...form, vehicle_code: event.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
              <Button type="submit" variant="glow" size="sm" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Armada"}
              </Button>
              {success && <span className="text-xs text-emerald-400">{success}</span>}
            </div>
          </form>
        )}
      </RoleGate>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 bg-zinc-900/50 p-3 rounded-lg border border-white/5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            aria-label="Cari Plat Nomor / Pemilik"
            placeholder="Cari Plat Nomor / Pemilik..."
            className="w-full h-9 bg-black/20 border border-white/10 rounded-md pl-9 pr-4 text-sm outline-none focus:border-emerald-500/50 focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <div className="relative w-full md:w-52">
          <Filter className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <select
            aria-label="Filter Trayek"
            className="w-full h-9 bg-black/20 border border-white/10 rounded-md pl-9 pr-3 text-sm outline-none focus:border-emerald-500/50 focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            value={routeFilter}
            onChange={(event) => setRouteFilter(event.target.value)}
          >
            <option value="ALL">Semua Trayek</option>
            {routes.map((route) => (
              <option key={route.route_id} value={route.route_id}>
                {route.route_id} - {route.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="bg-zinc-900/30 border border-white/10 rounded-xl p-4">
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[800px]">
          <thead className="bg-white/5 uppercase text-[11px] font-bold text-zinc-500 tracking-wide">
            <tr>
              <th scope="col" className="px-6 py-4">Info Kendaraan</th>
              <th scope="col" className="px-6 py-4 hidden sm:table-cell">Trayek</th>
              <th scope="col" className="px-6 py-4 hidden md:table-cell">Pemilik</th>
              <th scope="col" className="px-6 py-4">Status</th>
              <th scope="col" className="px-6 py-4 hidden lg:table-cell">Risk Score</th>
              <th scope="col" className="px-6 py-4 hidden xl:table-cell">Update Terakhir</th>
              <th scope="col" className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.vehicle_id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                      <Bus className="w-4 h-4" />
                    </div>
                    <div>
                      <Link href={`/dashboard/vehicles/${vehicle.vehicle_id}`} className="font-bold text-white hover:text-emerald-400 transition-colors">
                        {vehicle.plate_no}
                      </Link>
                      <div className="text-xs text-zinc-500">ID: {vehicle.vehicle_id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 hidden sm:table-cell">
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 border border-zinc-700">
                    Trayek {vehicle.route_id}
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-zinc-300 hidden md:table-cell">
                  {vehicle.owner_name}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={vehicle.status} speed={vehicle.speed} />
                </td>
                <td className="px-6 py-4 hidden lg:table-cell">
                  <RiskBadge score={vehicle.risk_score} level={vehicle.risk_level} />
                </td>
                <td className="px-6 py-4 text-zinc-400 font-mono text-xs hidden xl:table-cell">
                  {vehicle.last_ping ? new Date(vehicle.last_ping).toLocaleTimeString() : "-"}
                </td>
                <td className="px-6 py-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Aksi untuk ${vehicle.plate_no}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/vehicles/${vehicle.vehicle_id}`}>
                          <Eye className="h-4 w-4" />
                          Lihat detail
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {vehicles.length === 0 && !loading && (
          <div className="text-center text-sm text-zinc-500 py-8">
            {searchQuery.trim() || routeFilter !== "ALL" ? "Tidak ada armada yang cocok dengan filter." : "Belum ada data."}
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={totalVehicles} onPageChange={setPage} />
      </div>
    </section>
  )
}

function StatusBadge({ status, speed }: { status: string, speed?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${VEHICLE_STATUS_COLORS[status] ?? STATUS_MUTED}`}>
        {label(VEHICLE_STATUS_LABEL, status)}
      </span>
      {status === 'IN_SERVICE' && speed !== undefined && (
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Gauge className="w-3 h-3" /> {speed} km/h
        </div>
      )}
    </div>
  )
}
