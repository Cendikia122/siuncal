"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { ElementType, ReactNode } from "react"
import { Map, Route, BarChart3, AlertTriangle, LogOut, Users, Bus, MapPin, ShieldCheck, IdCard, RadioTower, Activity, Radar, MessageSquareWarning, Network, Gavel, ClipboardCheck, Flame, X, Gauge, Siren } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useAuthStore } from "@/store/auth-store"
import { useSidebarStore } from "@/store/sidebar-store"

type DashboardSummaryResponse = {
  incidents?: unknown[]
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [incidentCount, setIncidentCount] = useState(0)
  const clearAuth = useAuthStore((state) => state.clear)
  const canAccess = useAuthStore((state) => state.canAccess)
  const hasRole = useAuthStore((state) => state.hasRole)
  const mobileOpen = useSidebarStore((s) => s.mobileOpen)
  const closeMobile = useSidebarStore((s) => s.close)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const summary = await apiFetch<DashboardSummaryResponse>("/dashboard/summary")
        if (!active) return
        setIncidentCount((summary.incidents || []).length)
      } catch {
        if (!active) return
        setIncidentCount(0)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const isActive = (path: string) => {
    return pathname === path
  }

  const handleNavClick = () => {
    closeMobile()
  }

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={closeMobile} />
      )}
      <aside className={`fixed left-0 top-0 z-50 flex w-64 flex-col border-r border-white/8 bg-zinc-950 pt-16 [height:100dvh] transition-transform duration-200 md:z-40 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "hidden -translate-x-full md:flex"}`}>
        <div className="absolute right-3 top-3 md:hidden">
          <button onClick={closeMobile} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="shrink-0 border-b border-white/5 px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">SI UNCAL</div>
          <div className="mt-1 text-sm font-semibold text-white">Inteligensi Operasional</div>
          <div className="mt-1 text-xs leading-relaxed text-zinc-500">Monitoring, insiden, dan analisa armada.</div>
        </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 pb-8 [scrollbar-gutter:stable]">
        <NavGroup title="Operasi Harian" description="Pantau armada dan tangani insiden.">
        {canAccess("dashboard") && <NavItem href="/dashboard" icon={Map} label="Dashboard" active={isActive("/dashboard")} onClick={handleNavClick} />}
        {canAccess("incidents") && (
          <NavItem
            href="/dashboard/incidents"
            icon={AlertTriangle}
            label="Insiden"
            badge={incidentCount > 0 ? String(incidentCount) : undefined}
            active={isActive("/dashboard/incidents")}
            onClick={handleNavClick}
          />
        )}
        {canAccess("emergencies") && <NavItem href="/dashboard/emergencies" icon={Siren} label="Emergency" active={isActive("/dashboard/emergencies")} onClick={handleNavClick} />}
        {canAccess("public_reports") && <NavItem href="/dashboard/public-reports" icon={MessageSquareWarning} label="Laporan Publik" active={isActive("/dashboard/public-reports")} onClick={handleNavClick} />}
        {canAccess("vehicles") && <NavItem href="/dashboard/vehicles" icon={Bus} label="Armada" active={isActive("/dashboard/vehicles")} onClick={handleNavClick} />}
        {canAccess("telemetry_quality") && <NavItem href="/dashboard/telemetry-quality" icon={Gauge} label="Kualitas GPS" active={isActive("/dashboard/telemetry-quality")} onClick={handleNavClick} />}
        {canAccess("routes") && <NavItem href="/dashboard/routes" icon={Route} label="Trayek" active={isActive("/dashboard/routes")} onClick={handleNavClick} />}
        {canAccess("owners") && <NavItem href="/dashboard/owners" icon={Users} label="Pemilik" active={isActive("/dashboard/owners")} onClick={handleNavClick} />}
        {canAccess("reports") && <NavItem href="/dashboard/reports" icon={BarChart3} label="Laporan" active={isActive("/dashboard/reports")} onClick={handleNavClick} />}
        </NavGroup>

        {hasRole("ANALISA") && (
          <NavGroup title="Analisa & Kontrol" description="Investigasi, audit, dan konfigurasi.">
            {canAccess("devices") && <NavItem href="/dashboard/devices" icon={RadioTower} label="Perangkat" active={isActive("/dashboard/devices")} onClick={handleNavClick} />}
            {canAccess("observability") && <NavItem href="/dashboard/observability" icon={Activity} label="Observabilitas" active={isActive("/dashboard/observability")} onClick={handleNavClick} />}
            {canAccess("intelligence") && <NavItem href="/dashboard/intelligence" icon={Radar} label="Inteligensi" active={isActive("/dashboard/intelligence")} onClick={handleNavClick} />}
            {canAccess("network") && <NavItem href="/dashboard/network" icon={Network} label="Jaringan" active={isActive("/dashboard/network")} onClick={handleNavClick} />}
            {canAccess("sanctions") && <NavItem href="/dashboard/sanctions" icon={Gavel} label="Sanksi" active={isActive("/dashboard/sanctions")} onClick={handleNavClick} />}
            {canAccess("compliance") && <NavItem href="/dashboard/compliance" icon={ClipboardCheck} label="Kepatuhan" active={isActive("/dashboard/compliance")} onClick={handleNavClick} />}
            {canAccess("heatmap") && <NavItem href="/dashboard/heatmap" icon={Flame} label="Heatmap" active={isActive("/dashboard/heatmap")} onClick={handleNavClick} />}
            {canAccess("drivers") && <NavItem href="/dashboard/drivers" icon={IdCard} label="Driver" active={isActive("/dashboard/drivers")} onClick={handleNavClick} />}
            {canAccess("assignments") && <NavItem href="/dashboard/assignments" icon={Users} label="Penugasan" active={isActive("/dashboard/assignments")} onClick={handleNavClick} />}
            {canAccess("geofences") && <NavItem href="/dashboard/geofences" icon={MapPin} label="Geofence" active={isActive("/dashboard/geofences")} onClick={handleNavClick} />}
            {canAccess("audit_logs") && <NavItem href="/dashboard/audit-logs" icon={ShieldCheck} label="Log Audit" active={isActive("/dashboard/audit-logs")} onClick={handleNavClick} />}
          </NavGroup>
        )}

      </div>

      <div className="shrink-0 border-t border-white/5 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
          onClick={async () => {
            try {
              await apiFetch("/auth/logout", { method: "POST" })
            } finally {
              clearAuth()
              router.push("/auth/login")
            }
          }}
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
    </>
  )
}

function NavGroup({ title, description, children }: { title: string, description: string, children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="px-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-zinc-600">{description}</div>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function NavItem({ href, icon: Icon, label, active, badge, onClick }: { href: string, icon: ElementType, label: string, active?: boolean, badge?: string, onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${active
        ? "bg-emerald-500/10 text-emerald-400"
        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
        }`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      {badge && (
        <span className="bg-red-500/20 text-red-500 text-[10px] px-1.5 py-0.5 rounded-full border border-red-500/20">
          {badge}
        </span>
      )}
    </Link>
  )
}
