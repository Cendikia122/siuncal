import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const report = readFileSync(new URL("../docs/security-audit-report.md", import.meta.url), "utf8");

test("security audit report documents the production security decision surface", () => {
  assert.match(report, /^# Security Audit Report/m);
  assert.match(report, /^## Executive Summary/m);
  assert.match(report, /^## Scope/m);
  assert.match(report, /^## Findings/m);
  assert.match(report, /^## Security Checklist/m);
  assert.match(report, /^### Authentication/m);
  assert.match(report, /^### Authorization/m);
  assert.match(report, /^### Data Protection/m);
  assert.match(report, /^### Infrastructure/m);
  assert.match(report, /^## Secret Management Decision/m);
  assert.match(report, /^## Verification/m);
});

test("security audit report uses production severity labels", () => {
  for (const severity of ["P0", "P1", "P2", "P3"]) {
    assert.match(report, new RegExp(`\\b${severity}\\b`));
  }
});
