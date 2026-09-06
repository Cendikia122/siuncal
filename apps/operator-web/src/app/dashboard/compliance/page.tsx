"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ClipboardCheck, Download, Users, ShieldCheck, AlertTriangle, TrendingUp, BarChart3 } from "lucide-react"
import { Pagination } from "@/components/ui/pagination"
import { RoleGate } from "@/components/auth/role-gate"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch, apiDownload } from "@/lib/api"
import { BarChartComponent, CHART_COLORS } from "@/components/charts/charts"

type ComplianceItem = {
  owner_id: string
  name: string
  owner_type: string
  status: string
  total_vehicles: number
  avg_risk_score: number
  incident_count_30d: number
  active_sanction_count: number
  compliance_score: number
}

type ComplianceSummary = {
  total_owners: number
  avg_compliance: number
  total_active_sanctions: number
  total_vehicles: number
}

type ComplianceResponse = {
  items: ComplianceItem[]
  summary: ComplianceSummary
}

const riskBadgeClass = (score: number) => {
  if (score >= 70) return "bg-red-500/10 text-red-400 border-red-500/20"
  if (score >= 40) return "bg-orange-500/10 text-orange-400 border-orange-500/20"
  if (score >= 20) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
  return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
}

const complianceBarColor = (score: number) => {
  if (score >= 80) return "bg-emerald-500"
  if (score >= 60) return "bg-yellow-500"
  if (score >= 40) return "bg-orange-500"
  return "bg-red-500"
}

export default function CompliancePage() {
  const [data, setData] = useState<ComplianceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const pageSize = 15

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const result = await apiFetch<ComplianceResponse>(`/compliance/fleet?sort=${sortDir}`)
        if (!active) return
        setData(result)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Gagal memuat data kepatuhan")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [sortDir])

  const chartData = data ? data.items.slice(0, 15).map((item) => ({
    name: item.name.length > 12 ? item.name.slice(0, 12) + "..." : item.name,
    compliance: item.compliance_score,
    risk: item.avg_risk_score
  })) : []

  return (
    <RoleGate roles="ANALISA" showDenied>
      <div className="p-6 space-y-6">
        <section aria-label="Header kepatuhan" data-tour="compliance-header">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Kepatuhan Armada</h1>
                <p className="text-sm text-muted-foreground">Dashboard kepatuhan armada per pemilik untuk laporan Dishub.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => apiDownload("/compliance/fleet/export?format=csv", "compliance-report.csv")}>
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => apiDownload("/compliance/fleet/export?format=pdf", "compliance-report.pdf")}>
                <Download className="w-4 h-4 mr-1" /> PDF
              </Button>
            </div>
          </div>
        </section>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">{error}</div>
        )}

        {loading ? (
          <section aria-label="Loading skeleton">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          </section>
        ) : data && (
          <>
            <section aria-label="Ringkasan kepatuhan">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SummaryCard icon={Users} label="Total Pemilik" value={data.summary.total_owners} colorClass="bg-emerald-500" />
                <SummaryCard icon={TrendingUp} label="Rata-rata Compliance" value={`${data.summary.avg_compliance}%`} colorClass="bg-blue-500" />
                <SummaryCard icon={AlertTriangle} label="Sanksi Aktif" value={data.summary.total_active_sanctions} colorClass="bg-red-500" />
                <SummaryCard icon={ShieldCheck} label="Total Kendaraan" value={data.summary.total_vehicles} colorClass="bg-indigo-500" />
              </div>
            </section>

            {chartData.length > 0 && (
              <section aria-label="Grafik compliance score">
                <div className="rounded-2xl border border-white/5 bg-zinc-900/30 p-6">
                  <h2 className="text-base font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    Compliance Score per Owner
                  </h2>
                  <BarChartComponent
                    data={chartData}
                    dataKeys={[
                      { key: "compliance", name: "Compliance", color: CHART_COLORS.primary },
                      { key: "risk", name: "Avg Risk", color: CHART_COLORS.danger }
                    ]}
                    height={300}
                  />
                </div>
              </section>
            )}

              <section aria-label="Ranking kepatuhan" data-tour="compliance-view">
              <div className="rounded-2xl border border-white/5 bg-zinc-900/30 overflow-x-auto">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between min-w-[700px]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-zinc-100">Ranking Kepatuhan</h2>
                      <p className="text-xs text-zinc-500">Klik baris untuk melihat detail owner.</p>
                    </div>
                  </div>
                  <select
                    className="bg-zinc-900 border border-white/10 rounded-md px-3 py-1.5 text-sm text-zinc-300"
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                  >
                    <option value="asc">Terburuk dulu</option>
                    <option value="desc">Terbaik dulu</option>
                  </select>
                </div>

                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[11px] text-zinc-500 uppercase font-bold tracking-wide">
                      <th scope="col" className="text-left px-4 py-3">#</th>
                      <th scope="col" className="text-left px-4 py-3">Pemilik</th>
                      <th scope="col" className="text-center px-4 py-3">Kendaraan</th>
                      <th scope="col" className="text-center px-4 py-3 hidden md:table-cell">Avg Risk</th>
                      <th scope="col" className="text-center px-4 py-3 hidden md:table-cell">Incident (30d)</th>
                      <th scope="col" className="text-center px-4 py-3 hidden md:table-cell">Sanksi Aktif</th>
                      <th scope="col" className="text-left px-4 py-3">Compliance Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.slice((page - 1) * pageSize, page * pageSize).map((item, idx) => (
                      <tr key={item.owner_id} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                        <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{(page - 1) * pageSize + idx + 1}</td>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/owners/${item.owner_id}`} className="hover:text-white transition-colors">
                            <div className="font-bold text-zinc-100">{item.name}</div>
                            <div className="text-xs text-zinc-500">{item.owner_type}</div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-300 font-mono">{item.total_vehicles}</td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded-md border ${riskBadgeClass(item.avg_risk_score)}`}>
                            {item.avg_risk_score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-300 font-mono hidden md:table-cell">{item.incident_count_30d}</td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {item.active_sanction_count > 0 ? (
                            <span className="text-xs px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 font-bold">{item.active_sanction_count}</span>
                          ) : (
                            <span className="text-xs text-zinc-600">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${complianceBarColor(item.compliance_score)}`} style={{ width: `${Math.min(100, item.compliance_score)}%` }} />
                            </div>
                            <span className="text-xs font-mono text-zinc-300 w-10 text-right">{item.compliance_score}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {data.items.length === 0 && (
                  <div className="p-12 text-center text-sm text-zinc-500">Belum ada data owner.</div>
                )}
                <Pagination page={page} pageSize={pageSize} total={data.items.length} onPageChange={setPage} />
              </div>
            </section>
          </>
        )}
      </div>
    </RoleGate>
  )
}

function SummaryCard({ icon: Icon, label, value, colorClass }: { icon: React.ElementType; label: string; value: number | string; colorClass: string }) {
  const textColor = colorClass.replace("bg-", "text-")
  const borderColor = colorClass.replace("bg-", "border-") + "/20"
  return (
    <div className={`rounded-2xl border ${borderColor} bg-zinc-900/40 p-5 hover:bg-zinc-900/60 transition-all`}>
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-3">
        <div className={`p-2 rounded-lg bg-black/40 border border-white/5 ${textColor}`}>
          <Icon className="w-4 h-4" />
        </div>
        {label}
      </div>
      <div className={`text-3xl font-bold tracking-tight ${textColor}`}>{value}</div>
    </div>
  )
}
