"use client"

import { ReactNode } from "react"
import { useAuth, FeatureKey, UserRole } from "@/hooks/use-auth"
import { ShieldAlert } from "lucide-react"

type RoleGateProps = {
  children: ReactNode
  feature?: FeatureKey
  roles?: UserRole | UserRole[]
  fallback?: ReactNode
  showDenied?: boolean
}

/**
 * RoleGate component
 * Conditionally renders children based on role/feature access
 * 
 * Usage:
 * <RoleGate feature="master_data_write">
 *   <Button>Edit Data</Button>
 * </RoleGate>
 * 
 * <RoleGate roles={["ADMIN", "ANALISA"]} showDenied>
 *   <AdminContent />
 * </RoleGate>
 */
export function RoleGate({
  children,
  feature,
  roles,
  fallback = null,
  showDenied = false
}: RoleGateProps) {
  const { user, canAccess, hasRole } = useAuth()

  if (!user) return <>{fallback}</>

  if (feature && !canAccess(feature)) {
    return showDenied ? <AccessDenied /> : <>{fallback}</>
  }

  if (roles && !hasRole(roles)) {
    return showDenied ? <AccessDenied /> : <>{fallback}</>
  }

  return <>{children}</>
}

function AccessDenied() {
  return (
    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
      <ShieldAlert className="w-4 h-4" />
      <span>Akses tidak diizinkan</span>
    </div>
  )
}

/**
 * useRoleGate hook
 * Returns boolean for conditional rendering with JSX
 */
export function useRoleGate(options: { feature?: FeatureKey; roles?: UserRole | UserRole[] }): boolean {
  const { user, canAccess, hasRole } = useAuth()

  if (!user) return false
  if (options.feature && !canAccess(options.feature)) return false
  if (options.roles && !hasRole(options.roles)) return false

  return true
}
