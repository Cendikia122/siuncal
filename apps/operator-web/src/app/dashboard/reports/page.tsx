"use client"

import { Button } from "@/components/ui/button"
import { BarChart3, Calendar, Download, TrendingUp, PieChart as PieChartIcon, Activity } from "lucide-react"
import { useEffect, useState } from "react"
import { apiDownload, apiFetch } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChartComponent,
  PieChartComponent,
  AreaChartComponent,
  SEVERITY_COLORS,
  CHART_COLORS,
} from "@/components/charts/charts"
import { RoleGate } from "@/components/auth/role-gate"

type KpiItem = {
  title: string
  value: string
  trend: string
  trend_up: boolean
  color: string
}

type IncidentCategoryItem = {
  label: string
  val: number
}

type RitReportItem = {
  report_date: string
  vehicle_id: string
  plate_no: string
  route_id: string
  total_rit: number
}

type KpiResponse = {
  kpis?: KpiItem[]
  incidents_by_category?: IncidentCategoryItem[]
  date?: string | null
}

type RitResponse = {
  items?: RitReportItem[]
}

export default function ReportsPage() {
  const [kpis, setKpis] = useState<KpiItem[]>([])
  const [incidentsByCategory, setIncidentsByCategory] = useState<IncidentCategoryItem[]>([])
  const [reportDate, setReportDate] = useState<string | null>(null)
  const [ritReports, setRitReports] = useState<RitReportItem[]>([])
  const [ritHistory, setRitHistory] = useState<RitReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [dateRange, setDateRange] = useState(7)
  const [selectedReportDate, setSelectedReportDate] = useState("")

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        const data = await apiFetch<KpiResponse>("/reports/kpi")
        if (!active) return
        setKpis(data.kpis || [])
        setIncidentsByCategory(data.incidents_by_category || [])
        const activeReportDate = selectedReportDate || data.date || ""
        setReportDate(activeReportDate || null)
        const ritData = await apiFetch<RitResponse>(`/reports/rit${activeReportDate ? `?date=${activeReportDate}` : ""}`)
        setRitReports(ritData.items || [])
        const ritHistoryData = await apiFetch<RitResponse>(`/reports/rit?days=${dateRange}`)
        setRitHistory(ritHistoryData.items || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat laporan")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [dateRange, selectedReportDate])

  const handleExport = async () => {
    if (ritReports.length === 0) return
    try {
      setExporting(true)
      const dateQuery = reportDate ? `?date=${reportDate}&format=csv` : "?format=csv"
      await apiDownload(`/reports/rit/export${dateQuery}`, `rit-report-${reportDate || "latest"}.csv`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengekspor CSV")
    } finally {
      setExporting(false)
    }
  }

  const handleExportPdf = async () => {
    if (ritReports.length === 0) return
    try {
      setExportingPdf(true)
      const dateQuery = reportDate ? `?date=${reportDate}&format=pdf` : "?format=pdf"
      await apiDownload(`/reports/rit/export${dateQuery}`, `rit-report-${reportDate || "latest"}.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengekspor PDF")
    } finally {
      setExportingPdf(false)
    }
  }

  // Transform data for charts
  const ritChartData = buildRitChartData(ritHistory)
  const incidentPieData = incidentsByCategory.map((item) => ({
    name: item.label,
    value: item.val,
    color: SEVERITY_COLORS[item.label] || CHART_COLORS.muted,
  }))

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" data-tour="reports-header">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-sky-500/10 p-2">
            <BarChart3 className="h-6 w-6 text-sky-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Laporan Kinerja & Analisa</h1>
            <p className="text-muted-foreground">Rekapitulasi operasional harian dan evaluasi KPI trayek.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Date Range Selector */}
          <select
            className="h-9 px-3 rounded-md border border-white/10 bg-black/20 text-sm"
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
          >
            <option value={7}>7 Hari</option>
            <option value={14}>14 Hari</option>
            <option value={30}>30 Hari</option>
          </select>
          <label className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-zinc-300 focus-within:ring-2 focus-within:ring-emerald-500/50">
            <Calendar className="w-4 h-4" />
            <span className="sr-only">Tanggal laporan RIT</span>
            <input
              type="date"
              aria-label="Tanggal laporan RIT"
              className="bg-transparent text-sm outline-none [color-scheme:dark]"
              value={reportDate || ""}
              onChange={(event) => setSelectedReportDate(event.target.value)}
            />
          </label>
          <RoleGate feature="export_data" showDenied>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleExportPdf} disabled={exportingPdf || ritReports.length === 0}>
              <Download className="w-4 h-4" /> {exportingPdf ? "Mengekspor..." : "Export PDF"}
            </Button>
            <Button type="button" variant="glow" size="sm" className="gap-2" onClick={handleExport} disabled={exporting || ritReports.length === 0}>
              <Download className="w-4 h-4" /> {exporting ? "Mengekspor..." : "Export CSV"}
            </Button>
          </RoleGate>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4" data-tour="kpi-cards">
        {loading && (
          <>
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="bg-zinc-900/50 border border-white/5 rounded-xl p-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-20 mt-3" />
              </div>
            ))}
          </>
        )}
        {error && (
          <div className="col-span-full text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
            {error}
          </div>
        )}
        {!loading && kpis.length > 0 && kpis.map((kpi) => (
          <div key={kpi.title} className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-zinc-400 mb-1">{kpi.title}</p>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
            <p className={`text-xs mt-1 ${kpi.trend_up ? "text-emerald-400" : "text-red-400"}`}>
              {kpi.trend} <span className="text-zinc-500">vs report sebelumnya</span>
            </p>
          </div>
        ))}
        {!loading && !error && kpis.length === 0 && (
          <div className="col-span-full text-sm text-zinc-500 bg-zinc-900/50 border border-white/5 rounded-xl p-6">
            Belum ada KPI harian. Jalankan job report setelah simulator menghasilkan data.
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-tour="charts">
        {/* Daily Rit Bar Chart */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              Rit Harian
            </h2>
            <span className="text-xs text-zinc-500">{dateRange} hari terakhir</span>
          </div>
          {ritChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-zinc-500">
              Belum ada data rit mingguan.
            </div>
          ) : (
            <BarChartComponent
              data={ritChartData}
              dataKeys={[{ key: "total", color: CHART_COLORS.primary, name: "Total Rit" }]}
              height={280}
              valueFormatter={(v) => `${v} Rit`}
            />
          )}
        </div>

        {/* Incidents Pie Chart */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-blue-500" />
              Insiden Per Kategori
            </h2>
          </div>
          {incidentPieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-zinc-500">
              Belum ada data insiden.
            </div>
          ) : (
            <>
              <PieChartComponent
                data={incidentPieData}
                height={200}
                innerRadius={50}
                outerRadius={80}
              />
              <div className="mt-4 space-y-2">
                {incidentsByCategory.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: SEVERITY_COLORS[item.label] || CHART_COLORS.muted }}
                      />
                      <span className="text-zinc-300">{item.label}</span>
                    </div>
                    <span className="font-mono text-zinc-500">{item.val}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" />
            Tren Operasional
          </h2>
        </div>
        {ritChartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-zinc-500">
            Belum ada data tren.
          </div>
        ) : (
          <AreaChartComponent
            data={ritChartData}
            dataKeys={[
              { key: "total", color: CHART_COLORS.primary, name: "Total Rit" },
            ]}
            height={200}
          />
        )}
      </div>

      {/* Daily Rit Report Table */}
      <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Daily Rit Report
          </h2>
          <span className="text-xs text-zinc-500">{ritReports.length} data</span>
        </div>
        {ritReports.length === 0 ? (
          <div className="text-sm text-zinc-500">Belum ada data rit.</div>
        ) : (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 text-xs uppercase text-zinc-400">
                <tr>
                  <th scope="col" className="px-4 py-3">Tanggal</th>
                  <th scope="col" className="px-4 py-3">Armada</th>
                  <th scope="col" className="px-4 py-3">Trayek</th>
                  <th scope="col" className="px-4 py-3 text-right">Total Rit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {ritReports.map((item) => (
                  <tr key={`${item.report_date}-${item.vehicle_id}`} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-zinc-400">{item.report_date}</td>
                    <td className="px-4 py-3 text-white font-medium">{item.plate_no}</td>
                    <td className="px-4 py-3 text-zinc-400">{item.route_id}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-mono">
                        {item.total_rit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function buildRitChartData(
  rows: RitReportItem[]
): { name: string; total: number }[] {
  const totals = rows.reduce<Record<string, number>>((acc, row) => {
    const date = row.report_date
    if (!date) return acc
    acc[date] = (acc[date] || 0) + Number(row.total_rit || 0)
    return acc
  }, {})

  return Object.entries(totals)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, total]) => ({
      name: date.slice(5), // MM-DD format
      total,
    }))
}
