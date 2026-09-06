import {
  evaluateLostSignalDecision,
  evaluateNgetemDecision,
  evaluateOffRouteDecision,
  evaluateOverspeedDecision,
  evaluateWrongDirectionDecision
} from "./rule-decisions.js";
import {
  fetchNgetemAggregateRows,
  fetchNgetemOfficialStop,
  fetchOffRouteRows,
  fetchOverspeedRows,
  fetchWrongDirectionRows
} from "./rule-single-queries.js";

export const createRuleSingleEvaluator = ({
  query,
  applyRuleDecision,
  config
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

  const evaluateLostSignal = async (vehicle, nowMs) => {
    const decision = evaluateLostSignalDecision({
      vehicle,
      nowMs,
      config: lostSignalConfig
    });
    return applyRuleDecision({ vehicle, decision });
  };

  const evaluateOverspeed = async (vehicle) => {
    const rows = await fetchOverspeedRows({
      query,
      vehicleId: vehicle.vehicle_id,
      overspeedWindowPoints: config.overspeedWindowPoints,
      lostSignalMinutes: config.lostSignalMinutes
    });

    const decision = evaluateOverspeedDecision({
      vehicle,
      rows,
      config: overspeedConfig
    });
    return applyRuleDecision({ vehicle, decision });
  };

  const evaluateOffRoute = async (vehicle) => {
    if (vehicle.status !== "IN_SERVICE") {
      const decision = evaluateOffRouteDecision({
        vehicle,
        rows: [],
        config: offRouteConfig
      });
      return applyRuleDecision({ vehicle, decision });
    }

    const rows = await fetchOffRouteRows({
      query,
      vehicle,
      offRouteGraceMinutes: config.offRouteGraceMinutes,
      baseRadiusMeters: config.baseRadiusMeters,
      mapMatchingMinConfidence: config.mapMatchingMinConfidence
    });

    const decision = evaluateOffRouteDecision({
      vehicle,
      rows,
      config: offRouteConfig
    });
    return applyRuleDecision({ vehicle, decision });
  };

  const evaluateWrongDirection = async (vehicle) => {
    if (vehicle.status !== "IN_SERVICE") {
      const decision = evaluateWrongDirectionDecision({
        vehicle,
        rows: [],
        config: wrongDirectionConfig
      });
      return applyRuleDecision({ vehicle, decision });
    }

    const rows = await fetchWrongDirectionRows({
      query,
      vehicleId: vehicle.vehicle_id,
      wrongDirectionGraceMinutes: config.wrongDirectionGraceMinutes,
      mapMatchingMinConfidence: config.mapMatchingMinConfidence,
      wrongDirectionMinSpeedKmh: config.wrongDirectionMinSpeedKmh
    });

    const decision = evaluateWrongDirectionDecision({
      vehicle,
      rows,
      config: wrongDirectionConfig
    });
    return applyRuleDecision({ vehicle, decision });
  };

  const evaluateNgetem = async (vehicle, nowMs) => {
    const precheckDecision = evaluateNgetemDecision({
      vehicle,
      nowMs,
      rows: null,
      config: ngetemConfig
    });
    if (precheckDecision) {
      return applyRuleDecision({ vehicle, decision: precheckDecision });
    }

    const inOfficialStop = await fetchNgetemOfficialStop({
      query,
      vehicle,
      officialStopRadiusMeters: config.officialStopRadiusMeters
    });

    const officialStopDecision = evaluateNgetemDecision({
      vehicle,
      nowMs,
      rows: null,
      inOfficialStop,
      config: ngetemConfig
    });
    if (officialStopDecision) {
      return applyRuleDecision({ vehicle, decision: officialStopDecision });
    }

    const rows = await fetchNgetemAggregateRows({
      query,
      vehicle,
      ngetemMinutes: config.ngetemMinutes
    });

    const decision = evaluateNgetemDecision({
      vehicle,
      nowMs,
      rows,
      config: ngetemConfig
    });
    return applyRuleDecision({ vehicle, decision });
  };

  return {
    evaluateLostSignal,
    evaluateOverspeed,
    evaluateOffRoute,
    evaluateWrongDirection,
    evaluateNgetem
  };
};
