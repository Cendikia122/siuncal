import {
  openRuleLifecycle as defaultOpenRuleLifecycle,
  resolveRuleLifecycle as defaultResolveRuleLifecycle
} from "./anomaly-lifecycle.js";
import { applyRiskScoreDecay as defaultApplyRiskScoreDecay } from "./risk-decay.js";
import { RULE_RISK_DELTAS } from "./risk-scoring.js";

export const createRulesEngineLifecycle = ({
  pool,
  config,
  logEvent,
  riskDeltas = RULE_RISK_DELTAS,
  openRuleLifecycle = defaultOpenRuleLifecycle,
  resolveRuleLifecycle = defaultResolveRuleLifecycle,
  applyRiskScoreDecay = defaultApplyRiskScoreDecay
}) => {
  const openRule = ({ vehicle, rule, severity, evidence, lat, lon }) => openRuleLifecycle({
    pool,
    vehicle,
    rule,
    severity,
    evidence,
    lat,
    lon,
    config: {
      repeatEscalationCount: config.risk.repeatEscalationCount,
      riskDeltas
    },
    logEvent
  });

  const applyRiskDecay = async () => {
    return applyRiskScoreDecay({
      pool,
      dailyDecayPercent: config.risk.dailyDecayPercent,
      weeklyDecayPoints: config.risk.weeklyDecayPoints,
      logEvent
    });
  };

  const resolveRule = ({ vehicle, rule, reason }) => resolveRuleLifecycle({
    pool,
    vehicle,
    rule,
    reason,
    logEvent
  });

  const applyRuleDecision = async ({ vehicle, decision }) => {
    if (decision.action === "resolve") {
      return resolveRule({ vehicle, rule: decision.rule, reason: decision.reason });
    }
    if (decision.action === "open") {
      return openRule({
        vehicle,
        rule: decision.rule,
        severity: decision.severity,
        evidence: decision.evidence,
        lat: decision.lat,
        lon: decision.lon
      });
    }
    return null;
  };

  return {
    openRule,
    resolveRule,
    applyRuleDecision,
    applyRiskDecay
  };
};
