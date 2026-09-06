# Phase 16: Heatmap Operasional Real Implementation Plan

**Goal:** Build real-data heatmaps (stop density, ngetem zones, off-route zones, speed zones) with time-range filtering, PNG export, and route insights so ANALISA can visualize operational hotspots on a map.

**Architecture:** 1 new migration (015) for `heatmap_data` table, 1 BullMQ periodic job for heatmap generation in api-gateway, ~5 new API routes in server.js, 1 new Next.js page (`/dashboard/heatmap`), sidebar + auth-store updates. Spatial aggregation uses PostGIS grid cells (0.001° ≈ 111m). Heatmap visualization uses `leaflet.heat` for smooth gradient rendering. All patterns follow existing codebase conventions.

**Tech Stack:** PostgreSQL/PostGIS/TimescaleDB, Express.js, BullMQ (Redis), Next.js 16 App Router, Leaflet + leaflet.heat, Recharts, shadcn/ui, Tailwind CSS, html-to-image (PNG export)

---

## Task 1: Database Migration

**Files:**
- Create: `db/migrations/015_heatmap_data.sql`

### Step 1: Write migration SQL

```sql
-- Phase 16: Heatmap Operasional Real

CREATE TABLE IF NOT EXISTS heatmap_data (
  heatmap_id bigserial PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('STOP_DENSITY','NGETEM_ZONE','OFF_ROUTE_ZONE','SPEED_ZONE')),
  grid_lat double precision NOT NULL,
  grid_lon double precision NOT NULL,
  route_id text REFERENCES routes(route_id) ON DELETE SET NULL,
  time_window tstzrange NOT NULL,
  metric text NOT NULL,
  value double precision NOT NULL DEFAULT 0,
  vehicle_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_heatmap_type_time ON heatmap_data (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_heatmap_grid ON heatmap_data USING GIST (
  ST_SetSRID(ST_MakePoint(grid_lon, grid_lat), 4326)
);
CREATE INDEX IF NOT EXISTS idx_heatmap_time_window ON heatmap_data USING GIST (time_window);
CREATE INDEX IF NOT EXISTS idx_heatmap_route ON heatmap_data (route_id, type);

-- Purge heatmap data older than 30 days (run via cron or manual)
-- DELETE FROM heatmap_data WHERE created_at < now() - interval '30 days';
```

### Step 2: Run migration

```bash
docker compose -f infra/docker-compose/docker-compose.yml exec postgres psql -U monitoring -d Sentra -f /docker-entrypoint-initdb.d/migrations/015_heatmap_data.sql
```

### Step 3: Commit

```bash
git add db/migrations/015_heatmap_data.sql
git commit -m "feat(db): add migration 015 for heatmap_data table"
```

---

## Task 2: Heatmap Generation Job (API Gateway)

**Files:**
- Modify: `services/api-gateway/src/server.js`

### Step 1: Add heatmap generation endpoint

Add `POST /analytics/heatmap/generate` (ANALISA only) and the BullMQ worker.

The generation logic queries existing data:
- **STOP_DENSITY**: `vehicle_positions` with `speed_kmh < 5` near `route_stops` (within 50m), grouped by grid cell + hour.
- **NGETEM_ZONE**: `anomalies` where `rule = 'NGETEM'`, grouped by grid cell of anomaly `lat/lon`.
- **OFF_ROUTE_ZONE**: `anomalies` where `rule = 'OFF_ROUTE'`, grouped by grid cell of anomaly `lat/lon`.
- **SPEED_ZONE**: `vehicle_positions` grouped by grid cell, computing `avg(speed_kmh)`.

Grid cell size: `round(lat/lon, 3)` → ~111m cells.

```javascript
// === HEATMAP GENERATION ===

// BullMQ queue for heatmap generation
const heatmapQueue = new Queue("heatmap-generation", { connection: redis });

// Worker processes heatmap generation
const heatmapWorker = new Worker("heatmap-generation", async (job) => {
  const { type, hours } = job.data; // hours = lookback window
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  if (type === "STOP_DENSITY" || type === "ALL") {
    await pool.query(`
      INSERT INTO heatmap_data (type, grid_lat, grid_lon, route_id, time_window, metric, value, vehicle_count, metadata)
      SELECT
        'STOP_DENSITY',
        round(vp.lat::numeric, 3)::double precision,
        round(vp.lon::numeric, 3)::double precision,
        rs.route_id,
        tstzrange($1::timestamptz, now()),
        'stop_count',
        count(*)::double precision,
        count(DISTINCT vp.vehicle_id)::integer,
        jsonb_build_object('stop_name', rs.name, 'stop_id', rs.stop_id)
      FROM vehicle_positions vp
      JOIN route_stops rs ON ST_DWithin(
        vp.geom,
        rs.geom,
        0.00045  -- ~50m in degrees
      )
      WHERE vp.ts >= $1::timestamptz
        AND vp.speed_kmh < 5
      GROUP BY round(vp.lat::numeric, 3), round(vp.lon::numeric, 3), rs.route_id, rs.name, rs.stop_id
    `, [since]);
  }

  if (type === "NGETEM_ZONE" || type === "ALL") {
    await pool.query(`
      INSERT INTO heatmap_data (type, grid_lat, grid_lon, route_id, time_window, metric, value, vehicle_count, metadata)
      SELECT
        'NGETEM_ZONE',
        round(a.lat::numeric, 3)::double precision,
        round(a.lon::numeric, 3)::double precision,
        v.route_id,
        tstzrange($1::timestamptz, now()),
        'ngetem_count',
        count(*)::double precision,
        count(DISTINCT a.vehicle_id)::integer,
        jsonb_build_object('avg_duration_min', round(avg(EXTRACT(EPOCH FROM (COALESCE(a.resolved_at, now()) - a.started_at)) / 60)::numeric, 1))
      FROM anomalies a
      JOIN vehicles v ON v.vehicle_id = a.vehicle_id
      WHERE a.rule = 'NGETEM'
        AND a.started_at >= $1::timestamptz
        AND a.lat IS NOT NULL AND a.lon IS NOT NULL
      GROUP BY round(a.lat::numeric, 3), round(a.lon::numeric, 3), v.route_id
    `, [since]);
  }

  if (type === "OFF_ROUTE_ZONE" || type === "ALL") {
    await pool.query(`
      INSERT INTO heatmap_data (type, grid_lat, grid_lon, route_id, time_window, metric, value, vehicle_count, metadata)
      SELECT
        'OFF_ROUTE_ZONE',
        round(a.lat::numeric, 3)::double precision,
        round(a.lon::numeric, 3)::double precision,
        v.route_id,
        tstzrange($1::timestamptz, now()),
        'off_route_count',
        count(*)::double precision,
        count(DISTINCT a.vehicle_id)::integer,
        '{}'::jsonb
      FROM anomalies a
      JOIN vehicles v ON v.vehicle_id = a.vehicle_id
      WHERE a.rule = 'OFF_ROUTE'
        AND a.started_at >= $1::timestamptz
        AND a.lat IS NOT NULL AND a.lon IS NOT NULL
      GROUP BY round(a.lat::numeric, 3), round(a.lon::numeric, 3), v.route_id
    `, [since]);
  }

  if (type === "SPEED_ZONE" || type === "ALL") {
    await pool.query(`
      INSERT INTO heatmap_data (type, grid_lat, grid_lon, route_id, time_window, metric, value, vehicle_count, metadata)
      SELECT
        'SPEED_ZONE',
        round(vp.lat::numeric, 3)::double precision,
        round(vp.lon::numeric, 3)::double precision,
        v.route_id,
        tstzrange($1::timestamptz, now()),
        'avg_speed_kmh',
        round(avg(vp.speed_kmh)::numeric, 1)::double precision,
        count(DISTINCT vp.vehicle_id)::integer,
        jsonb_build_object('max_speed', max(vp.speed_kmh), 'min_speed', min(vp.speed_kmh), 'point_count', count(*))
      FROM vehicle_positions vp
      JOIN vehicles v ON v.vehicle_id = vp.vehicle_id
      WHERE vp.ts >= $1::timestamptz
        AND vp.speed_kmh IS NOT NULL
      GROUP BY round(vp.lat::numeric, 3), round(vp.lon::numeric, 3), v.route_id
    `, [since]);
  }

  return { type, hours, generatedAt: new Date().toISOString() };
}, { connection: redis, concurrency: 1 });

// Schedule heatmap generation every hour
const scheduleHeatmapJob = async () => {
  const existing = await heatmapQueue.getRepeatableJobs();
  const hasJob = existing.some(j => j.name === "heatmap-hourly");
  if (!hasJob) {
    await heatmapQueue.add("heatmap-hourly", { type: "ALL", hours: 24 }, {
      repeat: { every: 3600000 }, // every hour
      removeOnComplete: 5,
      removeOnFail: 3,
    });
  }
};
scheduleHeatmapJob().catch(err => console.error("[HEATMAP] Failed to schedule job:", err));
```

### Step 2: Add heatmap API routes

```javascript
// POST /analytics/heatmap/generate - trigger manual generation
app.post("/analytics/heatmap/generate", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { type = "ALL", hours = 24 } = req.body;
  const validTypes = ["ALL", "STOP_DENSITY", "NGETEM_ZONE", "OFF_ROUTE_ZONE", "SPEED_ZONE"];
  if (!validTypes.includes(type)) return res.status(400).json({ error: "Invalid type" });
  if (hours < 1 || hours > 720) return res.status(400).json({ error: "hours must be 1-720" });

  // Clear old data for the type before regenerating
  if (type === "ALL") {
    await pool.query(`DELETE FROM heatmap_data WHERE created_at < now() - interval '1 hour'`);
  } else {
    await pool.query(`DELETE FROM heatmap_data WHERE type = $1 AND created_at < now() - interval '1 hour'`, [type]);
  }

  const job = await heatmapQueue.add("heatmap-manual", { type, hours }, {
    removeOnComplete: 5,
    removeOnFail: 3,
  });
  res.json({ ok: true, jobId: job.id, type, hours });
}));

// GET /analytics/heatmap - get heatmap data
app.get("/analytics/heatmap", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { type, range = "24h", route_id } = req.query;
  const validTypes = ["STOP_DENSITY", "NGETEM_ZONE", "OFF_ROUTE_ZONE", "SPEED_ZONE"];
  if (!type || !validTypes.includes(type)) return res.status(400).json({ error: "type required: STOP_DENSITY|NGETEM_ZONE|OFF_ROUTE_ZONE|SPEED_ZONE" });

  const rangeMap = { "24h": 1, "7d": 7, "30d": 30 };
  const days = rangeMap[range] || 1;

  let query = `
    SELECT grid_lat, grid_lon, route_id, metric, value, vehicle_count, metadata, created_at
    FROM heatmap_data
    WHERE type = $1
      AND created_at >= now() - interval '${days} days'
  `;
  const params = [type];

  if (route_id) {
    params.push(route_id);
    query += ` AND route_id = $${params.length}`;
  }

  query += ` ORDER BY value DESC LIMIT 5000`;

  const { rows } = await pool.query(query, params);
  res.json({ type, range, count: rows.length, data: rows });
}));

// GET /analytics/heatmap/insights - route-level insights
app.get("/analytics/heatmap/insights", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { range = "7d" } = req.query;
  const rangeMap = { "24h": 1, "7d": 7, "30d": 30 };
  const days = rangeMap[range] || 7;
  const since = `now() - interval '${days} days'`;

  // Busiest stops
  const busiestStops = await pool.query(`
    SELECT route_id, metadata->>'stop_name' as stop_name,
      sum(value) as total_stops, sum(vehicle_count) as total_vehicles
    FROM heatmap_data
    WHERE type = 'STOP_DENSITY' AND created_at >= ${since}
    GROUP BY route_id, metadata->>'stop_name'
    ORDER BY total_stops DESC
    LIMIT 5
  `);

  // Most ngetem routes
  const ngetemRoutes = await pool.query(`
    SELECT h.route_id, r.name as route_name,
      sum(h.value) as total_ngetem, sum(h.vehicle_count) as total_vehicles
    FROM heatmap_data h
    LEFT JOIN routes r ON r.route_id = h.route_id
    WHERE h.type = 'NGETEM_ZONE' AND h.created_at >= ${since}
    GROUP BY h.route_id, r.name
    ORDER BY total_ngetem DESC
    LIMIT 5
  `);

  // Most off-route routes
  const offRouteRoutes = await pool.query(`
    SELECT h.route_id, r.name as route_name,
      sum(h.value) as total_off_route, sum(h.vehicle_count) as total_vehicles
    FROM heatmap_data h
    LEFT JOIN routes r ON r.route_id = h.route_id
    WHERE h.type = 'OFF_ROUTE_ZONE' AND h.created_at >= ${since}
    GROUP BY h.route_id, r.name
    ORDER BY total_off_route DESC
    LIMIT 5
  `);

  // Speed variance routes
  const speedRoutes = await pool.query(`
    SELECT h.route_id, r.name as route_name,
      round(avg(h.value)::numeric, 1) as avg_speed,
      max((h.metadata->>'max_speed')::numeric) as max_speed,
      sum(h.vehicle_count) as total_vehicles
    FROM heatmap_data h
    LEFT JOIN routes r ON r.route_id = h.route_id
    WHERE h.type = 'SPEED_ZONE' AND h.created_at >= ${since}
    GROUP BY h.route_id, r.name
    ORDER BY avg_speed DESC
    LIMIT 5
  `);

  res.json({
    range,
    insights: {
      busiest_stops: busiestStops.rows,
      most_ngetem_routes: ngetemRoutes.rows,
      most_off_route_routes: offRouteRoutes.rows,
      highest_speed_routes: speedRoutes.rows,
    },
  });
}));

// GET /analytics/heatmap/status - check job status
app.get("/analytics/heatmap/status", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const latest = await pool.query(`
    SELECT type, max(created_at) as last_generated, count(*) as data_points
    FROM heatmap_data
    GROUP BY type
    ORDER BY type
  `);
  const repeatable = await heatmapQueue.getRepeatableJobs();
  res.json({
    types: latest.rows,
    scheduled_jobs: repeatable.map(j => ({ name: j.name, every: j.every, next: j.next })),
  });
}));
```

### Step 3: Commit

```bash
git add services/api-gateway/src/server.js
git commit -m "feat(api): add heatmap generation job and API routes"
```

---

## Task 3: Install leaflet.heat in operator-web

**Files:**
- Modify: `apps/operator-web/package.json`

### Step 1: Install leaflet.heat

```bash
cd apps/operator-web
npm install leaflet.heat
```

Note: `leaflet.heat` doesn't have built-in TypeScript types. We'll create a minimal type declaration.

### Step 2: Create type declaration

Create `apps/operator-web/src/types/leaflet-heat.d.ts`:

```typescript
import * as L from "leaflet"

declare module "leaflet" {
  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: {
      minOpacity?: number
      maxZoom?: number
      max?: number
      radius?: number
      blur?: number
      gradient?: Record<number, string>
    }
  ): L.Layer
}
```

### Step 3: Commit

```bash
git add apps/operator-web/package.json apps/operator-web/package-lock.json apps/operator-web/src/types/leaflet-heat.d.ts
git commit -m "feat(web): install leaflet.heat for heatmap visualization"
```

---

## Task 4: Auth Store Update

**Files:**
- Modify: `apps/operator-web/src/store/auth-store.ts`

### Step 1: Add "heatmap" to FeatureKey

Add `"heatmap"` to the `FeatureKey` union type (after `"compliance"`):

```typescript
export type FeatureKey =
  | "dashboard"
  // ... existing keys ...
  | "compliance"
  | "heatmap"
```

Add to `FEATURE_ACCESS`:

```typescript
const FEATURE_ACCESS: Record<FeatureKey, UserRole[]> = {
  // ... existing entries ...
  compliance: ["ANALISA"],
  heatmap: ["ANALISA"],
}
```

### Step 2: Commit

```bash
git add apps/operator-web/src/store/auth-store.ts
git commit -m "feat(web): add heatmap feature access for ANALISA role"
```

---

## Task 5: Sidebar Navigation

**Files:**
- Modify: `apps/operator-web/src/components/layout/sidebar.tsx`

### Step 1: Add Heatmap nav item

Import `Flame` icon from lucide-react (add to existing import line):

```typescript
import { Map, BarChart3, AlertTriangle, LogOut, Users, Bus, MapPin, ShieldCheck, IdCard, RadioTower, Activity, Radar, MessageSquareWarning, Network, Gavel, ClipboardCheck, Flame } from "lucide-react"
```

Add nav item after Compliance in the "Analisa & Kontrol" group:

```tsx
{canAccess("compliance") && <NavItem href="/dashboard/compliance" icon={ClipboardCheck} label="Compliance" active={isActive("/dashboard/compliance")} />}
{canAccess("heatmap") && <NavItem href="/dashboard/heatmap" icon={Flame} label="Heatmap" active={isActive("/dashboard/heatmap")} />}
```

### Step 2: Commit

```bash
git add apps/operator-web/src/components/layout/sidebar.tsx
git commit -m "feat(web): add Heatmap nav item to sidebar"
```

---

## Task 6: Heatmap Page

**Files:**
- Create: `apps/operator-web/src/app/dashboard/heatmap/page.tsx`

### Step 1: Write the heatmap page

This is the main page with:
- Heatmap type selector (STOP_DENSITY, NGETEM_ZONE, OFF_ROUTE_ZONE, SPEED_ZONE)
- Time range selector (24h, 7d, 30d)
- Route filter (optional)
- Leaflet map with heat layer
- Click grid/zone for detail popup
- Generate button to trigger manual generation
- Export PNG button
- Insights panel below the map

```tsx
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { Flame, Download, RefreshCw, TrendingUp, MapPin, AlertTriangle, Gauge, BarChart3 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useAuthStore } from "@/store/auth-store"
import { toPng } from "html-to-image"

const HeatmapMap = dynamic(() => import("@/components/heatmap/heatmap-map"), { ssr: false })

type HeatmapType = "STOP_DENSITY" | "NGETEM_ZONE" | "OFF_ROUTE_ZONE" | "SPEED_ZONE"
type TimeRange = "24h" | "7d" | "30d"

type HeatmapPoint = {
  grid_lat: number
  grid_lon: number
  route_id: string | null
  metric: string
  value: number
  vehicle_count: number
  metadata: Record<string, unknown>
  created_at: string
}

type Route = { route_id: string; name: string }

type InsightRow = {
  route_id: string
  route_name?: string
  stop_name?: string
  total_stops?: number
  total_ngetem?: number
  total_off_route?: number
  avg_speed?: number
  max_speed?: number
  total_vehicles: number
}

type Insights = {
  busiest_stops: InsightRow[]
  most_ngetem_routes: InsightRow[]
  most_off_route_routes: InsightRow[]
  highest_speed_routes: InsightRow[]
}

const TYPE_CONFIG: Record<HeatmapType, { label: string; icon: typeof Flame; color: string; gradient: Record<number, string>; description: string }> = {
  STOP_DENSITY: {
    label: "Stop Density",
    icon: MapPin,
    color: "emerald",
    gradient: { 0.2: "#10b981", 0.5: "#f59e0b", 0.8: "#ef4444" },
    description: "Kepadatan kendaraan berhenti di sekitar halte (speed < 5 km/h, radius 50m dari halte).",
  },
  NGETEM_ZONE: {
    label: "Ngetem Zone",
    icon: AlertTriangle,
    color: "orange",
    gradient: { 0.2: "#f59e0b", 0.5: "#f97316", 0.8: "#ef4444" },
    description: "Zona berhenti lama (ngetem) berdasarkan anomaly NGETEM yang terdeteksi.",
  },
  OFF_ROUTE_ZONE: {
    label: "Off-Route Zone",
    icon: MapPin,
    color: "red",
    gradient: { 0.2: "#fbbf24", 0.5: "#f97316", 0.8: "#dc2626" },
    description: "Zona konsentrasi pelanggaran keluar trayek berdasarkan anomaly OFF_ROUTE.",
  },
  SPEED_ZONE: {
    label: "Speed Zone",
    icon: Gauge,
    color: "blue",
    gradient: { 0.2: "#22c55e", 0.5: "#eab308", 0.8: "#ef4444" },
    description: "Kecepatan rata-rata per segmen. Hijau = normal, kuning = pelan, merah = kencang.",
  },
}

export default function HeatmapPage() {
  const canAccess = useAuthStore((s) => s.canAccess)
  const [type, setType] = useState<HeatmapType>("STOP_DENSITY")
  const [range, setRange] = useState<TimeRange>("24h")
  const [routeId, setRouteId] = useState<string>("")
  const [data, setData] = useState<HeatmapPoint[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState<{ types: { type: string; last_generated: string; data_points: number }[] } | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiFetch<{ routes: Route[] }>("/routes").then((r) => setRoutes(r.routes || [])).catch(() => {})
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type, range })
      if (routeId) params.set("route_id", routeId)
      const res = await apiFetch<{ data: HeatmapPoint[] }>(`/analytics/heatmap?${params}`)
      setData(res.data || [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [type, range, routeId])

  const loadInsights = useCallback(async () => {
    try {
      const res = await apiFetch<{ insights: Insights }>(`/analytics/heatmap/insights?range=${range}`)
      setInsights(res.insights || null)
    } catch {
      setInsights(null)
    }
  }, [range])

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch<{ types: { type: string; last_generated: string; data_points: number }[] }>("/analytics/heatmap/status")
      setStatus(res)
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    loadData()
    loadInsights()
    loadStatus()
  }, [loadData, loadInsights, loadStatus])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const hours = range === "24h" ? 24 : range === "7d" ? 168 : 720
      await apiFetch("/analytics/heatmap/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ALL", hours }),
      })
      // Wait a bit for the job to process
      setTimeout(() => {
        loadData()
        loadInsights()
        loadStatus()
        setGenerating(false)
      }, 5000)
    } catch {
      setGenerating(false)
    }
  }

  const handleExportPng = async () => {
    if (!mapRef.current) return
    try {
      const dataUrl = await toPng(mapRef.current, { backgroundColor: "#18181b" })
      const link = document.createElement("a")
      link.download = `heatmap-${type}-${range}-${new Date().toISOString().slice(0, 10)}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Export failed:", err)
    }
  }

  if (!canAccess("heatmap")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-center text-zinc-500">
          <Flame className="mx-auto mb-3 h-10 w-10" />
          <p>Anda tidak memiliki akses ke halaman Heatmap.</p>
        </div>
      </div>
    )
  }

  const config = TYPE_CONFIG[type]

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-500/10 p-2">
              <Flame className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Heatmap Operasional</h1>
              <p className="text-sm text-zinc-500">Visualisasi zona panas berdasarkan data GPS real dan anomaly.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Generating..." : "Generate Data"}
          </button>
          <button
            onClick={handleExportPng}
            className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            <Download className="h-4 w-4" />
            Export PNG
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Type selector */}
        <div className="flex rounded-lg border border-white/10 bg-zinc-900 p-1">
          {(Object.keys(TYPE_CONFIG) as HeatmapType[]).map((t) => {
            const cfg = TYPE_CONFIG[t]
            const Icon = cfg.icon
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  type === t ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
              </button>
            )
          })}
        </div>

        {/* Time range */}
        <div className="flex rounded-lg border border-white/10 bg-zinc-900 p-1">
          {(["24h", "7d", "30d"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === r ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {r === "24h" ? "Last 24h" : r === "7d" ? "Last 7 days" : "Last 30 days"}
            </button>
          ))}
        </div>

        {/* Route filter */}
        <select
          value={routeId}
          onChange={(e) => setRouteId(e.target.value)}
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-300"
        >
          <option value="">Semua Route</option>
          {routes.map((r) => (
            <option key={r.route_id} value={r.route_id}>
              {r.name}
            </option>
          ))}
        </select>

        {/* Data count */}
        <span className="text-xs text-zinc-600">
          {loading ? "Loading..." : `${data.length} data points`}
        </span>
      </div>

      {/* Description */}
      <div className="mb-4 rounded-lg border border-white/5 bg-zinc-900/50 px-4 py-3">
        <p className="text-xs text-zinc-400">{config.description}</p>
      </div>

      {/* Map */}
      <div ref={mapRef} className="mb-6 overflow-hidden rounded-xl border border-white/10 bg-zinc-900" style={{ height: 500 }}>
        {data.length > 0 ? (
          <HeatmapMap data={data} type={type} gradient={config.gradient} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-zinc-600">
              <Flame className="mx-auto mb-3 h-10 w-10" />
              <p className="text-sm">
                {loading ? "Memuat data heatmap..." : "Belum ada data heatmap. Klik 'Generate Data' untuk memulai."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      {status && status.types.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {status.types.map((s) => (
            <div key={s.type} className="rounded-lg border border-white/5 bg-zinc-900 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{s.type.replace("_", " ")}</div>
              <div className="mt-1 text-lg font-bold text-white">{s.data_points}</div>
              <div className="text-[10px] text-zinc-600">
                Last: {new Date(s.last_generated).toLocaleString("id-ID")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Insights */}
      {insights && (
        <div className="grid gap-4 md:grid-cols-2">
          <InsightCard
            title="Halte Tersibuk"
            icon={MapPin}
            color="emerald"
            rows={insights.busiest_stops}
            columns={[
              { key: "stop_name", label: "Halte" },
              { key: "total_stops", label: "Stop Count" },
              { key: "total_vehicles", label: "Kendaraan" },
            ]}
          />
          <InsightCard
            title="Route Ngetem Tersering"
            icon={AlertTriangle}
            color="orange"
            rows={insights.most_ngetem_routes}
            columns={[
              { key: "route_name", label: "Route" },
              { key: "total_ngetem", label: "Ngetem" },
              { key: "total_vehicles", label: "Kendaraan" },
            ]}
          />
          <InsightCard
            title="Route Off-Route Tertinggi"
            icon={MapPin}
            color="red"
            rows={insights.most_off_route_routes}
            columns={[
              { key: "route_name", label: "Route" },
              { key: "total_off_route", label: "Off-Route" },
              { key: "total_vehicles", label: "Kendaraan" },
            ]}
          />
          <InsightCard
            title="Route Kecepatan Tinggi"
            icon={Gauge}
            color="blue"
            rows={insights.highest_speed_routes}
            columns={[
              { key: "route_name", label: "Route" },
              { key: "avg_speed", label: "Avg Speed" },
              { key: "max_speed", label: "Max Speed" },
            ]}
          />
        </div>
      )}
    </div>
  )
}

function InsightCard({
  title,
  icon: Icon,
  color,
  rows,
  columns,
}: {
  title: string
  icon: typeof Flame
  color: string
  rows: InsightRow[]
  columns: { key: string; label: string }[]
}) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/20 text-emerald-500",
    orange: "border-orange-500/20 text-orange-500",
    red: "border-red-500/20 text-red-500",
    blue: "border-blue-500/20 text-blue-500",
  }
  const borderColor = colorMap[color] || colorMap.emerald

  return (
    <div className={`rounded-xl border bg-zinc-900 p-4 ${borderColor.split(" ")[0]}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${borderColor.split(" ")[1]}`} />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-600">Belum ada data.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col) => (
                <th key={col.key} className="py-1 text-left font-medium text-zinc-500">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="py-1.5 text-zinc-300">
                    {(row as Record<string, unknown>)[col.key] ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

### Step 2: Commit

```bash
git add apps/operator-web/src/app/dashboard/heatmap/page.tsx
git commit -m "feat(web): add heatmap page with type/range selectors, map, insights, and export"
```

---

## Task 7: Heatmap Map Component

**Files:**
- Create: `apps/operator-web/src/components/heatmap/heatmap-map.tsx`

### Step 1: Write the heatmap map component

This component renders the Leaflet map with `L.heatLayer` overlay. It dynamically imports leaflet.heat (client-side only since Next.js SSR doesn't support Leaflet).

```tsx
"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet.heat"

type HeatmapPoint = {
  grid_lat: number
  grid_lon: number
  value: number
  vehicle_count: number
  metric: string
  metadata: Record<string, unknown>
  route_id: string | null
}

type Props = {
  data: HeatmapPoint[]
  type: string
  gradient: Record<number, string>
}

const BOGOR_CENTER: [number, number] = [-6.595, 106.805]

export default function HeatmapMap({ data, type, gradient }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const heatRef = useRef<L.Layer | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center: BOGOR_CENTER,
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(mapRef.current)
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return

    // Remove previous heat layer
    if (heatRef.current) {
      mapRef.current.removeLayer(heatRef.current)
      heatRef.current = null
    }

    if (data.length === 0) return

    // Normalize values for intensity
    const maxVal = Math.max(...data.map((d) => d.value), 1)

    const heatData: [number, number, number][] = data.map((d) => [
      d.grid_lat,
      d.grid_lon,
      d.value / maxVal,
    ])

    heatRef.current = L.heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      max: 1,
      gradient,
    }).addTo(mapRef.current)

    // Fit bounds to data
    if (heatData.length > 0) {
      const bounds = L.latLngBounds(heatData.map((d) => [d[0], d[1]] as [number, number]))
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    }

    // Add click popups for grid cells
    // Remove existing markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) {
        mapRef.current?.removeLayer(layer)
      }
    })

    data.forEach((d) => {
      const marker = L.circleMarker([d.grid_lat, d.grid_lon], {
        radius: 6,
        color: "transparent",
        fillColor: "transparent",
        fillOpacity: 0,
        interactive: true,
      })
      const meta = d.metadata || {}
      let popupContent = `
        <div style="font-size:12px;color:#fff;background:#18181b;padding:8px;border-radius:8px;min-width:160px;">
          <div style="font-weight:600;margin-bottom:4px;">${type.replace(/_/g, " ")}</div>
          <div><b>${d.metric}:</b> ${d.value}</div>
          <div><b>Kendaraan:</b> ${d.vehicle_count}</div>
          ${d.route_id ? `<div><b>Route:</b> ${d.route_id}</div>` : ""}
      `
      if (meta.stop_name) popupContent += `<div><b>Halte:</b> ${meta.stop_name}</div>`
      if (meta.avg_duration_min) popupContent += `<div><b>Avg durasi:</b> ${meta.avg_duration_min} min</div>`
      if (meta.max_speed) popupContent += `<div><b>Max speed:</b> ${meta.max_speed} km/h</div>`
      if (meta.point_count) popupContent += `<div><b>Data points:</b> ${meta.point_count}</div>`
      popupContent += `</div>`

      marker.bindPopup(popupContent, {
        className: "heatmap-popup",
        closeButton: false,
      })
      marker.addTo(mapRef.current!)
    })
  }, [data, type, gradient])

  return <div ref={containerRef} className="h-full w-full" />
}
```

### Step 2: Commit

```bash
git add apps/operator-web/src/components/heatmap/heatmap-map.tsx
git commit -m "feat(web): add HeatmapMap component with leaflet.heat and click popups"
```

---

## Task 8: Docker Compose & Testing

### Step 1: Rebuild and start containers

```bash
cd /Users/ztrenggono/developer/competitionProject/monitoring-angkot
docker compose -f infra/docker-compose/docker-compose.yml up -d --build
```

### Step 2: Run migration

```bash
docker compose -f infra/docker-compose/docker-compose.yml exec postgres psql -U monitoring -d Sentra -f /docker-entrypoint-initdb.d/migrations/015_heatmap_data.sql
```

### Step 3: Test API endpoints

```bash
# Login as ANALISA
TOKEN=$(curl -s -c cookies.txt -b cookies.txt http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"analisa@pemda.go.id","password":"password123"}' | jq -r '.token')

# Check heatmap status
curl -b cookies.txt http://localhost:4000/analytics/heatmap/status

# Generate heatmap data
curl -X POST -b cookies.txt http://localhost:4000/analytics/heatmap/generate \
  -H "Content-Type: application/json" \
  -d '{"type":"ALL","hours":168}'

# Wait 10s, then fetch data
curl -b cookies.txt "http://localhost:4000/analytics/heatmap?type=STOP_DENSITY&range=7d"
curl -b cookies.txt "http://localhost:4000/analytics/heatmap?type=NGETEM_ZONE&range=7d"
curl -b cookies.txt "http://localhost:4000/analytics/heatmap?type=OFF_ROUTE_ZONE&range=7d"
curl -b cookies.txt "http://localhost:4000/analytics/heatmap?type=SPEED_ZONE&range=7d"

# Get insights
curl -b cookies.txt "http://localhost:4000/analytics/heatmap/insights?range=7d"
```

### Step 4: Test in browser

1. Open `http://localhost:3000/auth/login`
2. Login with `analisa@pemda.go.id` / `password123`
3. Navigate to Heatmap in sidebar
4. Click "Generate Data" button
5. Wait ~5s, data should appear on map
6. Switch between STOP_DENSITY, NGETEM_ZONE, OFF_ROUTE_ZONE, SPEED_ZONE
7. Switch time range: 24h, 7d, 30d
8. Filter by route
9. Click on a heat zone to see popup details
10. Click "Export PNG" — PNG should download
11. Check insights panel below map
12. Verify insights show top stops, routes, speeds

### Step 5: Update task.md checkboxes

Mark all Phase 16 items as done in `doc1/task.md`.

### Step 6: Final commit

```bash
git add -A
git commit -m "feat: complete Phase 16 - Heatmap Operasional Real"
```

---

## Acceptance Criteria (Done Ketika)

| Criteria | How to verify |
|----------|---------------|
| Heatmap berhenti (stop density) terlihat di peta | Select STOP_DENSITY type, see green→yellow→red gradient on map |
| Heatmap ngetem zone terlihat di peta | Select NGETEM_ZONE type, see orange→red gradient on map |
| Heatmap off-route zone terlihat di peta | Select OFF_ROUTE_ZONE type, see yellow→red gradient on map |
| Heatmap speed zone terlihat di peta | Select SPEED_ZONE type, see green→yellow→red gradient on map |
| Filter time range bekerja | Switch 24h/7d/30d, data updates accordingly |
| Export PNG berfungsi | Click "Export PNG", PNG file downloads with map content |
| Insights ringkas bisa di-generated | Insights panel shows top stops, ngetem routes, off-route routes, speed routes |
