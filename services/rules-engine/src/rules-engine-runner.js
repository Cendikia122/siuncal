import { chunkArray } from "./rules-runtime.js";

export const createRulesEngineRunner = ({
  query,
  evaluateLostSignalBatch,
  evaluateOverspeedBatch,
  evaluateOffRouteBatch,
  evaluateWrongDirectionBatch,
  evaluateNgetemBatch,
  applyRiskDecay,
  config,
  nowMs = () => Date.now()
}) => {
  const fetchVehicles = async () => {
    const { rows } = await query(
      `SELECT
          v.vehicle_id,
          v.plate_no,
          v.route_id,
          v.status,
          o.base_lat,
          o.base_lon,
          vl.ts,
          vl.lat,
          vl.lon,
          vl.speed_kmh
       FROM vehicles v
       LEFT JOIN owners o ON o.owner_id = v.owner_id
       LEFT JOIN vehicle_latest vl ON vl.vehicle_id = v.vehicle_id
       ORDER BY v.plate_no`
    );
    return rows;
  };

  const runRules = async () => {
    const vehicles = await fetchVehicles();
    const evaluationTimeMs = nowMs();
    const batches = chunkArray(vehicles, config.runtime.ruleBatchSize);

    for (const batch of batches) {
      await evaluateLostSignalBatch(batch, evaluationTimeMs);
      await evaluateOverspeedBatch(batch);
      await evaluateOffRouteBatch(batch);
      await evaluateWrongDirectionBatch(batch);
      await evaluateNgetemBatch(batch, evaluationTimeMs);
    }

    await applyRiskDecay();
  };

  return {
    fetchVehicles,
    runRules
  };
};
