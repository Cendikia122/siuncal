import { create } from "zustand"

type SidebarStore = {
  mobileOpen: boolean
  toggle: () => void
  close: () => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  mobileOpen: false,
  toggle: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
  close: () => set({ mobileOpen: false }),
}))
