"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { RoleGate } from "@/components/auth/role-gate"
import { Edit2, Trash2, Plus, X, Search, Cpu, Wifi, WifiOff, AlertTriangle } from "lucide-react"
import { DEVICE_STATUS_LABEL, DEVICE_HEALTH_LABEL, label } from "@/lib/labels"

type DeviceItem = {
  device_id: string
  device_type: string
  imei_or_serial: string
  provider?: string | null
  status: string
}

type DeviceHealthItem = {
  device_id: string
  imei_or_serial: string
  plate_no?: string | null
  route_id?: string | null
  last_ping?: string | null
  health: string
  minutes_since?: number | null
  reassignment_count_30d?: number | null
  no_telemetry?: boolean
  frequently_reassigned?: boolean
  impossible_movement_count_24h?: number
  power_disconnect_count_24h?: number
  last_power_disconnect_at?: string | null
  power_disconnect_then_lost_signal?: boolean
  repeated_identity_mismatch_count_24h?: number
  anomaly_candidate?: {
    rule: string
    status: string
    severity?: string
    reasons: string[]
    evidence?: Record<string, number>
  } | null
}

type DeviceHealthSummary = {
  total_devices: number
  online_devices: number
  offline_devices: number
  no_telemetry_devices: number
  frequently_reassigned_devices: number
  impossible_movement_devices?: number
  power_disconnect_lost_signal_devices?: number
  repeated_identity_mismatch_devices?: number
  device_tamper_candidates: number
  device_tamper_identity_mismatch_threshold?: number
  device_tamper_impossible_speed_kmh?: number
  offline_threshold_min: number
}

type DevicesResponse = {
  items?: DeviceItem[]
}

type DeviceHealthResponse = {
  items?: DeviceHealthItem[]
  summary?: DeviceHealthSummary
}

const DEVICE_TYPES = ["GPS_IOT", "SMARTPHONE", "OBD_TRACKER", "HYBRID"]
const initialForm = { device_type: "GPS_IOT", imei_or_serial: "", provider: "" }
const TAMPER_REASON_LABEL: Record<string, string> = {
  POWER_DISCONNECT_THEN_LOST_SIGNAL: "power lost + signal hilang",
  IMPOSSIBLE_MOVEMENT: "gerak tidak wajar",
  REPEATED_IDENTITY_MISMATCH: "identity mismatch berulang",
  ASSIGNED_DEVICE_WITHOUT_TELEMETRY: "assigned tanpa telemetry",
  FREQUENT_REASSIGNMENT: "sering reassigned"
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceItem[]>([])
  const [health, setHealth] = useState<DeviceHealthItem[]>([])
  const [healthSummary, setHealthSummary] = useState<DeviceHealthSummary | null>(null)
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"devices" | "health">("devices")

  const load = async () => {
    setError("")
    const [data, healthData] = await Promise.all([
      apiFetch<DevicesResponse>("/devices"),
      apiFetch<DeviceHealthResponse>("/devices/health")
    ])
    setDevices(data.items || [])
    setHealth(healthData.items || [])
    setHealthSummary(healthData.summary || null)
  }

  useEffect(() => {
    let active = true
    const init = async () => {
      try {
        await load()
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Gagal memuat device")
      } finally {
        if (active) setLoading(false)
      }
    }
    init()
    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async () => {
    if (!form.imei_or_serial.trim()) {
      setError("IMEI/Serial wajib diisi")
      return
    }

    setSaving(true)
    setError("")
    setSuccess("")
    try {
      if (editingId) {
        await apiFetch(`/devices/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(form)
        })
        setSuccess("Device berhasil diperbarui.")
      } else {
        await apiFetch("/devices", {
          method: "POST",
          body: JSON.stringify(form)
        })
        setSuccess("Device berhasil ditambahkan.")
      }
      setForm(initialForm)
      setEditingId(null)
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan device")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (device: DeviceItem) => {
    setForm({
      device_type: device.device_type,
      imei_or_serial: device.imei_or_serial,
      provider: device.provider || ""
    })
    setEditingId(device.device_id)
    setShowForm(true)
    setError("")
    setSuccess("")
  }

  const handleDelete = async (deviceId: string) => {
    if (!confirm("Yakin ingin menghapus device ini?")) return

    setDeleting(deviceId)
    setError("")
    try {
      await apiFetch(`/devices/${deviceId}`, { method: "DELETE" })
      setSuccess("Device berhasil dihapus.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus device")
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

  const filteredDevices = devices.filter(device =>
    device.imei_or_serial.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.device_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (device.provider && device.provider.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredHealth = health.filter(item =>
    item.imei_or_serial.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.plate_no && item.plate_no.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const onlineCount = health.filter(h => h.health === "ONLINE").length
  const offlineCount = health.filter(h => h.health === "OFFLINE").length

  return (
    <div className="p-6 space-y-6">
      <section aria-label="Header manajemen perangkat">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-500/10 p-2">
              <Cpu className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Manajemen Perangkat</h1>
              <p className="text-muted-foreground">Daftar perangkat GPS terdaftar dan status kesehatan.</p>
            </div>
          </div>
          <RoleGate feature="master_data_write">
            {!showForm && (
              <Button type="button" variant="glow" size="sm" className="gap-2" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" />
                Tambah Device
              </Button>
            )}
          </RoleGate>
        </div>
      </section>

      {/* Summary Stats */}
      <section aria-label="Ringkasan perangkat">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4">
            <p className="text-xs text-zinc-400 mb-1">Total Perangkat</p>
            <p className="text-2xl font-bold text-white">{devices.length}</p>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-zinc-400">Aktif</p>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{onlineCount}</p>
          </div>
          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-red-400" />
              <p className="text-xs text-zinc-400">Tidak Aktif</p>
            </div>
            <p className="text-2xl font-bold text-red-400">{offlineCount}</p>
          </div>
          <div className="bg-zinc-900/30 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <p className="text-xs text-zinc-400">Tamper Candidate</p>
            </div>
            <p className="text-2xl font-bold text-orange-400">
              {healthSummary?.device_tamper_candidates ?? health.filter((item) => item.anomaly_candidate).length}
            </p>
          </div>
        </div>
      </section>

      {activeTab === "health" && (
        <section aria-label="Sinyal kesehatan">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <HealthSignal
              label="Device tanpa telemetry"
              value={healthSummary?.no_telemetry_devices ?? health.filter((item) => item.no_telemetry).length}
              tone="critical"
            />
            <HealthSignal
              label="Sering reassigned"
              value={healthSummary?.frequently_reassigned_devices ?? health.filter((item) => item.frequently_reassigned).length}
              tone="warning"
            />
            <HealthSignal
              label="Gangguan Perangkat"
              value={healthSummary?.device_tamper_candidates ?? health.filter((item) => item.anomaly_candidate).length}
              tone={(healthSummary?.device_tamper_candidates ?? 0) > 0 ? "warning" : "neutral"}
            />
          </div>
        </section>
      )}

      {/* Search and Tabs */}
      <section aria-label="Pencarian dan tab">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Cari perangkat"
              placeholder="Cari IMEI, tipe, atau provider..."
              className="w-full h-10 bg-black/20 border border-white/10 rounded-md pl-10 pr-4 text-sm outline-none focus:border-emerald-500/50 focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={activeTab === "devices" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("devices")}
            >
              <Cpu className="w-4 h-4 mr-2" />
              Perangkat ({devices.length})
            </Button>
            <Button
              type="button"
              variant={activeTab === "health" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("health")}
            >
              <Wifi className="w-4 h-4 mr-2" />
              Kesehatan ({health.length})
            </Button>
          </div>
        </div>
      </section>

      {/* Add/Edit Form */}
      <RoleGate feature="master_data_write">
        {showForm && (
          <section aria-label="Form tambah atau edit perangkat">
            <div className="bg-card/50 border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  {editingId ? "Edit Device" : "Tambah Device Baru"}
                </h2>
                <Button type="button" variant="ghost" size="sm" onClick={handleCancel} aria-label="Tutup">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  value={form.device_type}
                  onChange={(event) => setForm({ ...form, device_type: event.target.value })}
                >
                  {DEVICE_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input
                  aria-label="IMEI atau Serial"
                  className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  placeholder="IMEI / Serial *"
                  value={form.imei_or_serial}
                  onChange={(event) => setForm({ ...form, imei_or_serial: event.target.value })}
                />
                <input
                  aria-label="Provider"
                  className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  placeholder="Provider"
                  value={form.provider}
                  onChange={(event) => setForm({ ...form, provider: event.target.value })}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="glow" size="sm" onClick={handleSubmit} disabled={saving}>
                  {saving ? "Menyimpan..." : editingId ? "Update Device" : "Simpan Device"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                  Batal
                </Button>
              </div>
            </div>
          </section>
        )}
      </RoleGate>

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

      {/* Content */}
      {loading ? (
        <section aria-label="Loading">
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="bg-zinc-900/30 border border-white/10 rounded-xl p-4">
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        </section>
      ) : activeTab === "devices" ? (
        /* Devices Table */
        filteredDevices.length === 0 ? (
          <section aria-label="Daftar perangkat">
            <div className="bg-zinc-900/30 border border-white/10 rounded-xl p-8 text-center">
              <Cpu className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-500">
                {searchQuery ? "Tidak ada device yang cocok dengan pencarian." : "Belum ada data device."}
              </p>
            </div>
          </section>
        ) : (
          <section aria-label="Daftar perangkat">
            <div className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/5 uppercase text-xs font-semibold text-zinc-400">
                  <tr>
                    <th scope="col" className="px-6 py-4">IMEI/Serial</th>
                    <th scope="col" className="px-6 py-4">Tipe</th>
                    <th scope="col" className="px-6 py-4 hidden md:table-cell">Provider</th>
                    <th scope="col" className="px-6 py-4">Status</th>
                    <RoleGate feature="master_data_write">
                      <th scope="col" className="px-6 py-4 text-right">Aksi</th>
                    </RoleGate>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredDevices.map((device) => (
                    <tr key={device.device_id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-white">{device.imei_or_serial}</td>
                      <td className="px-6 py-4 text-zinc-400">{device.device_type}</td>
                      <td className="px-6 py-4 text-zinc-400 hidden md:table-cell">{device.provider || "-"}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${device.status === "ASSIGNED" ? "bg-emerald-500/10 text-emerald-400" :
                            device.status === "AVAILABLE" ? "bg-blue-500/10 text-blue-400" :
                              "bg-zinc-500/10 text-zinc-400"
                          }`}>
                          {label(DEVICE_STATUS_LABEL, device.status)}
                        </span>
                      </td>
                      <RoleGate feature="master_data_write">
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleEdit(device)}
                              aria-label="Edit perangkat"
                            >
                              <Edit2 className="w-4 h-4 text-blue-400" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDelete(device.device_id)}
                              disabled={deleting === device.device_id}
                              aria-label="Hapus perangkat"
                            >
                              <Trash2 className={`w-4 h-4 ${deleting === device.device_id ? "text-zinc-500" : "text-red-400"}`} />
                            </Button>
                          </div>
                        </td>
                      </RoleGate>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      ) : (
        /* Health Monitor Table */
        filteredHealth.length === 0 ? (
          <section aria-label="Kesehatan perangkat">
            <div className="bg-zinc-900/30 border border-white/10 rounded-xl p-8 text-center">
              <Wifi className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-500">Belum ada data health.</p>
            </div>
          </section>
        ) : (
          <section aria-label="Kesehatan perangkat">
            <div className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/5 uppercase text-xs font-semibold text-zinc-400">
                  <tr>
                    <th scope="col" className="px-6 py-4">IMEI/Serial</th>
                    <th scope="col" className="px-6 py-4 hidden md:table-cell">Armada</th>
                    <th scope="col" className="px-6 py-4 hidden md:table-cell">Trayek</th>
                    <th scope="col" className="px-6 py-4">Last Ping</th>
                    <th scope="col" className="px-6 py-4">Status</th>
                    <th scope="col" className="px-6 py-4 hidden md:table-cell">Fraud Signals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredHealth.map((row) => (
                    <tr key={row.device_id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-white">{row.imei_or_serial}</td>
                      <td className="px-6 py-4 text-zinc-400 hidden md:table-cell">{row.plate_no || "-"}</td>
                      <td className="px-6 py-4 text-zinc-400 hidden md:table-cell">{row.route_id || "-"}</td>
                      <td className="px-6 py-4 text-zinc-400 font-mono text-xs">
                        {row.last_ping ? new Date(row.last_ping).toLocaleString() : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold ${row.health === "ONLINE" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                          }`}>
                          {row.health === "ONLINE" ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {label(DEVICE_HEALTH_LABEL, row.health)}
                          {row.minutes_since !== null && row.minutes_since !== undefined && <span className="text-zinc-500 ml-1">({row.minutes_since}m)</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <DeviceFraudSignals item={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      )}
    </div>
  )
}

function HealthSignal({ label, value, tone }: { label: string, value: string | number, tone: "neutral" | "warning" | "critical" }) {
  const styles = {
    neutral: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300",
    warning: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    critical: "border-red-500/20 bg-red-500/10 text-red-300"
  }

  return (
    <div className={`rounded-xl border p-4 ${styles[tone]}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-2 text-xl font-bold">{value}</div>
    </div>
  )
}

function DeviceFraudSignals({ item }: { item: DeviceHealthItem }) {
  const signals = Array.from(new Set([
    item.no_telemetry ? "no telemetry" : null,
    item.frequently_reassigned ? `${item.reassignment_count_30d || 0} reassignment/30d` : null,
    item.impossible_movement_count_24h ? `${item.impossible_movement_count_24h} impossible move/24h` : null,
    item.repeated_identity_mismatch_count_24h ? `${item.repeated_identity_mismatch_count_24h} identity mismatch/24h` : null,
    item.power_disconnect_then_lost_signal ? "power lost + signal hilang" : null,
    ...(item.anomaly_candidate?.reasons || []).map((reason) => TAMPER_REASON_LABEL[reason] || reason)
  ].filter((signal): signal is string => Boolean(signal))))

  if (!signals.length) {
    return <span className="text-xs text-zinc-500">-</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((signal) => (
        <span key={signal} className="text-[10px] px-2 py-1 rounded-md border border-orange-500/20 bg-orange-500/10 text-orange-300">
          {signal}
        </span>
      ))}
    </div>
  )
}
