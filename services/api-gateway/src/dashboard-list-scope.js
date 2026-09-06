const parseBoundedInt = (value, defaultValue, { min = 1, max = 200 } = {}) => {
  const parsed = Number(value ?? defaultValue);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(Math.floor(parsed), min), max);
};

const withPagination = (queryParams, params) => {
  const hasPagination = queryParams.page !== undefined || queryParams.limit !== undefined;
  const page = parseBoundedInt(queryParams.page, 1, { max: 100000 });
  const limit = parseBoundedInt(queryParams.limit, 50, { max: 200 });
  const offset = (page - 1) * limit;
  let paginationClause = "";

  if (hasPagination) {
    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    paginationClause = `LIMIT ${limitParam} OFFSET $${params.length}`;
  }

  return { hasPagination, page, limit, paginationClause };
};

const whereFrom = (filters) => filters.length ? `WHERE ${filters.join(" AND ")}` : "";

export const createOwnerListScope = (queryParams = {}, { canViewSensitiveOwnerData = false } = {}) => {
  const filters = [];
  const params = [];

  const search = String(queryParams.search || "").trim().toLowerCase();
  if (search) {
    const searchTerm = `%${search}%`;
    params.push(searchTerm);
    const searchParam = `$${params.length}`;
    const searchableFields = [
      `LOWER(o.name) LIKE ${searchParam}`,
      `LOWER(o.owner_type) LIKE ${searchParam}`,
      `LOWER(o.status) LIKE ${searchParam}`
    ];
    if (canViewSensitiveOwnerData) searchableFields.push(`LOWER(COALESCE(o.phone_primary, '')) LIKE ${searchParam}`);
    filters.push(`(${searchableFields.join(" OR ")})`);
  }
  if (queryParams.owner_type) {
    params.push(String(queryParams.owner_type).toUpperCase());
    filters.push(`o.owner_type = $${params.length}`);
  }
  if (queryParams.status) {
    params.push(String(queryParams.status).toUpperCase());
    filters.push(`o.status = $${params.length}`);
  }

  return {
    params,
    whereClause: whereFrom(filters),
    ...withPagination(queryParams, params)
  };
};

export const createVehicleListScope = (queryParams = {}) => {
  const filters = [];
  const params = [];

  const search = String(queryParams.search || "").trim().toLowerCase();
  if (search) {
    const searchTerm = `%${search}%`;
    params.push(searchTerm);
    filters.push(`(
      LOWER(v.vehicle_id::text) LIKE $${params.length}
      OR LOWER(v.plate_no) LIKE $${params.length}
      OR LOWER(COALESCE(v.vehicle_code, '')) LIKE $${params.length}
      OR LOWER(v.route_id) LIKE $${params.length}
      OR LOWER(v.status) LIKE $${params.length}
      OR LOWER(COALESCE(o.name, '')) LIKE $${params.length}
    )`);
  }
  if (queryParams.route_id) {
    params.push(String(queryParams.route_id));
    filters.push(`v.route_id = $${params.length}`);
  }
  if (queryParams.status) {
    params.push(String(queryParams.status).toUpperCase());
    filters.push(`v.status = $${params.length}`);
  }
  if (queryParams.owner_id) {
    params.push(String(queryParams.owner_id));
    filters.push(`v.owner_id = $${params.length}`);
  }

  return {
    params,
    whereClause: whereFrom(filters),
    ...withPagination(queryParams, params)
  };
};

export const stripTotalCount = (rows = []) => {
  const total = rows[0]?.total_count || 0;
  const items = rows.map(({ total_count: _totalCount, ...row }) => row);
  return { total, items };
};
