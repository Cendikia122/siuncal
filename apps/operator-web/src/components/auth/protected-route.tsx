"use client"

import { useAuth, FeatureKey, UserRole } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { ShieldAlert } from "lucide-react"

type ProtectedRouteProps = {
  children: ReactNode
  feature?: FeatureKey
  roles?: UserRole | UserRole[]
  fallback?: ReactNode
  redirectTo?: string
}

/**
 * ProtectedRoute component
 * Wraps content that requires authentication and/or specific role/feature access
 * 
 * Usage:
 * <ProtectedRoute feature="reports">
 *   <ReportsContent />
 * </ProtectedRoute>
 * 
 * <ProtectedRoute roles={["ADMIN", "ANALISA"]}>
 *   <AdminContent />
 * </ProtectedRoute>
 */
export function ProtectedRoute({
  children,
  feature,
  roles,
  fallback,
  redirectTo = "/auth/login",
}: ProtectedRouteProps) {
  const { user, loading, canAccess, hasRole } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace(redirectTo)
    }
  }, [loading, user, router, redirectTo])

  // Loading state
  if (loading) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="space-y-4 w-full max-w-md">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      )
    )
  }

  // Not authenticated
  if (!user) {
    return null // Will redirect
  }

  // Check feature access
  if (feature && !canAccess(feature)) {
    return <AccessDenied message="Anda tidak memiliki akses ke fitur ini." />
  }

  // Check role access
  if (roles && !hasRole(roles)) {
    return <AccessDenied message="Role Anda tidak diizinkan mengakses halaman ini." />
  }

  return <>{children}</>
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center max-w-md">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Akses Ditolak</h2>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  )
}

/**
 * RoleGate component
 * Conditionally renders children based on role/feature access
 * Does NOT redirect, just hides content
 * 
 * Usage:
 * <RoleGate feature="master_data_write">
 *   <Button>Edit Data</Button>
 * </RoleGate>
 */
type RoleGateProps = {
  children: ReactNode
  feature?: FeatureKey
  roles?: UserRole | UserRole[]
  fallback?: ReactNode
}

export function RoleGate({ children, feature, roles, fallback = null }: RoleGateProps) {
  const { user, canAccess, hasRole } = useAuth()

  if (!user) return <>{fallback}</>

  if (feature && !canAccess(feature)) {
    return <>{fallback}</>
  }

  if (roles && !hasRole(roles)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
