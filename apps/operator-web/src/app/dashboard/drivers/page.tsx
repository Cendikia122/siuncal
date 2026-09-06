"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { RoleGate } from "@/components/auth/role-gate"
import { useAuth } from "@/hooks/use-auth"
import { Edit2, Trash2, Plus, X, Search, User } from "lucide-react"

type DriverItem = {
  driver_id: string
  name: string
  phone?: string | null
  sim_no?: string | null
  sim_expiry?: string | null
  status?: string | null
}

const initialForm = { name: "", phone: "", sim_no: "", sim_expiry: "" }

export default function DriversPage() {
  const { maskData } = useAuth()
  const [drivers, setDrivers] = useState<DriverItem[]>([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const load = useCallback(async () => {
    setError("")
    const data = await apiFetch("/drivers")
    // Mask sensitive data based on role
    const maskedDrivers = maskData(data.items || [], ["phone"])
    setDrivers(maskedDrivers)
  }, [maskData])

  useEffect(() => {
    let active = true
    const init = async () => {
      try {
        await load()
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Gagal memuat driver")
      } finally {
        if (active) setLoading(false)
      }
    }
    init()
    return () => {
      active = false
    }
  }, [load])

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Nama driver wajib diisi")
      return
    }

    setSaving(true)
    setError("")
    setSuccess("")
    try {
      if (editingId) {
        await apiFetch(`/drivers/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(form)
        })
        setSuccess("Driver berhasil diperbarui.")
      } else {
        await apiFetch("/drivers", {
          method: "POST",
          body: JSON.stringify(form)
        })
        setSuccess("Driver berhasil ditambahkan.")
      }
      setForm(initialForm)
      setEditingId(null)
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan driver")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (driver: DriverItem) => {
    setForm({
      name: driver.name,
      phone: driver.phone || "",
      sim_no: driver.sim_no || "",
      sim_expiry: driver.sim_expiry ? driver.sim_expiry.slice(0, 10) : ""
    })
    setEditingId(driver.driver_id)
    setShowForm(true)
    setError("")
    setSuccess("")
  }

  const handleDelete = async (driverId: string) => {
    if (!confirm("Yakin ingin menghapus driver ini?")) return

    setDeleting(driverId)
    setError("")
    try {
      await apiFetch(`/drivers/${driverId}`, { method: "DELETE" })
      setSuccess("Driver berhasil dihapus.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus driver")
    } finally {
      setDeleting(null)
    }
  }

  const handleCancel = () => {
    setForm(initialForm)
    setEditingId(null)
    setShowForm(false)
    setError("")
  }

  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (driver.phone && driver.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (driver.sim_no && driver.sim_no.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const getStatusColor = (status?: string | null) => {
    if (!status) return "text-zinc-400"
    switch (status.toUpperCase()) {
      case "ACTIVE": return "text-emerald-400"
      case "INACTIVE": return "text-zinc-500"
      case "SUSPENDED": return "text-red-400"
      default: return "text-zinc-400"
    }
  }

  return (
    <div className="p-6 space-y-6">
      <section aria-label="Header">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-teal-500/10 p-2">
              <User className="h-6 w-6 text-teal-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Manajemen Driver</h1>
              <p className="text-muted-foreground">Daftar driver yang terhubung dengan armada.</p>
            </div>
          </div>
          <RoleGate feature="master_data_write">
            {!showForm && (
              <Button type="button" variant="glow" size="sm" className="gap-2" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" />
                Tambah Driver
              </Button>
            )}
          </RoleGate>
        </div>
      </section>

      {/* Search Bar */}
      <section aria-label="Pencarian">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            aria-label="Cari driver"
            placeholder="Cari nama, telepon, atau SIM..."
            className="w-full h-10 bg-black/20 border border-white/10 rounded-md pl-10 pr-4 text-sm outline-none focus:border-emerald-500/50 focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Add/Edit Form */}
      <section aria-label="Form driver">
        <RoleGate feature="master_data_write">
          {showForm && (
            <form
              className="bg-card/50 border border-border rounded-xl p-6 space-y-4"
              onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {editingId ? "Ubah Driver" : "Tambah Driver Baru"}
                </h2>
                <Button type="button" variant="ghost" size="sm" onClick={handleCancel} aria-label="Tutup">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  aria-label="Nama Driver"
                  className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none"
                  placeholder="Nama Driver *"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
                <input
                  aria-label="No HP"
                  className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none"
                  placeholder="No HP"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
                <input
                  aria-label="No SIM"
                  className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none"
                  placeholder="No SIM"
                  value={form.sim_no}
                  onChange={(event) => setForm({ ...form, sim_no: event.target.value })}
                />
                <input
                  type="date"
                  aria-label="Tanggal Kadaluarsa SIM"
                  className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none"
                  placeholder="Tanggal Kadaluarsa SIM"
                  value={form.sim_expiry}
                  onChange={(event) => setForm({ ...form, sim_expiry: event.target.value })}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="glow" size="sm" onClick={handleSubmit} disabled={saving}>
                  {saving ? "Menyimpan..." : editingId ? "Update Driver" : "Simpan Driver"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                  Batal
                </Button>
              </div>
            </form>
          )}
        </RoleGate>
      </section>

      {/* Messages */}
      {success && (
        <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3">
          {success}
        </div>
      )}
      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
          {error}
        </div>
      )}

      {/* Table */}
      <section aria-label="Tabel driver">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="bg-zinc-900/30 border border-white/10 rounded-xl p-4">
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="bg-zinc-900/30 border border-white/10 rounded-xl p-8 text-center">
            <User className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-500">
              {searchQuery ? "Tidak ada driver yang cocok dengan pencarian." : "Belum ada data driver."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 uppercase text-xs font-semibold text-zinc-400">
                <tr>
                  <th scope="col" className="px-6 py-4">Nama</th>
                  <th scope="col" className="px-6 py-4 hidden md:table-cell">No HP</th>
                  <th scope="col" className="px-6 py-4 hidden md:table-cell">SIM</th>
                  <th scope="col" className="px-6 py-4 hidden md:table-cell">Kadaluarsa</th>
                  <th scope="col" className="px-6 py-4">Status</th>
                  <RoleGate feature="master_data_write">
                    <th scope="col" className="px-6 py-4 text-right">Aksi</th>
                  </RoleGate>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.driver_id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{driver.name}</td>
                    <td className="px-6 py-4 text-zinc-400 hidden md:table-cell">{driver.phone || "-"}</td>
                    <td className="px-6 py-4 text-zinc-400 hidden md:table-cell">{driver.sim_no || "-"}</td>
                    <td className="px-6 py-4 text-zinc-400 hidden md:table-cell">
                      {driver.sim_expiry ? new Date(driver.sim_expiry).toLocaleDateString() : "-"}
                    </td>
                    <td className={`px-6 py-4 ${getStatusColor(driver.status)}`}>
                      {driver.status || "ACTIVE"}
                    </td>
                    <RoleGate feature="master_data_write">
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEdit(driver)}
                            aria-label="Edit driver"
                          >
                            <Edit2 className="w-4 h-4 text-blue-400" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDelete(driver.driver_id)}
                            disabled={deleting === driver.driver_id}
                            aria-label="Hapus driver"
                          >
                            <Trash2 className={`w-4 h-4 ${deleting === driver.driver_id ? "text-zinc-500" : "text-red-400"}`} />
                          </Button>
                        </div>
                      </td>
                    </RoleGate>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Summary Stats */}
      <section aria-label="Ringkasan statistik">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900/30 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-zinc-400 mb-1">Total Driver</p>
            <p className="text-2xl font-bold text-white">{drivers.length}</p>
          </div>
          <div className="bg-zinc-900/30 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-zinc-400 mb-1">Aktif</p>
            <p className="text-2xl font-bold text-emerald-400">
              {drivers.filter(d => !d.status || d.status === "ACTIVE").length}
            </p>
          </div>
          <div className="bg-zinc-900/30 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-zinc-400 mb-1">SIM Akan Kadaluarsa</p>
            <p className="text-2xl font-bold text-orange-400">
              {drivers.filter(d => {
                if (!d.sim_expiry) return false
                const expiry = new Date(d.sim_expiry)
                const now = new Date()
                const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                return diffDays > 0 && diffDays <= 30
              }).length}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
