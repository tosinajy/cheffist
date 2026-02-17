"use strict";

const STATUS = {
  SAFE: "SAFE",
  USE_CAUTION: "USE_CAUTION",
  DISCARD: "DISCARD"
};

function toBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "on";
}

function clampNonNegativeInteger(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.trunc(num));
}

function toOptionalNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

function normalizeThawState(value) {
  const thawState = String(value || "").trim().toLowerCase();
  if (thawState === "partially_thawed" || thawState === "fully_thawed") {
    return thawState;
  }
  return "fully_thawed";
}

function buildRuleIndex(rules) {
  if (!rules) return {};
  if (rules.byScopeAndState) return rules.byScopeAndState;

  const index = {};
  const items = Array.isArray(rules) ? rules : Array.isArray(rules.items) ? rules.items : [];
  items.forEach((rule) => {
    if (!rule || !rule.applies_to || !rule.thaw_state) return;
    index[`${rule.applies_to}::${rule.thaw_state}`] = rule;
  });
  return index;
}

function resolveFreezerRecoveryRule(food, thawState, rules) {
  const byScopeAndState = buildRuleIndex(rules);
  const scopeCandidates = [];

  if (food && food.food_id) scopeCandidates.push(`food:${food.food_id}`);
  if (food && food.category) scopeCandidates.push(`category:${food.category}`);
  scopeCandidates.push("default");

  const stateCandidates = [thawState, "any"];

  for (const scope of scopeCandidates) {
    for (const state of stateCandidates) {
      const rule = byScopeAndState[`${scope}::${state}`];
      if (rule) return rule;
    }
  }

  return null;
}

function estimateInternalTempF(internalTempF, thawState, thawMinutes, thresholdF, assumptions) {
  const known = toOptionalNumber(internalTempF);
  if (known !== null) return known;

  if (thawState === "fully_thawed") {
    const assumed = thawMinutes >= 30 ? thresholdF + 1 : thresholdF - 2;
    assumptions.push(
      "Internal temperature was unknown. Fully thawed food was treated conservatively as warming quickly."
    );
    return assumed;
  }

  const assumed = thawMinutes >= 120 ? thresholdF + 1 : 32;
  assumptions.push(
    "Internal temperature was unknown. Partially thawed food was treated conservatively with possible warming."
  );
  return assumed;
}

function evaluateFreezerRecovery(input) {
  const normalized = {
    food: input && input.food ? input.food : null,
    thawState: normalizeThawState(input && input.thawState),
    internalTempF: toOptionalNumber(input && input.internalTempF),
    thawMinutes: clampNonNegativeInteger(input && input.thawMinutes),
    refrozen: toBoolean(input && input.refrozen),
    highRiskConsumer: toBoolean(input && input.highRiskConsumer),
    rules: input && input.rules ? input.rules : {}
  };

  const assumptions = [
    "Conservative output is educational only and not medical advice.",
    "These estimates do not guarantee safety.",
    "When in doubt, throw it out."
  ];
  const reasons = [];

  const matchedRule = resolveFreezerRecoveryRule(
    normalized.food,
    normalized.thawState,
    normalized.rules
  );
  if (!matchedRule) {
    return {
      status: STATUS.USE_CAUTION,
      recommendedAction: "Use caution. If temperature history is uncertain, discard.",
      reasons: [
        "No matching freezer recovery rule was configured.",
        "Conservative guidance defaults to caution when data is missing."
      ],
      assumptions
    };
  }

  let safeLimitMinutes = clampNonNegativeInteger(matchedRule.max_safe_minutes);
  const thresholdF = Number(matchedRule.temp_threshold_f);

  if (normalized.highRiskConsumer) {
    safeLimitMinutes = Math.max(0, safeLimitMinutes - 30);
    reasons.push("High-risk consumer adjustment: -30 minutes.");
  }
  if (normalized.food && normalized.food.high_risk_food) {
    safeLimitMinutes = Math.max(0, safeLimitMinutes - 20);
    reasons.push("High-risk food adjustment: -20 minutes.");
  }

  const effectiveInternalTempF = estimateInternalTempF(
    normalized.internalTempF,
    normalized.thawState,
    normalized.thawMinutes,
    thresholdF,
    assumptions
  );
  const overThreshold = effectiveInternalTempF >= thresholdF;
  const unsafeThaw = overThreshold && normalized.thawMinutes >= safeLimitMinutes;

  reasons.unshift(
    `Matched freezer recovery rule '${matchedRule.rule_id}' (${matchedRule.applies_to}, ${matchedRule.thaw_state}).`,
    `Internal temperature considered: ${effectiveInternalTempF.toFixed(1)}F (threshold ${thresholdF}F).`,
    `Conservative thaw window: ${safeLimitMinutes} minutes; elapsed thaw time: ${normalized.thawMinutes} minutes.`
  );

  let status = STATUS.SAFE;
  let recommendedAction =
    "Refreeze promptly only if still safely cold, or cook/use now and monitor for spoilage.";

  if (normalized.thawState === "fully_thawed" && unsafeThaw) {
    status = STATUS.DISCARD;
    recommendedAction = "Discard this food. Fully thawed unsafe exposure exceeded conservative limits.";
    reasons.push("Fully thawed food exceeded conservative time/temperature boundaries.");
  } else if (normalized.refrozen && unsafeThaw) {
    status = STATUS.DISCARD;
    recommendedAction = "Discard this food. It was refrozen after an unsafe thaw window.";
    reasons.push("Refrozen after unsafe thaw exposure.");
  } else if (unsafeThaw) {
    status = STATUS.DISCARD;
    recommendedAction = "Discard this food. Conservative thaw boundaries were exceeded.";
    reasons.push("Thaw exposure exceeded conservative time/temperature boundaries.");
  } else if (normalized.refrozen) {
    status = STATUS.USE_CAUTION;
    recommendedAction =
      "Use caution. Refreezing after thaw can reduce quality; discard if any spoilage signs exist.";
    reasons.push("Food was refrozen after thawing; conservative handling is advised.");
  } else if (
    overThreshold ||
    normalized.thawMinutes >= safeLimitMinutes ||
    normalized.thawMinutes >= Math.floor(safeLimitMinutes * 0.75)
  ) {
    status = STATUS.USE_CAUTION;
    recommendedAction =
      "Use caution. Cook promptly if appropriate and discard if odor, texture, or appearance is questionable.";
    reasons.push("Conditions are near conservative boundaries.");
  } else if (
    normalized.thawState === "partially_thawed" &&
    effectiveInternalTempF <= 32 &&
    normalized.thawMinutes < Math.floor(safeLimitMinutes * 0.5)
  ) {
    reasons.push("Food appears partially thawed with ice-crystal-range temperature.");
  } else {
    reasons.push("Conditions remain within conservative boundaries.");
  }

  return {
    status,
    recommendedAction,
    reasons,
    assumptions
  };
}

module.exports = {
  evaluateFreezerRecovery,
  resolveFreezerRecoveryRule
};
