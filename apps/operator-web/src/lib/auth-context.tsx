"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { apiFetch } from "@/lib/api"
import {
  canAccessFeature,
  hasAnyRole,
  maskSensitiveData,
  type FeatureKey,
  type UserRole,
} from "@/lib/auth-policy"

export type { FeatureKey, UserRole } from "@/lib/auth-policy"

export type User = {
  user_id: string
  username: string
  full_name: string
  email?: string | null
  role: UserRole
  roles?: string[]
  owner_id?: string | null
  active: boolean
}

type AuthContextType = {
  user: User | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  hasRole: (roles: UserRole | UserRole[]) => boolean
  canAccess: (feature: FeatureKey) => boolean
  maskData: <T>(data: T, sensitiveKeys: string[]) => T
}

type MeResponse = {
  user?: User | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setError(null)
      const data = await apiFetch<MeResponse>("/me")
      setUser(data.user || null)
    } catch (err) {
      setUser(null)
      setError(err instanceof Error ? err.message : "Failed to load user")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    return hasAnyRole(user, roles)
  }

  const canAccess = (feature: FeatureKey): boolean => {
    return canAccessFeature(user, feature)
  }

  const maskData = <T,>(data: T, sensitiveKeys: string[]): T => {
    return maskSensitiveData(data, sensitiveKeys, user)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        refresh,
        hasRole,
        canAccess,
        maskData,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Simple hook for role checking
export function useHasRole(roles: UserRole | UserRole[]): boolean {
  const { hasRole } = useAuth()
  return hasRole(roles)
}

// Simple hook for feature access
export function useCanAccess(feature: FeatureKey): boolean {
  const { canAccess } = useAuth()
  return canAccess(feature)
}
