export const RULE_RISK_DELTAS = Object.freeze({
  NGETEM: 8,
  OFF_ROUTE: 12,
  WRONG_DIRECTION: 10,
  LOST_SIGNAL: 10,
  OVERSPEED: 6,
  DEVICE_TAMPER: 25
});

export const clampScore = (score) => Math.min(100, Math.max(0, Math.round(score)));

export const riskLevelForScore = (score) => {
  if (score >= 70) return "CRITICAL";
  if (score >= 40) return "HIGH";
  if (score >= 20) return "MEDIUM";
  return "LOW";
};

export const riskDeltaForRule = (rule) => RULE_RISK_DELTAS[rule] || 0;
