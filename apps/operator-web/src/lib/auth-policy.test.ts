import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { canAccessFeature, hasAnyRole, hasFullDataAccess, maskSensitiveData } from "./auth-policy.ts"

describe("operator auth policy", () => {
  it("uses one feature access matrix for direct role and legacy roles", () => {
    assert.equal(canAccessFeature({ role: "OPERATOR" }, "dashboard"), true)
    assert.equal(canAccessFeature({ roles: ["ANALISA"] }, "observability"), true)
    assert.equal(canAccessFeature({ role: "PETUGAS_LAPANGAN" }, "emergencies"), true)
    assert.equal(canAccessFeature({ role: "PETUGAS_LAPANGAN" }, "dashboard"), false)
    assert.equal(canAccessFeature({ role: "OPERATOR" }, "reports"), false)
    assert.equal(canAccessFeature({ role: "VIEWER" }, "heatmap"), false)
  })

  it("checks role aliases and data masking from the same policy", () => {
    assert.equal(hasAnyRole({ role: "OPERATOR" }, ["ANALISA", "OPERATOR"]), true)
    assert.equal(hasAnyRole({ roles: ["ANALISA"] }, "ANALISA"), true)
    assert.equal(hasFullDataAccess({ role: "ANALISA" }), true)
    assert.equal(hasFullDataAccess({ role: "OPERATOR" }), false)

    const masked = maskSensitiveData({ phone: "081234567890", name: "Sopir" }, ["phone"], { role: "OPERATOR" })
    assert.deepEqual(masked, { phone: "08****90", name: "Sopir" })

    const unmasked = maskSensitiveData({ phone: "081234567890" }, ["phone"], { roles: ["ANALISA"] })
    assert.deepEqual(unmasked, { phone: "081234567890" })
  })
})
