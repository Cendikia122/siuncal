import {
  createRuleSingleEvaluator as defaultCreateRuleSingleEvaluator
} from "./rule-single-evaluation.js";
import {
  createRuleBatchEvaluator as defaultCreateRuleBatchEvaluator
} from "./rule-batch-evaluation.js";

export const createRulesEngineEvaluators = ({
  query,
  applyRuleDecision,
  config,
  createRuleSingleEvaluator = defaultCreateRuleSingleEvaluator,
  createRuleBatchEvaluator = defaultCreateRuleBatchEvaluator
}) => {
  const dependencies = {
    query,
    applyRuleDecision,
    config: config.ruleEvaluation
  };

  return {
    ...createRuleSingleEvaluator(dependencies),
    ...createRuleBatchEvaluator(dependencies)
  };
};
