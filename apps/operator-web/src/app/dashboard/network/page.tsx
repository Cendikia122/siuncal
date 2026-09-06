"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { toPng } from "html-to-image"
import { Building2, Bus, RadioTower, AlertTriangle, Gavel, Download, Filter, X, Users, Map as MapIcon, Activity } from "lucide-react"
import { RoleGate } from "@/components/auth/role-gate"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch, apiDownload } from "@/lib/api"

type GraphNode = {
  id: string
  type: "owner" | "vehicle" | "device" | "incident" | "sanction"
  label: string
  meta: Record<string, unknown>
}

type GraphEdge = {
  source: string
  target: string
  type: string
}

type Ranking = {
  owner_id?: string
  name?: string
  incident_count?: number
  avg_risk?: number | null
  route_id?: string
  route_name?: string
  anomaly_count?: number
  device_id?: string
  imei_or_serial?: string
  assignment_count?: number
}

type NetworkGraphResponse = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  rankings: {
    top_owners: Ranking[]
    top_routes: Ranking[]
    top_devices: Ranking[]
  }
}

type OwnerOption = { owner_id: string; name: string }
type RouteOption = { route_id: string; name: string }

const EDGE_COLORS: Record<string, string> = {
  owns: "#10b981",
  device_installed: "#6366f1",
  has_incident: "#ef4444",
  has_sanction: "#f59e0b"
}

type CustomNodeData = {
  label: string
  meta?: Record<string, unknown>
}

function OwnerNode({ data }: { data: CustomNodeData }) {
  return (
    <div className="rounded-xl border-2 border-emerald-500/50 bg-zinc-900 px-4 py-3 shadow-lg min-w-[140px]">
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500" />
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-bold text-emerald-300 truncate max-w-[120px]">{data.label}</span>
      </div>
      {data.meta ? (
        <div className="text-[10px] text-zinc-500 mt-1">{String(data.meta.owner_type || "")}</div>
      ) : null}
    </div>
  )
}

function VehicleNode({ data }: { data: CustomNodeData }) {
  const meta = data.meta || {}
  const level = String(meta.risk_level || "")
  const borderColor = level === "CRITICAL" ? "border-red-500/70" : level === "HIGH" ? "border-orange-500/60" : "border-zinc-700"
  return (
    <div className={`rounded-xl border-2 ${borderColor} bg-zinc-900 px-4 py-3 shadow-lg min-w-[130px]`}>
      <Handle type="target" position={Position.Top} className="!bg-zinc-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-zinc-500" />
      <div className="flex items-center gap-2">
        <Bus className="w-4 h-4 text-zinc-300" />
        <span className="text-xs font-bold text-zinc-100 truncate max-w-[100px]">{data.label}</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        {meta.risk_score != null ? (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${level === "CRITICAL" ? "bg-red-500/20 text-red-400" : level === "HIGH" ? "bg-orange-500/20 text-orange-400" : "bg-zinc-800 text-zinc-300"}`}>
            {String(meta.risk_score)} {level}
          </span>
        ) : null}
        {meta.route_id ? <span className="text-[10px] text-zinc-500">T{String(meta.route_id)}</span> : null}
      </div>
    </div>
  )
}

function DeviceNode({ data }: { data: CustomNodeData }) {
  return (
    <div className="rounded-xl border-2 border-indigo-500/40 bg-zinc-900 px-4 py-3 shadow-lg min-w-[120px]">
      <Handle type="target" position={Position.Top} className="!bg-indigo-500" />
      <div className="flex items-center gap-2">
        <RadioTower className="w-4 h-4 text-indigo-400" />
        <span className="text-[10px] font-mono text-indigo-300 truncate max-w-[100px]">{data.label}</span>
      </div>
    </div>
  )
}

function IncidentNode({ data }: { data: CustomNodeData }) {
  return (
    <div className="rounded-xl border-2 border-red-500/50 bg-zinc-900 px-3 py-2 shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-red-500" />
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3 text-red-400" />
        <span className="text-[10px] font-bold text-red-300 truncate max-w-[100px]">{data.label}</span>
      </div>
    </div>
  )
}

function SanctionNode({ data }: { data: CustomNodeData }) {
  return (
    <div className="rounded-xl border-2 border-yellow-500/50 bg-zinc-900 px-3 py-2 shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-yellow-500" />
      <div className="flex items-center gap-1.5">
        <Gavel className="w-3 h-3 text-yellow-400" />
        <span className="text-[10px] font-bold text-yellow-300 truncate max-w-[100px]">{data.label}</span>
      </div>
    </div>
  )
}

const nodeTypes = {
  owner: OwnerNode,
  vehicle: VehicleNode,
  device: DeviceNode,
  incident: IncidentNode,
  sanction: SanctionNode
}

function layoutNodes(graphNodes: GraphNode[]): Node[] {
  const ownerNodes = graphNodes.filter((n) => n.type === "owner")
  const vehicleByOwner: Map<string, GraphNode[]> = new Map()
  const otherNodes: GraphNode[] = []

  for (const n of graphNodes) {
    if (n.type === "owner") continue
    if (n.type === "vehicle") {
      const ownerId = graphNodes.find((e) => e.type === "owner" && n.meta?.owner_id)
      const key = ownerId ? ownerId.id : "none"
      if (!vehicleByOwner.has(key)) vehicleByOwner.set(key, [])
      vehicleByOwner.get(key)!.push(n)
    } else if (n.type === "device") {
      otherNodes.push(n)
    } else {
      otherNodes.push(n)
    }
  }

  const result: Node[] = []
  const colWidth = 260
  const rowHeight = 120

  let ownerX = 0
  for (const owner of ownerNodes) {
    result.push({ id: owner.id, type: owner.type, position: { x: ownerX, y: 0 }, data: { label: owner.label, meta: owner.meta } })

    const vehicles = graphNodes.filter((n) => n.type === "vehicle")
    const ownerVehicles = vehicles.filter((v) => {
      const meta = v.meta as Record<string, unknown>
      return meta && String(meta.owner_id || "") === owner.id.replace("o-", "")
    })

    let vx = ownerX - ((ownerVehicles.length - 1) * colWidth) / 2
    for (const v of ownerVehicles) {
      if (result.find((r) => r.id === v.id)) continue
      result.push({ id: v.id, type: v.type, position: { x: vx, y: rowHeight }, data: { label: v.label, meta: v.meta } })
      vx += colWidth
    }
    ownerX += Math.max(ownerVehicles.length, 1) * colWidth
  }

  let otherX = 0
  let otherY = rowHeight * 2
  for (const n of graphNodes) {
    if (result.find((r) => r.id === n.id)) continue
    result.push({ id: n.id, type: n.type, position: { x: otherX, y: otherY }, data: { label: n.label, meta: n.meta } })
    otherX += 200
    if (otherX > 1400) { otherX = 0; otherY += 80; }
  }

  return result
}

function convertEdges(graphEdges: GraphEdge[]): Edge[] {
  return graphEdges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.type.replace(/_/g, " "),
    style: { stroke: EDGE_COLORS[e.type] || "#555" },
    labelStyle: { fill: "#888", fontSize: 9 },
    animated: e.type === "has_incident"
  }))
}

export default function NetworkPage() {
  const [graphData, setGraphData] = useState<NetworkGraphResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [filterOwner, setFilterOwner] = useState("")
  const [filterRoute, setFilterRoute] = useState("")
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const flowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      apiFetch<{ items: OwnerOption[] }>("/owners").then((r) => setOwners(r.items || [])),
      apiFetch<{ items: RouteOption[] }>("/routes").then((r) => setRoutes(r.items || []))
    ]).catch(() => {})
  }, [])

  const loadGraph = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (filterOwner) params.set("owner_id", filterOwner)
      if (filterRoute) params.set("route_id", filterRoute)
      const data = await apiFetch<NetworkGraphResponse>(`/network/graph?${params}`)
      setGraphData(data)
      setNodes(layoutNodes(data.nodes))
      setEdges(convertEdges(data.edges))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat network graph")
    } finally {
      setLoading(false)
    }
  }, [filterOwner, filterRoute, setNodes, setEdges])

  useEffect(() => { loadGraph() }, [loadGraph])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const gn = graphData?.nodes.find((n) => n.id === node.id)
    setSelectedNode(gn || null)
  }, [graphData])

  const handleExportPng = useCallback(async () => {
    if (!flowRef.current) return
    try {
      const dataUrl = await toPng(flowRef.current, { backgroundColor: "#09090b" })
      const link = document.createElement("a")
      link.download = "network-graph.png"
      link.href = dataUrl
      link.click()
    } catch { /* ignore */ }
  }, [])

  const handleExportCsv = useCallback(async () => {
    await apiDownload("/network/graph/export", "network-graph.csv")
  }, [])

  return (
    <RoleGate roles="ANALISA" showDenied>
      <div className="p-6 space-y-4 h-[calc(100vh-4rem)]">
        <section aria-label="Header" data-tour="network-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Tampilan Jaringan</h1>
              <p className="text-sm text-muted-foreground">Graph relasi owner, kendaraan, device, insiden, dan sanksi.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleExportPng}><Download className="w-4 h-4 mr-1" /> PNG</Button>
              <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}><Download className="w-4 h-4 mr-1" /> CSV</Button>
            </div>
          </div>
        </section>

        <section aria-label="Filter">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-zinc-400" />
            <select
              className="bg-zinc-900 border border-white/10 rounded-md px-3 py-1.5 text-sm text-zinc-300"
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              <option value="">Semua Owner</option>
              {owners.map((o) => <option key={o.owner_id} value={o.owner_id}>{o.name}</option>)}
            </select>
            <select
              className="bg-zinc-900 border border-white/10 rounded-md px-3 py-1.5 text-sm text-zinc-300"
              value={filterRoute}
              onChange={(e) => setFilterRoute(e.target.value)}
            >
              <option value="">Semua Trayek</option>
              {routes.map((r) => <option key={r.route_id} value={r.route_id}>{r.name || `Trayek ${r.route_id}`}</option>)}
            </select>
            {(filterOwner || filterRoute) && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setFilterOwner(""); setFilterRoute(""); }}>
                <X className="w-3 h-3 mr-1" /> Reset
              </Button>
            )}
          </div>
        </section>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">{error}</div>
        )}

        <div className="flex gap-4 flex-1 h-[calc(100%-140px)]">
          <section aria-label="Graph jaringan" ref={flowRef} className="flex-1 rounded-2xl border border-white/5 bg-zinc-900/30 overflow-hidden" data-tour="network-view">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Skeleton className="w-full h-full" />
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-2">
                <div className="text-sm font-semibold text-zinc-300">Belum ada relasi jaringan</div>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Graf jaringan menampilkan keterkaitan pemilik, kendaraan, perangkat, insiden, dan sanksi.
                  Relasi muncul otomatis setelah ada data insiden/sanksi pada armada. Sesuaikan filter di atas atau muat ulang.
                </p>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.2}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#27272a" gap={20} />
                <Controls className="!bg-zinc-900 !border-white/10 !rounded-lg [&_button]:!bg-zinc-800 [&_button]:!border-white/10 [&_button]:!text-zinc-300" />
                <MiniMap
                  nodeColor={(n) => {
                    if (n.type === "owner") return "#10b981"
                    if (n.type === "vehicle") return "#a1a1aa"
                    if (n.type === "device") return "#6366f1"
                    if (n.type === "incident") return "#ef4444"
                    if (n.type === "sanction") return "#f59e0b"
                    return "#555"
                  }}
                  className="!bg-zinc-900/80 !border-white/10 !rounded-lg"
                />
              </ReactFlow>
            )}
          </section>

          <div className="w-72 space-y-4 overflow-y-auto">
            {selectedNode && (
              <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-zinc-400">{selectedNode.type}</span>
                  <button type="button" onClick={() => setSelectedNode(null)} className="text-zinc-500 hover:text-white" aria-label="Tutup panel"><X className="w-3 h-3" /></button>
                </div>
                <div className="text-sm font-bold text-zinc-100 mb-2">{selectedNode.label}</div>
                <div className="space-y-1">
                  {Object.entries(selectedNode.meta).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[10px]">
                      <span className="text-zinc-500">{k}</span>
                      <span className="text-zinc-300 font-mono">{String(v ?? "-")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {graphData && (
              <>
                <RankingPanel icon={Users} title="Owner Tertinggi" colorClass="text-emerald-400" items={graphData.rankings.top_owners.map((o) => ({ label: o.name || "-", value: `${o.incident_count || 0} insiden` }))} />
                <RankingPanel icon={MapIcon} title="Trayek Tertinggi" colorClass="text-orange-400" items={graphData.rankings.top_routes.map((r) => ({ label: r.route_name || `Trayek ${r.route_id}`, value: `${r.anomaly_count || 0} anomali` }))} />
                <RankingPanel icon={Activity} title="Device Tertinggi" colorClass="text-indigo-400" items={graphData.rankings.top_devices.map((d) => ({ label: d.imei_or_serial || "-", value: `${d.assignment_count || 0} penugasan` }))} />
              </>
            )}
          </div>
        </div>
      </div>
    </RoleGate>
  )
}

function RankingPanel({ icon: Icon, title, colorClass, items }: { icon: React.ElementType; title: string; colorClass: string; items: { label: string; value: string }[] }) {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
        <span className="text-xs font-bold text-zinc-300">{title}</span>
      </div>
      <div className="p-2 space-y-1">
        {items.length === 0 ? (
          <div className="text-[10px] text-zinc-600 text-center py-2">Belum ada data</div>
        ) : items.map((item, i) => (
          <div key={i} className="flex justify-between text-[10px] px-1">
            <span className="text-zinc-400 truncate max-w-[120px]">{item.label}</span>
            <span className="text-zinc-500 font-mono">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
