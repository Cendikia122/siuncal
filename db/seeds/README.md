# Seeds

Data seed untuk development/staging.

## Current Bogor Route Seed

`001_seed.sql` resets development data with `TRUNCATE ... RESTART IDENTITY CASCADE`
and rebuilds a deterministic Bogor angkot seed:

- trayek `01` Cipinang Gading - Terminal Merdeka,
- trayek `02` Sukasari - Terminal Bubulak,
- trayek `03` Terminal Baranangsiang - Terminal Bubulak,
- outbound/inbound PostGIS route geometry for each trayek,
- route checkpoints/stops for busy locations,
- vehicles, drivers, GPS devices, assignments, documents,
- `005_demo_fleet_45.sql` expands demo operations to 10 owners and 45 active
  vehicles while keeping the original core route/incident seed intact,
- moving `vehicle_positions` samples that stay on the trayek geometry,
- sample ngetem incidents/anomalies/alerts/risk scores.

`003_osrm_snap_to_road.sql` then replaces the rough route geometry with
prefetched OSRM road-network polylines, sets each route corridor to 8 meters,
deletes the old point-based geofences, and rebuilds `ROUTE_CORRIDOR` geofences
from the OSRM-snapped route geometry.

The current-route direction references were checked against public Bogor route
listings in May 2026. For MVP/demo scope, the seed keeps the existing core
operator routes `01`, `02`, and `03`; broader city route coverage can be added
once surveyed GIS coordinates or a maintained Dishub dataset is available.
