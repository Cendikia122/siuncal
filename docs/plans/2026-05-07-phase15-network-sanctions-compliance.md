# Phase 15: Network View, Collective Anomaly, Sanction Workflow Implementation Plan

**Goal:** Add entity relationship visualization, collective anomaly detection, formal sanction workflow, and fleet compliance dashboard to the monitoring-angkot system.

**Architecture:** 1 new migration (014), collective anomaly job in rules-engine, ~11 new API routes in server.js monolith, 3 new Next.js pages (network, sanctions, compliance), sidebar + auth-store updates. All patterns follow existing conventions exactly.

**Tech Stack:** PostgreSQL/PostGIS, Express.js, Next.js 16 App Router, @xyflow/react (graph viz), Recharts, shadcn/ui, Tailwind CSS, html-to-image (PNG export)

---

## Task 1: Database Migration

**Files:**
- Create: `db/migrations/014_phase15_network_sanctions.sql`

### Step 1: Write migration SQL

```sql
-- Phase 15: Network View, Collective Anomaly, Sanction Workflow

-- 1. Collective Anomalies
CREATE TABLE IF NOT EXISTS collective_anomalies (
  collective_anomaly_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('OWNER_MULTI_HIGH_RISK','ROUTE_CLUSTER_VIOLATION','DEVICE_REASSIGN_ABUSE','TIMING_COORDINATION')),
  severity text NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ESCALATED','RESOLVED')),
  evidence jsonb NOT NULL DEFAULT '{}',
  involved_vehicles uuid[] NOT NULL DEFAULT '{}',
  involved_owners uuid[],
  route_id text REFERENCES routes(route_id),
  incident_id uuid REFERENCES incidents(incident_id) ON DELETE SET NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  escalation_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collective_anomalies_status ON collective_anomalies (status, severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_collective_anomalies_type ON collective_anomalies (type, detected_at DESC);

-- 2. Sanctions
CREATE TABLE IF NOT EXISTS sanctions (
  sanction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  owner_id uuid REFERENCES owners(owner_id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('WARNING','COACHING','ADMINISTRATIVE','SUSPENSION','REVOCATION')),
  level text NOT NULL CHECK (level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  incident_id uuid REFERENCES incidents(incident_id) ON DELETE SET NULL,
  collective_anomaly_id uuid REFERENCES collective_anomalies(collective_anomaly_id) ON DELETE SET NULL,
  decided_by uuid NOT NULL REFERENCES users(user_id),
  decided_at timestamptz NOT NULL DEFAULT now(),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','REVOKED','RENEWED')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vehicle_id IS NOT NULL OR owner_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_sanctions_vehicle ON sanctions (vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_sanctions_owner ON sanctions (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_sanctions_status ON sanctions (status, effective_from DESC);

-- 3. Sanction Actions (audit trail)
CREATE TABLE IF NOT EXISTS sanction_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sanction_id uuid NOT NULL REFERENCES sanctions(sanction_id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('CREATE','RENEW','REVOKE','NOTE')),
  actor_id uuid REFERENCES users(user_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sanction_actions_sanction ON sanction_actions (sanction_id, created_at DESC);

-- 4. Extend risk_score_events event_type to include new types
ALTER TABLE risk_score_events DROP CONSTRAINT IF EXISTS risk_score_events_event_type_check;
ALTER TABLE risk_score_events ADD CONSTRAINT risk_score_events_event_type_check
  CHECK (event_type IN ('ANOMALY','DAILY_DECAY','WEEKLY_DECAY','COLLECTIVE_ANOMALY','OWNER_PROPAGATION'));
```

### Step 2: Run migration

```bash
cd /Users/ztrenggono/developer/competitionProject/monitoring-angkot
docker compose exec postgres psql -U monitoring -d Sentra -f /docker-entrypoint-initdb.d/migrations/014_phase15_network_sanctions.sql
# or direct:
psql -U monitoring -d Sentra -f db/migrations/014_phase15_network_sanctions.sql
```

### Step 3: Commit

```bash
git add db/migrations/014_phase15_network_sanctions.sql
git commit -m "feat(db): add migration 014 for collective_anomalies, sanctions, sanction_actions"
```

---

## Task 2: Collective Anomaly Detection Job

**Files:**
- Modify: `services/rules-engine/src/index.js`

Add 4 detection functions + hourly loop at the end of the file, using the existing `query()` function and pattern.

### Step 1: Add detection functions

Add after the existing `applyRiskDecay` function (around line ~1060):

**`detectOwnerMultiHighRisk()`** — Find owners with >=2 vehicles at HIGH/CRITICAL risk simultaneously. UPSERT into collective_anomalies.

**`detectRouteClusterViolation()`** — Find routes where >=3 vehicles have OFF_ROUTE anomalies in last 2 hours.

**`detectDeviceReassignAbuse()`** — Find devices assigned to >=3 different vehicles in 7 days.

**`detectTimingCoordination()`** — Find owners with >=3 anomalies at the same hour across 3+ days in 7 days.

**`applyOwnerRiskPropagation()`** — For owners with >=2 HIGH-risk vehicles OR active collective anomalies OR prior sanctions, apply small risk delta (+5) to their vehicles. Dedup: only once per 24h per vehicle.

**`runCollectiveAnomalyDetection()`** — Calls all 5 functions sequentially.

### Step 2: Add hourly loop

At the bottom of the file:
```javascript
const collectiveIntervalMs = Number(process.env.COLLECTIVE_INTERVAL_MS || 3600000);
const runCollective = async () => {
  try {
    await runCollectiveAnomalyDetection();
  } catch (error) {
    console.error("collective-anomaly-detection error", error);
  } finally {
    setTimeout(runCollective, collectiveIntervalMs);
  }
};
setTimeout(runCollective, 60000);
```

### Step 3: Commit

```bash
git add services/rules-engine/src/index.js
git commit -m "feat(rules-engine): add collective anomaly detection job (hourly)"
```

---

## Task 3: Backend API Routes

**Files:**
- Modify: `services/api-gateway/src/server.js`

Add all new routes before the server start section. All follow existing pattern: `app.METHOD(path, auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => { ... }))`.

### Routes to add:

| Route | Method | Purpose |
|-------|--------|---------|
| `/sanctions` | GET | List sanctions with filters (status, type, owner_id, vehicle_id) |
| `/sanctions/:id` | GET | Sanction detail + action history |
| `/sanctions` | POST | Create sanction (ANALISA only) |
| `/sanctions/:id/actions` | POST | RENEW / REVOKE / NOTE action |
| `/sanctions/export` | GET | Export CSV/PDF |
| `/collective-anomalies` | GET | List collective anomalies |
| `/collective-anomalies/:id/escalate` | POST | Escalate to incident |
| `/network/graph` | GET | Graph nodes+edges+rankings |
| `/network/graph/export` | GET | Export graph CSV |
| `/compliance/fleet` | GET | Fleet compliance per-owner |
| `/compliance/fleet/export` | GET | Export compliance CSV/PDF |

### Key query for `/network/graph`:

Returns `{ nodes: [], edges: [], rankings: { top_owners, top_routes, top_devices } }`:
- Nodes: owners, their vehicles, assigned devices
- Edges: owner→vehicle (owns), vehicle→device (device_installed), vehicle→incident (has_incident), vehicle/owner→sanction (has_sanction)
- Filter by owner_id, route_id, device_id, date range
- Rankings: top owners by incident count, top routes by anomaly count, top devices by tamper signals

### Key query for `/compliance/fleet`:

```sql
SELECT
  o.owner_id, o.name, o.owner_type, o.status,
  COUNT(DISTINCT v.vehicle_id)::int AS total_vehicles,
  ROUND(AVG(COALESCE(rs.current_score, 0))::numeric, 1) AS avg_risk_score,
  COUNT(DISTINCT i.incident_id) FILTER (WHERE i.created_at >= now() - interval '30 days')::int AS incident_count_30d,
  COUNT(DISTINCT s.sanction_id) FILTER (WHERE s.status = 'ACTIVE')::int AS active_sanction_count,
  GREATEST(0, ROUND(100 - AVG(COALESCE(rs.current_score, 0)) - COUNT(DISTINCT s.sanction_id) FILTER (WHERE s.status = 'ACTIVE') * 10)::numeric) AS compliance_score
FROM owners o
LEFT JOIN vehicles v ON v.owner_id = o.owner_id
LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
LEFT JOIN incidents i ON i.vehicle_id = v.vehicle_id
LEFT JOIN sanctions s ON (s.owner_id = o.owner_id OR s.vehicle_id = v.vehicle_id)
GROUP BY o.owner_id
ORDER BY compliance_score ASC
```

### Modify existing endpoints:

- **`GET /vehicles/:id`**: Add `active_sanction_count` from sanctions table
- **`GET /owners/:id`**: Add `active_sanctions` array + `collective_anomaly_count`

### Step: Commit

```bash
git add services/api-gateway/src/server.js
git commit -m "feat(api): add sanctions CRUD, collective anomalies, network graph, compliance endpoints"
```

---

## Task 4: Auth Store + Sidebar Updates

**Files:**
- Modify: `apps/operator-web/src/store/auth-store.ts`
- Modify: `apps/operator-web/src/components/layout/sidebar.tsx`

### Step 1: Update auth-store.ts

Add to `FeatureKey` type:
```typescript
| "network"
| "sanctions"
| "compliance"
```

Add to `FEATURE_ACCESS`:
```typescript
network: ["ANALISA"],
sanctions: ["ANALISA"],
compliance: ["ANALISA"],
```

### Step 2: Update sidebar.tsx

Import icons: `Network, Gavel, ClipboardCheck` from lucide-react.

In the "Analisa & Kontrol" NavGroup, add after Intelligence:
```tsx
{canAccess("network") && <NavItem href="/dashboard/network" icon={Network} label="Network View" active={isActive("/dashboard/network")} />}
{canAccess("sanctions") && <NavItem href="/dashboard/sanctions" icon={Gavel} label="Sanctions" active={isActive("/dashboard/sanctions")} />}
{canAccess("compliance") && <NavItem href="/dashboard/compliance" icon={ClipboardCheck} label="Compliance" active={isActive("/dashboard/compliance")} />}
```

### Step 3: Commit

```bash
git add apps/operator-web/src/store/auth-store.ts apps/operator-web/src/components/layout/sidebar.tsx
git commit -m "feat(web): add network, sanctions, compliance to sidebar and auth store"
```

---

## Task 5: Network View Page

**Files:**
- Create: `apps/operator-web/src/app/dashboard/network/page.tsx`

### Step 1: Install dependencies

```bash
cd apps/operator-web && npm install @xyflow/react html-to-image
```

### Step 2: Build the Network View page

A `"use client"` page wrapped in `<RoleGate roles="ANALISA">` with:

**Layout:**
- Top: filter bar (owner dropdown, route dropdown, date range)
- Center: `<ReactFlow>` graph with custom nodes (OwnerNode, VehicleNode, DeviceNode)
- Right sidebar: Rankings panels (top owners, routes, devices) using existing card/section patterns
- Bottom: Export buttons (PNG via `html-to-image`, CSV via `apiDownload`)

**Data flow:**
```typescript
const [graphData, setGraphData] = useState<NetworkGraphResponse | null>(null)
useEffect(() => {
  apiFetch<NetworkGraphResponse>(`/network/graph?${params}`).then(setGraphData)
}, [filters])
```

**Custom nodes** styled to match dark theme (zinc-900 bg, emerald/red/orange accents based on risk level). Click handler shows popover with entity details.

**Edge labels**: "owns", "installed", "incident", "sanction" with appropriate colors.

**Zoom/pan**: Built-in ReactFlow. MiniMap for large graphs.

### Step 3: Commit

```bash
git add apps/operator-web/src/app/dashboard/network/ apps/operator-web/package.json apps/operator-web/package-lock.json
git commit -m "feat(web): add Network View page with graph visualization"
```

---

## Task 6: Sanctions Page

**Files:**
- Create: `apps/operator-web/src/app/dashboard/sanctions/page.tsx`

### Step 1: Build the Sanctions page

A `"use client"` page with:

**List view:**
- Filter bar: status, type, owner, vehicle
- Table: Vehicle Plate, Owner, Type, Level, Status (badge), Effective From/Until, Decided By
- Row actions: View Detail, RENEW, REVOKE

**Create dialog:**
- Vehicle selector (autocomplete), auto-populates owner
- Type select (WARNING/COACHING/ADMINISTRATIVE/SUSPENSION/REVOCATION)
- Level select (LOW/MEDIUM/HIGH/CRITICAL) — auto-suggested from risk score mapping
- Reason textarea (required)
- Link to incident (optional select)
- Effective date range
- Notes
- Submit → POST /sanctions

**Export buttons:** CSV and PDF via apiDownload

### Step 2: Add sanction flags to vehicle/owner detail

Modify `apps/operator-web/src/app/dashboard/vehicles/[id]/page.tsx`:
- If `active_sanction_count > 0`, show alert banner linking to sanctions page

Modify `apps/operator-web/src/app/dashboard/owners/[id]/page.tsx`:
- Same banner for owner active sanctions

### Step 3: Commit

```bash
git add apps/operator-web/src/app/dashboard/sanctions/ apps/operator-web/src/app/dashboard/vehicles/[id]/page.tsx apps/operator-web/src/app/dashboard/owners/[id]/page.tsx
git commit -m "feat(web): add Sanctions page with create/manage workflow and flags on vehicle/owner detail"
```

---

## Task 7: Fleet Compliance Dashboard

**Files:**
- Create: `apps/operator-web/src/app/dashboard/compliance/page.tsx`

### Step 1: Build the Compliance page

A `"use client"` page with:

**Summary cards:** Total Owners, Avg Compliance Score, Total Active Sanctions, Total Vehicles

**Table:** Owner Name, Total Vehicles, Avg Risk Score (color badge), Incidents (30d), Active Sanctions, Compliance Score (progress bar 0-100, green→red)

**Chart:** Recharts BarChart showing compliance score distribution across owners

**Row click:** Navigate to `/dashboard/owners/[id]`

**Export:** CSV and PDF

### Step 2: Commit

```bash
git add apps/operator-web/src/app/dashboard/compliance/
git commit -m "feat(web): add Fleet Compliance Dashboard with export"
```

---

## Task 8: Collective Anomaly Display on Dashboard

**Files:**
- Modify: `apps/operator-web/src/app/dashboard/page.tsx` (or intelligence page)

### Step 1: Add collective anomaly section

Add a small section/card to the main dashboard or intelligence page showing active collective anomalies:
- Count badge
- List with type, severity, involved vehicles count
- Click to expand → shows evidence + "Escalate to Incident" button

### Step 2: Commit

```bash
git add apps/operator-web/src/app/dashboard/
git commit -m "feat(web): display collective anomalies on dashboard"
```

---

## Verification Plan

### Backend:
1. Run migration: `psql -d Sentra -f db/migrations/014_phase15_network_sanctions.sql` — verify tables exist
2. Start rules engine, wait 60s, check logs for "collective-anomaly-detection" output
3. Test API endpoints with curl:
   - `curl localhost:4000/sanctions` (with auth cookie)
   - `curl localhost:4000/network/graph`
   - `curl localhost:4000/compliance/fleet`
   - `curl -X POST localhost:4000/sanctions -d '...'` (create sanction)

### Frontend:
1. `cd apps/operator-web && npm run build` — must succeed
2. `cd apps/operator-web && npm run lint` — must succeed
3. Start dev server, login as ANALISA user
4. Verify sidebar shows Network View, Sanctions, Compliance
5. Network View: graph renders with nodes/edges, filters work, click node shows detail, export PNG/CSV
6. Sanctions: create a sanction, see it in list, RENEW/REVOKE actions work, export works
7. Compliance: table shows per-owner metrics, click navigates to owner detail, export works
8. Vehicle detail: sanction flag banner appears for vehicles with active sanctions
9. Owner detail: same for owners with active sanctions

### End-to-end:
1. Run simulator for ~10 minutes to generate anomalies/incidents
2. Wait for collective anomaly detection job to run (or trigger manually with `COLLECTIVE_INTERVAL_MS=5000`)
3. Verify collective anomalies appear on dashboard
4. Create a sanction for a high-risk vehicle
5. Verify sanction flag appears on vehicle detail
6. Export compliance report and verify it contains sanction data
7. Check Network View shows the sanction edge in the graph
