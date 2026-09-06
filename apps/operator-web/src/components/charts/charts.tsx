"use client"

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from "recharts"

// Color palette for charts
export const CHART_COLORS = {
  primary: "#10b981", // emerald-500
  secondary: "#6366f1", // indigo-500
  accent: "#f59e0b", // amber-500
  danger: "#ef4444", // red-500
  warning: "#f97316", // orange-500
  info: "#3b82f6", // blue-500
  muted: "#6b7280", // gray-500
  gradient: {
    from: "#10b981",
    to: "#059669",
  },
}

export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#f59e0b",
  LOW: "#6b7280",
}

export const STATUS_COLORS: Record<string, string> = {
  OPEN: "#ef4444",
  IN_PROGRESS: "#3b82f6",
  RESOLVED: "#10b981",
  FALSE_ALARM: "#6b7280",
}

// Custom tooltip component
type CustomTooltipProps = TooltipProps<number, string> & {
  valueFormatter?: (value: number) => string
}

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v) => String(v),
}: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-zinc-900/95 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {valueFormatter(entry.value as number)}
        </p>
      ))}
    </div>
  )
}

// Area Chart Component
type AreaChartData = {
  name: string
  [key: string]: string | number
}

type AreaChartProps = {
  data: AreaChartData[]
  dataKeys: { key: string; color: string; name?: string }[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  valueFormatter?: (value: number) => string
}

export function AreaChartComponent({
  data,
  dataKeys,
  height = 300,
  showGrid = true,
  showLegend = true,
  valueFormatter,
}: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
        <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        {showLegend && <Legend />}
        {dataKeys.map(({ key, color, name }) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            name={name || key}
            stroke={color}
            fill={color}
            fillOpacity={0.3}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Bar Chart Component
type BarChartData = {
  name: string
  [key: string]: string | number
}

type BarChartProps = {
  data: BarChartData[]
  dataKeys: { key: string; color: string; name?: string }[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  layout?: "horizontal" | "vertical"
  valueFormatter?: (value: number) => string
}

export function BarChartComponent({
  data,
  dataKeys,
  height = 300,
  showGrid = true,
  showLegend = false,
  layout = "horizontal",
  valueFormatter,
}: BarChartProps) {
  const isVertical = layout === "vertical"

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
        {isVertical ? (
          <>
            <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} width={80} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
          </>
        )}
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        {showLegend && <Legend />}
        {dataKeys.map(({ key, color, name }) => (
          <Bar
            key={key}
            dataKey={key}
            name={name || key}
            fill={color}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// Line Chart Component
type LineChartData = {
  name: string
  [key: string]: string | number
}

type LineChartProps = {
  data: LineChartData[]
  dataKeys: { key: string; color: string; name?: string }[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  valueFormatter?: (value: number) => string
}

export function LineChartComponent({
  data,
  dataKeys,
  height = 300,
  showGrid = true,
  showLegend = true,
  valueFormatter,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
        <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        {showLegend && <Legend />}
        {dataKeys.map(({ key, color, name }) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={name || key}
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: color }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// Pie/Donut Chart Component
type PieChartData = {
  name: string
  value: number
  color?: string
}

type PieChartProps = {
  data: PieChartData[]
  height?: number
  innerRadius?: number
  outerRadius?: number
  showLegend?: boolean
  showLabels?: boolean
  valueFormatter?: (value: number) => string
}

export function PieChartComponent({
  data,
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
  showLegend = true,
  showLabels = false,
  valueFormatter = (v) => String(v),
}: PieChartProps) {
  const renderLabel = showLabels
    ? ({ name, value }: { name: string; value: number }) => `${name}: ${valueFormatter(value)}`
    : undefined

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey="value"
          label={renderLabel}
          labelLine={showLabels}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color || Object.values(CHART_COLORS)[index % Object.keys(CHART_COLORS).length] as string}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => valueFormatter(value)}
          contentStyle={{
            backgroundColor: "rgba(24, 24, 27, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "8px",
          }}
        />
        {showLegend && (
          <Legend
            formatter={(value) => <span className="text-sm text-zinc-300">{value}</span>}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  )
}

// Simple Stat Card with mini chart
type MiniChartData = {
  value: number
}

type StatCardProps = {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  trend?: "up" | "down" | "neutral"
  sparklineData?: MiniChartData[]
  color?: string
}

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  trend = "neutral",
  sparklineData,
  color = CHART_COLORS.primary,
}: StatCardProps) {
  const trendColor =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
        ? "text-red-400"
        : "text-zinc-400"

  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {change !== undefined && (
            <p className={`text-xs mt-1 ${trendColor}`}>
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {change}%{" "}
              {changeLabel && <span className="text-zinc-500">{changeLabel}</span>}
            </p>
          )}
        </div>
        {sparklineData && sparklineData.length > 0 && (
          <div className="w-20 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.3}
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
