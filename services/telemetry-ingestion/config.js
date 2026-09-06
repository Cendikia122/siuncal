import { buildDemoFleetVehicles } from '../../apps/operator-web/src/lib/demo-scenario.mjs';

// Waypoints disampling langsung dari OSRM route polyline pada fraksi 0.000,
// 0.125, ..., 1.000 (audit 2026-05-20). Heading diselaraskan dengan segment
// yang dipilih local map matching agar demo tidak memicu false-positive
// OFF_ROUTE/WRONG_DIRECTION pada titik yang overlap inbound/outbound.
export const ROUTES = {
  '01': [
    { lat: -6.650652, lon: 106.811810, heading: 211.53 },
    { lat: -6.636607, lon: 106.813866, heading: 331.96 },
    { lat: -6.620315, lon: 106.807018, heading: 252.26 },
    { lat: -6.616870, lon: 106.810118, heading: 31.18 },
    { lat: -6.604953, lon: 106.807250, heading: 319.36 },
    { lat: -6.596638, lon: 106.793128, heading: 282.76 },
    { lat: -6.594998, lon: 106.789702, heading: 191.78 },
    { lat: -6.592988, lon: 106.782263, heading: 37.45 },
    { lat: -6.589167, lon: 106.787779, heading: 358.69 }
  ],
  '02': [
    { lat: -6.607419, lon: 106.801623, heading: 52.82 },
    { lat: -6.625015, lon: 106.809049, heading: 141.61 },
    { lat: -6.616358, lon: 106.804531, heading: 143.03 },
    { lat: -6.609601, lon: 106.811030, heading: 323.09 },
    { lat: -6.596815, lon: 106.793654, heading: 320.39 },
    { lat: -6.596657, lon: 106.793628, heading: 104.26 },
    { lat: -6.594820, lon: 106.778325, heading: 138.17 },
    { lat: -6.579574, lon: 106.763105, heading: 167.39 },
    { lat: -6.569729, lon: 106.754282, heading: 314.62 }
  ],
  '03': [
    { lat: -6.604242, lon: 106.806200, heading: 322.47 },
    { lat: -6.602185, lon: 106.805625, heading: 157.92 },
    { lat: -6.602514, lon: 106.800853, heading: 261.21 },
    { lat: -6.594540, lon: 106.787202, heading: 335.66 },
    { lat: -6.596644, lon: 106.793153, heading: 282.76 },
    { lat: -6.594671, lon: 106.783223, heading: 304.24 },
    { lat: -6.583665, lon: 106.769978, heading: 140.31 },
    { lat: -6.573549, lon: 106.759910, heading: 126.81 },
    { lat: -6.569729, lon: 106.754282, heading: 314.62 }
  ]
};

export const VEHICLES = buildDemoFleetVehicles({ routesById: ROUTES });

export const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:4000',
  API_ENDPOINT: '/telemetry/vehicle',
  INTERVAL_MS: process.env.INTERVAL_MS ? parseInt(process.env.INTERVAL_MS) : 5000,
  ACCURACY_M: 8.0,
  TELEMETRY_TOKEN: process.env.TELEMETRY_INGEST_TOKEN || ''
};
