"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"

type AuditLogItem = {
  audit_id: string
  created_at: string
  action: string
  entity_type?: string | null
  entity_id?: string | null
  ip?: string | null
}

type AuditLogsResponse = {
  items?: AuditLogItem[]
  next_cursor?: string | null
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [cursor, setCursor] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState("")
  const [entityFilter, setEntityFilter] = useState("")

  const loadLogs = useCallback(async (reset = false) => {
    setError("")
    const params = new URLSearchParams()
    params.set("limit", "50")
    if (!reset && cursor) params.set("cursor", cursor)
    if (actionFilter) params.set("action", actionFilter)
    if (entityFilter) params.set("entity_type", entityFilter)

    const data = await apiFetch<AuditLogsResponse>(`/audit-logs?${params.toString()}`)
    if (reset) {
      setLogs(data.items || [])
    } else {
      setLogs((prev) => [...prev, ...(data.items || [])])
    }
    setCursor(data.next_cursor || null)
  }, [actionFilter, cursor, entityFilter])

  useEffect(() => {
    let active = true
    const init = async () => {
      try {
        await loadLogs(true)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Gagal memuat audit log")
      } finally {
        if (active) setLoading(false)
      }
    }
    init()
    return () => {
      active = false
    }
  }, [loadLogs])

  useEffect(() => {
    if (!loading) {
      loadLogs(true)
    }
  }, [actionFilter, entityFilter, loadLogs, loading])

  return (
    <div className="p-6 space-y-6">
      <section aria-label="Judul halaman">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">Catatan akses dan perubahan data sensitif.</p>
        </div>
      </section>

      <section aria-label="Filter audit log">
        <div className="flex flex-wrap gap-2 bg-zinc-900/50 p-3 rounded-lg border border-white/5">
          <input
            aria-label="Filter aksi"
            className="h-9 px-3 rounded-md border border-white/10 bg-black/20 text-sm"
            placeholder="Filter action (mis. CREATE_USER)"
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
          />
          <input
            aria-label="Filter entitas"
            className="h-9 px-3 rounded-md border border-white/10 bg-black/20 text-sm"
            placeholder="Filter entity (mis. vehicle)"
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => loadLogs(true)}>
            Refresh
          </Button>
        </div>
      </section>

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

      {!loading && (
        <section aria-label="Tabel audit log">
          <div className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 uppercase text-xs font-semibold text-zinc-400">
                <tr>
                  <th scope="col" className="px-6 py-4">Waktu</th>
                  <th scope="col" className="px-6 py-4">Action</th>
                  <th scope="col" className="px-6 py-4">Entity</th>
                  <th scope="col" className="px-6 py-4 hidden md:table-cell">Entity ID</th>
                  <th scope="col" className="px-6 py-4 hidden md:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.audit_id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-zinc-400 text-xs font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-white font-medium">{log.action}</td>
                    <td className="px-6 py-4 text-zinc-400">{log.entity_type || "-"}</td>
                    <td className="px-6 py-4 text-zinc-400 text-xs hidden md:table-cell">{log.entity_id || "-"}</td>
                    <td className="px-6 py-4 text-zinc-400 text-xs hidden md:table-cell">{log.ip || "-"}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td className="px-6 py-6 text-center text-zinc-500 text-sm" colSpan={5}>
                      Belum ada audit log.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-label="Load more">
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => loadLogs(false)} disabled={!cursor}>
            {cursor ? "Load More" : "Tidak ada data lagi"}
          </Button>
        </div>
      </section>
    </div>
  )
}
