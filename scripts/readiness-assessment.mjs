#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CATEGORIES = [
  {
    id: 'realtime_monitoring',
    label: 'Realtime monitoring',
    description: 'Kematangan ingestion GPS, state realtime, map matching, rules anomaly, dan dashboard operator.',
    checks: [
      check('Telemetry ingestion service', 12, ['services/telemetry-ingestion/package.json', 'services/telemetry-ingestion/src'], ['telemetry', 'ingest']),
      check('API realtime endpoint / websocket', 12, ['services/api-gateway/src/server.js'], ['realtime', 'WebSocket', 'vehicles']),
      check('Database time-series telemetry + map matching', 12, ['db/migrations/010_telemetry_map_matching.sql', 'db/migrations/012_passenger_tracking.sql'], ['vehicle_positions', 'snapped']),
      check('Rules engine dan anomaly scoring', 12, ['services/rules-engine/package.json', 'db/migrations/005_anomaly_alerts.sql', 'db/migrations/006_risk_scoring.sql'], ['anomaly', 'risk']),
      check('Operator dashboard map/command center', 12, ['apps/operator-web/src/app/dashboard/page.tsx', 'apps/operator-web/src/components/map/map-view.tsx'], ['dashboard', 'vehicle']),
      check('Heatmap/network intelligence artifacts', 8, ['db/migrations/014_phase15_network_sanctions.sql', 'db/migrations/015_heatmap_data.sql'], ['heatmap', 'collective']),
      check('Scale-out runbook for high traffic', 8, ['docs/runbooks/scale-out.md'], ['PgBouncer', 'TimescaleDB', 'retention']),
      check('GPS tracker integration runbook', 8, ['docs/runbooks/gps-gt06-integration.md'], ['GT06', 'Traccar', 'adapter']),
      check('Security hardening runbook', 8, ['docs/runbooks/security-hardening.md'], ['rate limit', 'RBAC', 'secret']),
      check('QA readiness report', 8, ['docs/qa/final-demo-readiness.md', 'docs/qa/2026-05-08-comprehensive-qa-report.md'], ['QA', 'Performance', 'Security'])
    ]
  },
  {
    id: 'passenger_mobile',
    label: 'Passenger mobile app',
    description: 'Kematangan aplikasi mobile Flutter untuk tracking publik, laporan warga, auth, dan distribusi.',
    checks: [
      check('Flutter app scaffold iOS/Android', 12, ['apps/passenger-mobile/pubspec.yaml', 'apps/passenger-mobile/lib/main.dart', 'apps/passenger-mobile/android', 'apps/passenger-mobile/ios'], ['flutter', 'sentra_passenger']),
      check('Public vehicle tracking data layer', 14, ['apps/passenger-mobile/lib/features/vehicles/data/vehicles_repository.dart', 'apps/passenger-mobile/lib/features/vehicles/providers/vehicles_provider.dart'], ['public', 'vehicle']),
      check('Foreground passenger tracking flow', 14, ['apps/passenger-mobile/lib/features/tracking/tracking_controller.dart', 'apps/passenger-mobile/lib/features/tracking/data/telemetry_repository.dart'], ['tracking', 'session']),
      check('Public report flow + categories', 12, ['apps/passenger-mobile/lib/features/report/data/report_repository.dart', 'apps/passenger-mobile/lib/features/report/models/report_category.dart'], ['report', 'category']),
      check('Login/session management', 10, ['apps/passenger-mobile/lib/features/auth/data/auth_repository.dart', 'apps/passenger-mobile/lib/features/auth/providers/session_provider.dart'], ['login', 'session']),
      check('Mobile UI screens for passenger use cases', 10, ['apps/passenger-mobile/lib/features/home/presentation/home_screen.dart', 'apps/passenger-mobile/lib/features/nearby/presentation/nearby_screen.dart', 'apps/passenger-mobile/lib/features/routes/presentation/trayek_info_screen.dart'], ['Screen', 'Route']),
      check('Mobile tests available', 8, ['apps/passenger-mobile/test/data_test.dart', 'apps/passenger-mobile/test/widget_test.dart'], ['test', 'expect']),
      check('Bundled fonts/design system', 6, ['apps/passenger-mobile/assets/fonts/Inter-Regular.ttf', 'apps/passenger-mobile/lib/core/theme/app_theme.dart'], ['ThemeData', 'Inter']),
      check('Mobile build/release runbook', 8, [['docs/runbooks/mobile-flutter-build.md', 'docs/runbooks/mobile-eas-build.md']], ['Flutter', 'build', 'release']),
      check('API contract documented for mobile/public features', 6, ['docs/16-public-report-and-passenger-mobile.md', 'doc1/API.md'], ['public', 'report', 'tracking'])
    ]
  },
  {
    id: 'government_scale',
    label: 'Government-scale operations',
    description: 'Kesiapan untuk data besar, keamanan, audit, deployment, dan operasional pemerintah daerah.',
    checks: [
      check('Postgres/PostGIS/Timescale schema foundation', 14, ['db/migrations/001_init.sql', 'db/migrations/003_auth_security.sql', 'docs/03-database-schema-postgres-timescale.md'], ['PostGIS', 'TimescaleDB', 'audit']),
      check('Docker compose reproducibility', 12, ['infra/docker-compose/docker-compose.yml', 'infra/docker-compose/README.md'], ['postgres', 'redis', 'api-gateway']),
      check('Kubernetes/deployment path documented', 8, ['infra/k8s/README.md'], ['kubernetes', 'deployment']),
      check('Observability/monitoring plan', 10, ['infra/monitoring/README.md', 'docs/runbooks/scale-out.md'], ['Prometheus', 'Grafana', 'observability']),
      check('Auth, RBAC, CSRF/security implementation', 14, ['services/api-gateway/src/server.js', 'db/migrations/003_auth_security.sql'], ['RBAC', 'csrf', 'jwt']),
      check('Audit log and accountability', 10, ['db/migrations/004_audit_log.sql', 'services/api-gateway/src/server.js'], ['audit', 'actor']),
      check('Seed/demo data and recovery scripts', 8, ['db/seeds/README.md', 'scripts/QUICK_START.md', 'scripts/status.sh'], ['seed', 'quick', 'status']),
      check('Cost and data-volume planning', 8, ['docs/06-cloud-cost-estimate.md'], ['telemetry', 'per hari', 'storage']),
      check('Official stakeholder/data requirements', 8, ['docs/17-government-stakeholders-data.md', 'doc1/DATA-REGIS.MD'], ['Dishub', 'pemerintah', 'owner']),
      check('Production security runbook', 8, ['docs/runbooks/security-hardening.md'], ['HTTPS', 'secret', 'rate limit'])
    ]
  }
];

function check(label, weight, paths, keywords = []) {
  return { label, weight, pathGroups: normalizePathGroups(paths), keywords };
}

function normalizePathGroups(paths) {
  return paths.map((entry) => (Array.isArray(entry) ? entry : [entry]));
}

function flattenPathGroups(pathGroups) {
  return pathGroups.flat();
}

function readIfFile(target) {
  try {
    if (!existsSync(target)) return '';
    const stat = readFileSync(target, { encoding: 'utf8', flag: 'r' });
    return stat;
  } catch {
    return '';
  }
}

function hasPath(root, candidate) {
  return existsSync(path.join(root, candidate));
}

function keywordHits(root, pathGroups, keywords) {
  if (keywords.length === 0) return [];
  const corpus = flattenPathGroups(pathGroups).map((candidate) => readIfFile(path.join(root, candidate))).join('\n').toLowerCase();
  return keywords.filter((keyword) => corpus.includes(keyword.toLowerCase()));
}

function pathEvidence(root, pathGroups) {
  const presentPaths = flattenPathGroups(pathGroups).filter((candidate) => hasPath(root, candidate));
  const satisfiedGroups = pathGroups.filter((group) => group.some((candidate) => hasPath(root, candidate))).length;
  return {
    presentPaths,
    pathRatio: pathGroups.length === 0 ? 1 : satisfiedGroups / pathGroups.length
  };
}

export function assessProject(root = DEFAULT_ROOT) {
  const categories = CATEGORIES.map((category) => {
    const checks = category.checks.map((item) => {
      const { presentPaths, pathRatio } = pathEvidence(root, item.pathGroups);
      const hits = keywordHits(root, item.pathGroups, item.keywords);
      const hasAnyPath = presentPaths.length > 0;
      const keywordRatio = item.keywords.length === 0 ? 1 : hits.length / item.keywords.length;
      const status = !hasAnyPath ? 'missing' : pathRatio < 1 || keywordRatio < 0.5 ? 'partial' : 'ready';
      const evidenceRatio = Math.min(pathRatio, keywordRatio);
      const score = status === 'missing' ? 0 : Math.round(item.weight * (status === 'partial' ? Math.max(0.3, evidenceRatio * 0.8) : 1));
      return { ...item, presentPaths, pathRatio, keywordHits: hits, status, score };
    });
    const maxScore = checks.reduce((sum, item) => sum + item.weight, 0);
    const score = checks.reduce((sum, item) => sum + item.score, 0);
    const percent = Math.round((score / maxScore) * 100);
    return { id: category.id, label: category.label, description: category.description, score, maxScore, percent, maturity: maturity(percent), checks };
  });
  const maxScore = categories.reduce((sum, item) => sum + item.maxScore, 0);
  const score = categories.reduce((sum, item) => sum + item.score, 0);
  const percent = Math.round((score / maxScore) * 100);
  return {
    generatedAt: new Date().toISOString(),
    root,
    score,
    maxScore,
    percent,
    maturity: maturity(percent),
    categories,
    recommendation: recommendation(percent, categories)
  };
}

export function maturity(percent) {
  if (percent >= 85) return 'Siap pilot produksi terbatas';
  if (percent >= 70) return 'Siap demo/pilot dengan hardening';
  if (percent >= 50) return 'Prototype kuat, belum production-ready';
  return 'Masih tahap fondasi';
}

function recommendation(percent, categories) {
  const weakest = [...categories].sort((a, b) => a.percent - b.percent)[0];
  if (percent >= 85) return `Lanjutkan pilot terkontrol; fokus stress test, SLO, dan SOP operasional. Area terlemah: ${weakest.label}.`;
  if (percent >= 70) return `Layak untuk demo pemerintah/pilot kecil, tetapi jangan langsung skala kota penuh sebelum P0 production hardening selesai. Area prioritas: ${weakest.label}.`;
  return `Belum layak untuk operasional pemerintah skala kota. Selesaikan gap utama pada ${weakest.label} dan validasi ulang dengan load/security test.`;
}

export function renderMarkdown(report) {
  const lines = [];
  lines.push('# Readiness Assessment — Monitoring Angkot Bogor');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(`## Executive Summary`);
  lines.push('');
  lines.push(`- Repository evidence readiness: **${report.percent}% (${report.maturity})**`);
  lines.push(`- Recommendation: ${report.recommendation}`);
  lines.push('- Interpretasi: skor ini mengukur kelengkapan evidence di repository. Ini **bukan** bukti production-ready sampai load test, SLO, audit keamanan, dan validasi rilis mobile selesai.');
  lines.push('');
  lines.push('## Category Scores');
  lines.push('');
  lines.push('| Area | Score | Maturity |');
  lines.push('| --- | ---: | --- |');
  for (const category of report.categories) {
    lines.push(`| ${category.label} | ${category.percent}% | ${category.maturity} |`);
  }
  lines.push('');
  for (const category of report.categories) {
    lines.push(`## ${category.label}`);
    lines.push('');
    lines.push(category.description);
    lines.push('');
    lines.push(`Score: **${category.percent}%**`);
    lines.push('');
    lines.push('| Check | Status | Evidence |');
    lines.push('| --- | --- | --- |');
    for (const item of category.checks) {
      const evidence = item.presentPaths.length > 0 ? item.presentPaths.join('<br>') : 'Belum ditemukan';
      lines.push(`| ${item.label} | ${statusLabel(item.status)} | ${evidence} |`);
    }
    lines.push('');
  }
  lines.push('## Production Go/No-Go Notes');
  lines.push('');
  lines.push('- Untuk pemerintah/kota penuh, wajib ada load test telemetry, websocket fan-out test, backup/restore drill, incident response SOP, dan privacy impact assessment.');
  lines.push('- Untuk mobile app, wajib validasi perangkat iOS/Android nyata, permission background location, battery impact, offline/error states, dan release signing.');
  lines.push('- Untuk realtime monitoring, wajib ukur end-to-end latency GPS → ingestion → state → dashboard, bukan hanya keberadaan endpoint.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function statusLabel(status) {
  if (status === 'ready') return '✅ Ready evidence';
  if (status === 'partial') return '⚠️ Partial evidence';
  return '❌ Missing evidence';
}

export async function checkApiHealth(baseUrl, { fetchImpl = fetch, timeoutMs = 3000 } = {}) {
  if (!baseUrl) {
    return { ok: true, skipped: true, reason: 'SMOKE_BASE_URL/STAGING_API_URL not set' };
  }

  let healthUrl;
  try {
    healthUrl = new URL('/health', baseUrl).toString();
  } catch (error) {
    return { ok: false, url: baseUrl, message: `API health URL tidak valid: ${error.message}` };
  }

  try {
    const response = await fetchImpl(healthUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return { ok: false, url: healthUrl, message: `API health returned HTTP ${response.status}` };
    }
    return { ok: true, url: healthUrl };
  } catch (error) {
    return { ok: false, url: healthUrl, message: `API health unreachable: ${error.message}` };
  }
}

function isCiMode(argv, env = process.env) {
  return argv.includes('--ci') || env.CI === 'true';
}

function ciApiBaseUrl(env = process.env) {
  return env.SMOKE_BASE_URL || env.STAGING_API_URL || env.STAGING_BASE_URL || '';
}

function parseArgs(argv) {
  return {
    root: valueAfter(argv, '--root') ?? DEFAULT_ROOT,
    format: argv.includes('--json') ? 'json' : 'markdown',
    ci: isCiMode(argv)
  };
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  if (args.ci) {
    const health = await checkApiHealth(ciApiBaseUrl(process.env));
    if (!health.ok) {
      console.error(`Readiness CI failed: ${health.message}`);
      if (health.url) console.error(`Health URL: ${health.url}`);
      process.exit(1);
    }
  }

  const report = assessProject(path.resolve(args.root));
  process.stdout.write(args.format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report));
}
