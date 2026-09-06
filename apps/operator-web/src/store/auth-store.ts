import { create } from "zustand"
import {
  canAccessFeature,
  hasAnyRole,
  maskSensitiveData,
  type FeatureKey,
  type UserRole,
} from "@/lib/auth-policy"

export type { FeatureKey, UserRole } from "@/lib/auth-policy"

export type AuthUser = {
  user_id: string
  username?: string
  email: string
  full_name: string
  role: UserRole
  roles: string[] // Legacy support
  owner_id?: string | null
  active?: boolean
}

type AuthState = {
  user: AuthUser | null
  loading: boolean
  setUser: (user: AuthUser) => void
  setLoading: (loading: boolean) => void
  clear: () => void
  hasRole: (roles: UserRole | UserRole[]) => boolean
  canAccess: (feature: FeatureKey) => boolean
  maskData: <T>(data: T, sensitiveKeys: string[]) => T
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  clear: () => set({ user: null, loading: false }),

  hasRole: (roles: UserRole | UserRole[]) => {
    return hasAnyRole(get().user, roles)
  },

  canAccess: (feature: FeatureKey) => {
    return canAccessFeature(get().user, feature)
  },

  maskData: <T,>(data: T, sensitiveKeys: string[]): T => {
    return maskSensitiveData(data, sensitiveKeys, get().user)
  }
}))
