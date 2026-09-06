"use client"

import { useEffect } from "react"
import { apiFetch } from "@/lib/api"
import { AuthUser, useAuthStore, FeatureKey, UserRole } from "@/store/auth-store"

export function useAuth() {
  const { user, loading, setUser, setLoading, clear, hasRole, canAccess, maskData } = useAuthStore()

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        const profile = await apiFetch<AuthUser>("/me")
        if (!active) return
        setUser(profile)
      } catch {
        if (!active) return
        clear()
      } finally {
        if (active) setLoading(false)
      }
    }
    load()

    return () => {
      active = false
    }
  }, [setUser, setLoading, clear])

  return { user, loading, hasRole, canAccess, maskData }
}

// Convenience hooks
export function useHasRole(roles: UserRole | UserRole[]): boolean {
  const { hasRole } = useAuth()
  return hasRole(roles)
}

export function useCanAccess(feature: FeatureKey): boolean {
  const { canAccess } = useAuth()
  return canAccess(feature)
}

// Re-export types
export type { FeatureKey, UserRole } from "@/store/auth-store"
