"use client"

import { Bell, User, AlertTriangle, CheckCheck, WifiOff, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ACTION_FEEDBACK_EVENT, ActionFeedback, apiFetch, emitActionFeedback, getRealtimeUrl, MOCK_MODE } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuthStore } from "@/store/auth-store"
import { useSidebarStore } from "@/store/sidebar-store"

type NotificationItem = {
  notification_id: string
  incident_id?: string | null
  channel: string
  status: string
  payload?: { message?: string; rule?: string; severity?: string }
  created_at: string
  read_at?: string | null
  type?: string | null
  severity?: string | null
  vehicle_plate?: string | null
  location?: string | null
  message?: string | null
}

type NotificationResponse = {
  items?: NotificationItem[]
  unread?: number
}

type RealtimeNotificationPayload = {
  type?: string
  notifications?: NotificationItem[]
  unread?: number
}

const formatRelativeTime = (value: string) => {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return "-"
  const diffMs = Date.now() - timestamp
  const minutes = Math.max(0, Math.floor(diffMs / 60000))
  if (minutes < 1) return "Baru saja"
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return new Date(value).toLocaleDateString("id-ID")
}

const getNotificationTitle = (notification: NotificationItem) => {
  const rule = notification.payload?.rule || notification.type || "OPERASIONAL"
  const plate = notification.vehicle_plate ? ` ${notification.vehicle_plate}` : ""
  return `${rule}${plate}`
}

const getNotificationMessage = (notification: NotificationItem) =>
  notification.message || notification.payload?.message || notification.location || "Notifikasi operasional baru."

export function Topbar() {
  const user = useAuthStore((state) => state.user)
  const router = useRouter()
  const toggleSidebar = useSidebarStore((s) => s.toggle)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(MOCK_MODE)
  const [feedback, setFeedback] = useState<(ActionFeedback & { id: number }) | null>(null)
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window === "undefined") return "default"
    return "Notification" in window ? Notification.permission : "unsupported"
  })
  const seenNotificationIds = useRef(new Set<string>())

  const unreadLabel = useMemo(() => unread > 9 ? "9+" : String(unread), [unread])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ActionFeedback>).detail
      if (!detail) return
      setFeedback({ ...detail, id: Date.now() })
    }
    window.addEventListener(ACTION_FEEDBACK_EVENT, handler)
    return () => window.removeEventListener(ACTION_FEEDBACK_EVENT, handler)
  }, [])

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), 4200)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const applyNotifications = useCallback((items: NotificationItem[], nextUnread?: number) => {
    setNotifications(items)
    setUnread(nextUnread ?? items.filter((item) => !item.read_at).length)
    items.forEach((item) => seenNotificationIds.current.add(item.notification_id))
  }, [])

  useEffect(() => {
    let active = true
    const loadNotifications = async () => {
      try {
        const data = await apiFetch<NotificationResponse>("/notifications?limit=10")
        if (!active) return
        applyNotifications(data.items || [], data.unread)
      } catch {
        if (active) {
          setIsRealtimeConnected(false)
        }
      }
    }

    loadNotifications()
    return () => {
      active = false
    }
  }, [applyNotifications])

  useEffect(() => {
    if (MOCK_MODE) return

    const socket = new WebSocket(getRealtimeUrl())
    let closedByCleanup = false

    socket.onopen = () => setIsRealtimeConnected(true)
    socket.onclose = () => {
      if (!closedByCleanup) setIsRealtimeConnected(false)
    }
    socket.onerror = () => setIsRealtimeConnected(false)
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as RealtimeNotificationPayload
        if (payload.type === "NOTIFICATION_LIST") {
          applyNotifications(payload.notifications || [], payload.unread)
        }
        if (payload.type === "NOTIFICATION_NEW") {
          const incoming = payload.notifications || []
          if (incoming.length > 0) {
            setNotifications((current) => {
              const next = [...incoming, ...current]
              const unique = Array.from(new Map(next.map((item) => [item.notification_id, item])).values())
              return unique.slice(0, 10)
            })
            setUnread(payload.unread ?? ((current) => current + incoming.length))
            if (browserPermission === "granted") {
              incoming
                .filter((item) => !seenNotificationIds.current.has(item.notification_id))
                .forEach((item) => {
                  new Notification(getNotificationTitle(item), {
                    body: getNotificationMessage(item),
                    tag: item.notification_id,
                  })
                  seenNotificationIds.current.add(item.notification_id)
                })
            }
          }
        }
      } catch {
        setIsRealtimeConnected(false)
      }
    }

    return () => {
      closedByCleanup = true
      socket.close()
    }
  }, [applyNotifications, browserPermission])

  const requestBrowserPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setBrowserPermission("unsupported")
      return
    }
    const permission = await Notification.requestPermission()
    setBrowserPermission(permission)
  }

  const markRead = async () => {
    await apiFetch<NotificationResponse>("/notifications/read", { method: "POST", body: JSON.stringify({}) })
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })))
    setUnread(0)
  }

  const openIncident = (incidentId?: string | null) => {
    if (!incidentId) {
      emitActionFeedback({ type: "info", title: "Tidak ada detail insiden", message: "Notifikasi ini belum terhubung ke halaman insiden." })
      return
    }
    router.push(`/dashboard/incidents/${incidentId}`)
  }

  return (
    <>
    <header className="h-16 border-b border-white/8 bg-zinc-950 flex items-center justify-between px-4 md:px-6 fixed top-0 right-0 left-0 md:left-64 z-40">
      <div className="flex items-center gap-3 md:gap-4 flex-1">
        <Button variant="ghost" size="icon" aria-label="Buka menu navigasi" className="md:hidden shrink-0" onClick={toggleSidebar}>
          <Menu className="h-5 w-5 text-zinc-400" />
        </Button>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">SI UNCAL</div>
          <h2 className="truncate text-sm font-semibold text-white md:text-base">
            SI UNCAL — Operational Intelligence Dashboard
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className={cn(
          "flex items-center gap-2 rounded-full border px-2 py-1.5 sm:px-3",
          isRealtimeConnected ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10"
        )}>
          <div className={cn("size-2 rounded-full shrink-0", isRealtimeConnected ? "bg-emerald-500" : "bg-amber-500")} />
          <span className={cn("text-xs font-medium hidden sm:inline", isRealtimeConnected ? "text-emerald-500" : "text-amber-500")}>
            {isRealtimeConnected ? "Sistem Aktif" : "Realtime tertunda"}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"} className="relative">
              <Bell className="h-5 w-5 text-zinc-400 transition-colors" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {unreadLabel}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 p-0">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <DropdownMenuLabel className="p-0">Notifikasi</DropdownMenuLabel>
                <p className="mt-1 text-xs text-zinc-500">
                  {unread > 0 ? `${unread} belum dibaca` : "Semua notifikasi sudah dibaca"}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs" onClick={markRead} disabled={unread === 0}>
                <CheckCheck className="h-4 w-4" />
                Tandai dibaca
              </Button>
            </div>
            <DropdownMenuSeparator />
            {browserPermission === "default" && (
              <>
                <div className="px-4 py-3">
                  <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={requestBrowserPermission}>
                    <Bell className="h-4 w-4" />
                    Aktifkan push desktop
                  </Button>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            {browserPermission === "denied" && (
              <>
                <div className="px-4 py-3 text-xs text-amber-400">Izin notifikasi browser diblokir. Ubah dari pengaturan browser untuk menerima push desktop.</div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuGroup className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-zinc-500">
                  <WifiOff className="h-5 w-5" />
                  Belum ada notifikasi operasional.
                </div>
              ) : notifications.map((notification) => {
                const isUnread = !notification.read_at
                const isCritical = notification.severity === "CRITICAL" || notification.payload?.severity === "CRITICAL"
                return (
                  <DropdownMenuItem
                    key={notification.notification_id}
                    className="cursor-pointer items-start gap-3 rounded-none px-4 py-3"
                    onSelect={(event) => {
                      event.preventDefault()
                      openIncident(notification.incident_id)
                    }}
                  >
                    <div className={cn(
                      "mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border",
                      isCritical ? "border-red-500/30 bg-red-500/20 text-red-400" : "border-amber-500/30 bg-amber-500/20 text-amber-400"
                    )}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("truncate text-sm font-medium", isUnread ? "text-white" : "text-zinc-400")}>
                          {getNotificationTitle(notification)}
                        </p>
                        <span className="shrink-0 text-[10px] text-zinc-500">{formatRelativeTime(notification.created_at)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">{getNotificationMessage(notification)}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant={isCritical ? "destructive" : "secondary"}>{notification.severity || notification.payload?.severity || "INFO"}</Badge>
                        {isUnread && <span className="size-1.5 rounded-full bg-red-500" />}
                      </div>
                    </div>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-3 pl-4 border-l border-white/5">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-white">{user?.full_name || "Petugas Dishub"}</div>
            <div className="text-xs text-muted-foreground">{user?.roles?.[0] || "Operator"}</div>
          </div>
          <div className="h-9 w-9 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
            <User className="h-5 w-5 text-zinc-400" />
          </div>
        </div>
      </div>
    </header>
    {feedback && (
      <div
        key={feedback.id}
        role="status"
        className={cn(
          "fixed right-4 top-20 z-[70] max-w-sm rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur",
          feedback.type === "success" && "border-emerald-500/20 bg-emerald-950/90 text-emerald-100",
          feedback.type === "error" && "border-red-500/20 bg-red-950/90 text-red-100",
          feedback.type === "info" && "border-sky-500/20 bg-sky-950/90 text-sky-100"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{feedback.title}</div>
            {feedback.message && <div className="mt-0.5 text-xs opacity-80">{feedback.message}</div>}
          </div>
          <button type="button" aria-label="Tutup notifikasi" className="rounded p-0.5 opacity-70 hover:bg-white/10 hover:opacity-100" onClick={() => setFeedback(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )}
    </>
  )
}
