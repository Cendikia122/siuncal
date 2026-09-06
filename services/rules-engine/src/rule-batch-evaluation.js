import {
  evaluateLostSignalDecision,
  evaluateNgetemDecision,
  evaluateOffRouteDecision,
  evaluateOverspeedDecision,
  evaluateWrongDirectionDecision
} from "./rule-decisions.js";
import {
  fetchNgetemAggregateByVehicle,
  fetchNgetemOfficialStopByVehicle,
  fetchOffRouteRowsByVehicle,
  fetchOverspeedRowsByVehicle,
  fetchWrongDirectionRowsByVehicle
} from "./rule-batch-queries.js";
import {
  runWithConcurrency as defaultRunWithConcurrency
} from "./rules-runtime.js";

export const createRuleBatchEvaluator = ({
  query,
  applyRuleDecision,
  config,
  runWithConcurrency = defaultRunWithConcurrency
}) => {
  const lostSignalConfig = {
    lostSignalMinutes: config.lostSignalMinutes,
    lostSignalCriticalMinutes: config.lostSignalCriticalMinutes
  };

  const overspeedConfig = {
    overspeedThreshold: config.overspeedThreshold,
    overspeedMinPoints: config.overspeedMinPoints,
    overspeedWindowPoints: config.overspeedWindowPoints
  };

  const offRouteConfig = {
    offRouteMeters: config.offRouteMeters,
    offRouteGraceMinutes: config.offRouteGraceMinutes,
    offRouteMinPoints: config.offRouteMinPoints,
    baseRadiusMeters: config.baseRadiusMeters
  };

  const wrongDirectionConfig = {
    wrongDirectionGraceMinutes: config.wrongDirectionGraceMinutes,
    wrongDirectionMinPoints: config.wrongDirectionMinPoints,
    wrongDirectionHeadingDiffDegrees: config.wrongDirectionHeadingDiffDegrees,
    wrongDirectionMinSpeedKmh: config.wrongDirectionMinSpeedKmh,
    mapMatchingMinConfidence: config.mapMatchingMinConfidence
  };

  const ngetemConfig = {
    lostSignalMinutes: config.lostSignalMinutes,
    ngetemMinutes: config.ngetemMinutes,
    ngetemMaxDistanceMeters: config.ngetemMaxDistanceMeters,
    ngetemMaxAvgSpeed: config.ngetemMaxAvgSpeed,
    officialStopRadiusMeters: config.officialStopRadiusMeters
  };

  const applyDecisions = (decisions) => runWithConcurrency(
    decisions,
    config.ruleEvaluationConcurrency,
    ({ vehicle, decision }) => applyRuleDecision({ vehicle, decision })
  );

  const evaluateLostSignalBatch = async (vehicles, nowMs) => {
    const decisions = vehicles.map((vehicle) => ({
      vehicle,
      decision: evaluateLostSignalDecision({
        vehicle,
        nowMs,
        config: lostSignalConfig
      })
    }));
    await applyDecisions(decisions);
  };

  const evaluateOverspeedBatch = async (vehicles) => {
    if (vehicles.length === 0) return;
    const vehicleIds = vehicles.map((vehicle) => vehicle.vehicle_id);
    const rowsByVehicle = await fetchOverspeedRowsByVehicle({
      query,
      vehicleIds,
      overspeedWindowPoints: config.overspeedWindowPoints,
      lostSignalMinutes: config.lostSignalMinutes
    });
    const decisions = vehicles.map((vehicle) => ({
      vehicle,
      decision: evaluateOverspeedDecision({
        vehicle,
        rows: rowsByVehicle.get(String(vehicle.vehicle_id)) || [],
        config: overspeedConfig
      })
    }));
    await applyDecisions(decisions);
  };

  const evaluateOffRouteBatch = async (vehicles) => {
    if (vehicles.length === 0) return;
    const inServiceVehicles = vehicles.filter((vehicle) => vehicle.status === "IN_SERVICE");
    const decisions = vehicles
      .filter((vehicle) => vehicle.status !== "IN_SERVICE")
      .map((vehicle) => ({
        vehicle,
        decision: evaluateOffRouteDecision({
          vehicle,
          rows: [],
          config: offRouteConfig
        })
      }));

    if (inServiceVehicles.length > 0) {
      const vehicleIds = inServiceVehicles.map((vehicle) => vehicle.vehicle_id);
      const rowsByVehicle = await fetchOffRouteRowsByVehicle({
        query,
        vehicleIds,
        offRouteGraceMinutes: config.offRouteGraceMinutes,
        baseRadiusMeters: config.baseRadiusMeters,
        mapMatchingMinConfidence: config.mapMatchingMinConfidence
      });
      for (const vehicle of inServiceVehicles) {
        decisions.push({
          vehicle,
          decision: evaluateOffRouteDecision({
            vehicle,
            rows: rowsByVehicle.get(String(vehicle.vehicle_id)) || [],
            config: offRouteConfig
          })
        });
      }
    }

    await applyDecisions(decisions);
  };

  const evaluateWrongDirectionBatch = async (vehicles) => {
    if (vehicles.length === 0) return;
    const inServiceVehicles = vehicles.filter((vehicle) => vehicle.status === "IN_SERVICE");
    const decisions = vehicles
      .filter((vehicle) => vehicle.status !== "IN_SERVICE")
      .map((vehicle) => ({
        vehicle,
        decision: evaluateWrongDirectionDecision({
          vehicle,
          rows: [],
          config: wrongDirectionConfig
        })
      }));

    if (inServiceVehicles.length > 0) {
      const vehicleIds = inServiceVehicles.map((vehicle) => vehicle.vehicle_id);
      const rowsByVehicle = await fetchWrongDirectionRowsByVehicle({
        query,
        vehicleIds,
        wrongDirectionGraceMinutes: config.wrongDirectionGraceMinutes,
        mapMatchingMinConfidence: config.mapMatchingMinConfidence,
        wrongDirectionMinSpeedKmh: config.wrongDirectionMinSpeedKmh
      });
      for (const vehicle of inServiceVehicles) {
        decisions.push({
          vehicle,
          decision: evaluateWrongDirectionDecision({
            vehicle,
            rows: rowsByVehicle.get(String(vehicle.vehicle_id)) || [],
            config: wrongDirectionConfig
          })
        });
      }
    }

    await applyDecisions(decisions);
  };

  const evaluateNgetemBatch = async (vehicles, nowMs) => {
    if (vehicles.length === 0) return;
    const decisions = [];
    const remaining = [];

    for (const vehicle of vehicles) {
      const precheckDecision = evaluateNgetemDecision({
        vehicle,
        nowMs,
        rows: null,
        config: ngetemConfig
      });
      if (precheckDecision) decisions.push({ vehicle, decision: precheckDecision });
      else remaining.push(vehicle);
    }

    if (remaining.length > 0) {
      const vehicleIds = remaining.map((vehicle) => vehicle.vehicle_id);
      const officialStopByVehicle = await fetchNgetemOfficialStopByVehicle({
        query,
        vehicleIds,
        officialStopRadiusMeters: config.officialStopRadiusMeters
      });
      const aggregateByVehicle = await fetchNgetemAggregateByVehicle({
        query,
        vehicleIds,
        ngetemMinutes: config.ngetemMinutes
      });

      for (const vehicle of remaining) {
        const officialStopDecision = evaluateNgetemDecision({
          vehicle,
          nowMs,
          rows: null,
          inOfficialStop: officialStopByVehicle.get(String(vehicle.vehicle_id)) === true,
          config: ngetemConfig
        });
        if (officialStopDecision) {
          decisions.push({ vehicle, decision: officialStopDecision });
          continue;
        }

        decisions.push({
          vehicle,
          decision: evaluateNgetemDecision({
            vehicle,
            nowMs,
            rows: [aggregateByVehicle.get(String(vehicle.vehicle_id)) || { points: 0 }],
            config: ngetemConfig
          })
        });
      }
    }

    await applyDecisions(decisions);
  };

  return {
    evaluateLostSignalBatch,
    evaluateOverspeedBatch,
    evaluateOffRouteBatch,
    evaluateWrongDirectionBatch,
    evaluateNgetemBatch
  };
};
