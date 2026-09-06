"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"

type AssignmentItem = {
  assignment_id: string
  plate_no?: string | null
  driver_name?: string | null
  imei_or_serial?: string | null
  shift_name?: string | null
  shift_start?: string | null
  shift_end?: string | null
  is_active?: boolean
}

type VehicleItem = {
  vehicle_id: string
  plate_no: string
}

type DriverItem = {
  driver_id: string
  name: string
}

type DeviceItem = {
  device_id: string
  imei_or_serial: string
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([])
  const [vehicles, setVehicles] = useState<VehicleItem[]>([])
  const [drivers, setDrivers] = useState<DriverItem[]>([])
  const [devices, setDevices] = useState<DeviceItem[]>([])
  const [form, setForm] = useState({
    vehicle_id: "",
    driver_id: "",
    device_id: "",
    shift_name: "Shift 1",
    shift_start: "05:00",
    shift_end: "13:00"
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const load = async () => {
    setError("")
    const [assignmentData, vehicleData, driverData, deviceData] = await Promise.all([
      apiFetch("/assignments"),
      apiFetch("/vehicles"),
      apiFetch("/drivers"),
      apiFetch("/devices")
    ])
    setAssignments(assignmentData.items || [])
    setVehicles(vehicleData.items || [])
    setDrivers(driverData.items || [])
    setDevices(deviceData.items || [])
  }

  useEffect(() => {
    let active = true
    const init = async () => {
      try {
        await load()
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Gagal memuat assignment")
      } finally {
        if (active) setLoading(false)
      }
    }
    init()
    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.vehicle_id) {
      setError("Pilih kendaraan terlebih dahulu.")
      return
    }
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      await apiFetch("/assignments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          driver_id: form.driver_id || null,
          device_id: form.device_id || null
        })
      })
      setSuccess("Assignment berhasil disimpan.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan assignment")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <section aria-label="Header assignments">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground">Penugasan driver dan device ke armada.</p>
        </div>
      </section>

      <section aria-label="Form tambah assignment">
        <form
          onSubmit={handleSubmit}
          className="bg-card/50 border border-border rounded-xl p-6 space-y-4"
        >
          <h2 className="font-semibold text-sm">Tambah Assignment</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <select
              className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              value={form.vehicle_id}
              onChange={(event) => setForm({ ...form, vehicle_id: event.target.value })}
            >
              <option value="">Pilih Armada</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                  {vehicle.plate_no}
                </option>
              ))}
            </select>
            <select
              className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              value={form.driver_id}
              onChange={(event) => setForm({ ...form, driver_id: event.target.value })}
            >
              <option value="">Pilih Driver</option>
              {drivers.map((driver) => (
                <option key={driver.driver_id} value={driver.driver_id}>
                  {driver.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              value={form.device_id}
              onChange={(event) => setForm({ ...form, device_id: event.target.value })}
            >
              <option value="">Pilih Device</option>
              {devices.map((device) => (
                <option key={device.device_id} value={device.device_id}>
                  {device.imei_or_serial}
                </option>
              ))}
            </select>
            <input
              aria-label="Nama shift"
              className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              placeholder="Shift"
              value={form.shift_name}
              onChange={(event) => setForm({ ...form, shift_name: event.target.value })}
            />
            <div className="flex gap-2">
              <input
                type="time"
                className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 w-full"
                value={form.shift_start}
                onChange={(event) => setForm({ ...form, shift_start: event.target.value })}
              />
              <input
                type="time"
                className="h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 w-full"
                value={form.shift_end}
                onChange={(event) => setForm({ ...form, shift_end: event.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="glow" size="sm" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Assignment"}
            </Button>
            {success && <span className="text-xs text-emerald-400">{success}</span>}
          </div>
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
              {error}
            </div>
          )}
        </form>
      </section>

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
      ) : (
        <section aria-label="Tabel assignments">
          <div className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 uppercase text-xs font-semibold text-zinc-400">
                <tr>
                  <th scope="col" className="px-6 py-4">Armada</th>
                  <th scope="col" className="px-6 py-4">Driver</th>
                  <th scope="col" className="px-6 py-4 hidden md:table-cell">Device</th>
                  <th scope="col" className="px-6 py-4">Shift</th>
                  <th scope="col" className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-3xl">📋</span>
                        <p className="text-sm">Belum ada assignment. Buat assignment baru di atas.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  assignments.map((assignment) => (
                    <tr key={assignment.assignment_id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{assignment.plate_no || "-"}</td>
                      <td className="px-6 py-4 text-zinc-400">{assignment.driver_name || "-"}</td>
                      <td className="px-6 py-4 text-zinc-400 hidden md:table-cell">{assignment.imei_or_serial || "-"}</td>
                      <td className="px-6 py-4 text-zinc-400">
                        {assignment.shift_name || "-"} {assignment.shift_start || ""} - {assignment.shift_end || ""}
                      </td>
                      <td className="px-6 py-4 text-emerald-400">{assignment.is_active ? "Active" : "Inactive"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
