/** Shared color maps for status/severity/risk badges. Import these instead of writing inline ternaries. */

export const RISK_LEVEL_COLORS: Record<string, string> = {
  LOW: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  MEDIUM: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  HIGH: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  CRITICAL: "bg-red-500/10 text-red-400 border-red-500/20",
}

export const RISK_LEVEL_DOT_COLORS: Record<string, string> = {
  LOW: "bg-emerald-500",
  MEDIUM: "bg-yellow-500",
  HIGH: "bg-orange-500",
  CRITICAL: "bg-red-500",
}

export const RISK_LEVEL_BAR_COLORS: Record<string, string> = {
  LOW: "bg-emerald-500",
  MEDIUM: "bg-yellow-500",
  HIGH: "bg-orange-500",
  CRITICAL: "bg-red-500",
}

export const SEVERITY_BADGE_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/10 text-red-400 border-red-500/20",
  HIGH: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  MEDIUM: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  LOW: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  INFO: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
}

export const SEVERITY_ICON_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/10 text-red-500",
  HIGH: "bg-orange-500/10 text-orange-500",
  MEDIUM: "bg-yellow-500/10 text-yellow-500",
  LOW: "bg-zinc-500/10 text-zinc-400",
  INFO: "bg-zinc-500/10 text-zinc-400",
}

export const VEHICLE_STATUS_COLORS: Record<string, string> = {
  IN_SERVICE: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  IDLE: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  OFF_ROUTE: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  SOS: "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse",
}

export const INCIDENT_STATUS_COLORS: Record<string, string> = {
  RESOLVED: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  IN_PROGRESS: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  FALSE_ALARM: "bg-zinc-500/10 border-zinc-500/30 text-zinc-400",
  OPEN: "bg-red-500/10 border-red-500/30 text-red-400",
}

export const STATUS_MUTED = "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
