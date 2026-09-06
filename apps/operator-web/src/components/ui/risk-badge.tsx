import { RISK_LEVEL_COLORS, STATUS_MUTED } from "@/lib/status-colors"

type RiskBadgeProps = {
  score?: number | null
  level?: string | null
}

export function RiskBadge({ score, level }: RiskBadgeProps) {
  if (score === null || score === undefined || !level) {
    return <span className="text-xs text-zinc-500">-</span>
  }
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${RISK_LEVEL_COLORS[level] ?? STATUS_MUTED}`}>
      {score}/100 {level}
    </span>
  )
}
