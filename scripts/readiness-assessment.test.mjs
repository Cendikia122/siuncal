import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { assessProject, checkApiHealth, maturity, renderMarkdown } from './readiness-assessment.mjs';

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'sentra-readiness-'));
  return {
    root,
    file(relativePath, content = '') {
      const target = path.join(root, relativePath);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content);
    },
    dir(relativePath) {
      mkdirSync(path.join(root, relativePath), { recursive: true });
    }
  };
}

test('maturity labels follow documented thresholds', () => {
  assert.equal(maturity(90), 'Siap pilot produksi terbatas');
  assert.equal(maturity(75), 'Siap demo/pilot dengan hardening');
  assert.equal(maturity(55), 'Prototype kuat, belum production-ready');
  assert.equal(maturity(20), 'Masih tahap fondasi');
});

test('assessProject reports missing evidence for empty repository', () => {
  const fx = fixture();
  const report = assessProject(fx.root);

  assert.equal(report.percent, 0);
  assert.equal(report.maturity, 'Masih tahap fondasi');
  assert.equal(report.categories.length, 3);
  assert.ok(report.categories.every((category) => category.percent === 0));
  assert.ok(report.categories.flatMap((category) => category.checks).every((check) => check.status === 'missing'));
});

test('assessProject scores ready and partial checks from paths plus keywords', () => {
  const fx = fixture();
  fx.file('services/api-gateway/src/server.js', 'const RBAC = true; const csrf = true; const jwt = true; const realtime = true; class WebSocket {} const vehicles = []; const audit = true; const actor = true;');
  fx.file('db/migrations/003_auth_security.sql', '-- RBAC csrf jwt');
  fx.file('db/migrations/004_audit_log.sql', '-- audit actor');
  fx.file('apps/passenger-mobile/pubspec.yaml', 'name: sentra_passenger\ndescription: flutter app');
  fx.file('apps/passenger-mobile/lib/main.dart', 'void main() {}');
  fx.dir('apps/passenger-mobile/android');
  fx.dir('apps/passenger-mobile/ios');
  fx.file('apps/passenger-mobile/lib/features/vehicles/data/vehicles_repository.dart', 'public vehicle repository');
  fx.file('apps/passenger-mobile/lib/features/vehicles/providers/vehicles_provider.dart', 'public vehicle provider');
  fx.file('docs/runbooks/scale-out.md', 'PgBouncer TimescaleDB retention');

  const report = assessProject(fx.root);
  const realtime = report.categories.find((category) => category.id === 'realtime_monitoring');
  const mobile = report.categories.find((category) => category.id === 'passenger_mobile');
  const gov = report.categories.find((category) => category.id === 'government_scale');

  assert.ok(realtime.checks.some((check) => check.label === 'API realtime endpoint / websocket' && check.status === 'ready'));
  assert.ok(realtime.checks.some((check) => check.label === 'Scale-out runbook for high traffic' && check.status === 'ready'));
  assert.ok(mobile.checks.some((check) => check.label === 'Flutter app scaffold iOS/Android' && check.status === 'ready'));
  assert.ok(mobile.checks.some((check) => check.label === 'Public vehicle tracking data layer' && check.status === 'ready'));
  assert.ok(gov.checks.some((check) => check.label === 'Auth, RBAC, CSRF/security implementation' && check.status === 'ready'));
  assert.ok(report.percent > 0);
});

test('assessProject treats missing peer artifacts as partial evidence, not ready', () => {
  const fx = fixture();
  fx.file('apps/passenger-mobile/pubspec.yaml', 'name: sentra_passenger\ndescription: flutter app');
  fx.file('apps/passenger-mobile/lib/features/tracking/tracking_controller.dart', 'tracking session controller');
  fx.file('infra/docker-compose/docker-compose.yml', 'services:\n  postgres:\n  redis:\n  api-gateway:');

  const report = assessProject(fx.root);
  const mobile = report.categories.find((category) => category.id === 'passenger_mobile');
  const gov = report.categories.find((category) => category.id === 'government_scale');

  assert.ok(mobile.checks.some((check) => check.label === 'Flutter app scaffold iOS/Android' && check.status === 'partial'));
  assert.ok(mobile.checks.some((check) => check.label === 'Foreground passenger tracking flow' && check.status === 'partial'));
  assert.ok(gov.checks.some((check) => check.label === 'Docker compose reproducibility' && check.status === 'partial'));
});

test('assessProject allows explicit alternative artifacts for runbooks', () => {
  const fx = fixture();
  fx.file('docs/runbooks/mobile-eas-build.md', 'Flutter build release');

  const report = assessProject(fx.root);
  const mobile = report.categories.find((category) => category.id === 'passenger_mobile');

  assert.ok(mobile.checks.some((check) => check.label === 'Mobile build/release runbook' && check.status === 'ready'));
});

test('renderMarkdown includes executive summary, scores, evidence and go/no-go notes', () => {
  const fx = fixture();
  fx.file('docs/runbooks/security-hardening.md', 'HTTPS secret rate limit RBAC');
  const report = assessProject(fx.root);
  const markdown = renderMarkdown(report);

  assert.match(markdown, /^# Readiness Assessment — Monitoring Angkot Bogor/m);
  assert.match(markdown, /Repository evidence readiness:/);
  assert.match(markdown, /bukan\*\* bukti production-ready/);
  assert.match(markdown, /Category Scores/);
  assert.match(markdown, /Production Go\/No-Go Notes/);
  assert.match(markdown, /docs\/runbooks\/security-hardening.md/);
});

test('checkApiHealth skips when staging API URL is not set', async () => {
  const result = await checkApiHealth('');

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
});

test('checkApiHealth passes on successful /health response', async () => {
  const result = await checkApiHealth('https://staging.example.test/api', {
    fetchImpl: async (url) => {
      assert.equal(url, 'https://staging.example.test/health');
      return { ok: true, status: 200 };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.url, 'https://staging.example.test/health');
});

test('checkApiHealth fails on non-2xx /health response', async () => {
  const result = await checkApiHealth('https://staging.example.test', {
    fetchImpl: async () => ({ ok: false, status: 503 })
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /HTTP 503/);
});

test('checkApiHealth fails when API is unreachable', async () => {
  const result = await checkApiHealth('https://staging.example.test', {
    fetchImpl: async () => {
      throw new Error('connection refused');
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /unreachable/);
  assert.match(result.message, /connection refused/);
});
