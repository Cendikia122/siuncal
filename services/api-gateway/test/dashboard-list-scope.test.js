import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createOwnerListScope,
  createVehicleListScope,
  stripTotalCount
} from "../src/dashboard-list-scope.js";

describe("dashboard list scope", () => {
  it("builds bounded vehicle filters and pagination metadata", () => {
    const scope = createVehicleListScope({
      search: "F 1901",
      route_id: "01",
      owner_id: "owner-01",
      status: "in_service",
      page: "2",
      limit: "15"
    });

    assert.deepEqual(scope.params, [
      "%f 1901%",
      "01",
      "IN_SERVICE",
      "owner-01",
      15,
      15
    ]);
    assert.equal(scope.hasPagination, true);
    assert.equal(scope.page, 2);
    assert.equal(scope.limit, 15);
    assert.equal(scope.paginationClause, "LIMIT $5 OFFSET $6");
    assert.match(scope.whereClause, /LOWER\(v\.plate_no\) LIKE \$1/);
    assert.match(scope.whereClause, /v\.route_id = \$2/);
    assert.match(scope.whereClause, /v\.status = \$3/);
    assert.match(scope.whereClause, /v\.owner_id = \$4/);
  });

  it("only searches sensitive owner fields for ANALISA scope", () => {
    const operatorScope = createOwnerListScope({ search: "0812" }, { canViewSensitiveOwnerData: false });
    const analisaScope = createOwnerListScope({ search: "0812" }, { canViewSensitiveOwnerData: true });

    assert.doesNotMatch(operatorScope.whereClause, /phone_primary/);
    assert.match(analisaScope.whereClause, /phone_primary/);
    assert.deepEqual(stripTotalCount([{ total_count: 2, owner_id: "owner-01" }]), {
      total: 2,
      items: [{ owner_id: "owner-01" }]
    });
  });
});
