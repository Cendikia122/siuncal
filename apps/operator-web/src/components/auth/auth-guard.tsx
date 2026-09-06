"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth, FeatureKey } from "@/hooks/use-auth"

// Map paths to feature keys
const PATH_FEATURE_MAP: Record<string, FeatureKey> = {
  "/dashboard": "dashboard",
  "/dashboard/vehicles": "vehicles",
  "/dashboard/incidents": "incidents",
  "/dashboard/public-reports": "public_reports",
  "/dashboard/reports": "reports",
  "/dashboard/owners": "owners",
  "/dashboard/drivers": "drivers",
  "/dashboard/devices": "devices",
  "/dashboard/routes": "routes",
  "/dashboard/assignments": "assignments",
  "/dashboard/geofences": "geofences",
  "/dashboard/audit-logs": "audit_logs",
  "/dashboard/observability": "observability",
  "/dashboard/intelligence": "intelligence",
  "/dashboard/network": "network",
  "/dashboard/sanctions": "sanctions",
  "/dashboard/compliance": "compliance",
  "/dashboard/heatmap": "heatmap",
}

export function AuthGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, canAccess } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login")
    }
  }, [loading, router, user])

  useEffect(() => {
    if (!user || loading) return

    // Check feature access for current path
    const basePath = Object.keys(PATH_FEATURE_MAP)
      .sort((a, b) => b.length - a.length)
      .find((path) => pathname === path || pathname.startsWith(path + "/"))

    if (basePath) {
      const feature = PATH_FEATURE_MAP[basePath]
      if (!canAccess(feature)) {
        // Redirect to dashboard if no access
        router.replace("/dashboard")
      }
    }
  }, [pathname, router, user, loading, canAccess])

  return null
}
