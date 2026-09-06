import {
  runCollectiveAnomalyDetection as defaultRunCollectiveAnomalyDetection
} from "./collective-anomaly-detection.js";
import {
  applyOwnerRiskPropagation as defaultApplyOwnerRiskPropagation
} from "./owner-risk-propagation.js";

export const createRulesEngineCollectiveRuntime = ({
  query,
  logEvent,
  runCollectiveAnomalyDetection = defaultRunCollectiveAnomalyDetection,
  applyOwnerRiskPropagation = defaultApplyOwnerRiskPropagation
}) => {
  const runOwnerRiskPropagation = async () => {
    return applyOwnerRiskPropagation({ query });
  };

  const runCollectiveDetection = async () => {
    return runCollectiveAnomalyDetection({
      query,
      logEvent,
      applyOwnerRiskPropagation: runOwnerRiskPropagation
    });
  };

  return {
    applyOwnerRiskPropagation: runOwnerRiskPropagation,
    runCollectiveAnomalyDetection: runCollectiveDetection
  };
};
