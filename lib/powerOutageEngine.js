"use strict";

const STATUS = {
  SAFE: "SAFE",
  USE_CAUTION: "USE_CAUTION",
  DISCARD: "DISCARD"
};

const FREEZER_UNKNOWN_THRESHOLDS_MINUTES = {
  full: 24 * 60,
  half: 12 * 60,
  empty: 4 * 60
};

const FREEZER_FULLNESS_PENALTY_MINUTES = {
  full: 0,
  half: 15,
  empty: 30
};

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

function toBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "on";
}

function normalizeFreezerFullness(value) {
  const normalized = String(value || "half").trim().toLowerCase();
  if (normalized === "full" || normalized === "half" || normalized === "empty") {
    return normalized;
  }
  return "half";
}

function buildRuleIndex(rules) {
  if (!rules) return {};
  if (rules.byAppliesTo) return rules.byAppliesTo;

  const byAppliesTo = {};
  const items = Array.isArray(rules) ? rules : Array.isArray(rules.items) ? rules.items : [];
  items.forEach((rule) => {
    if (rule && rule.applies_to) {
      byAppliesTo[rule.applies_to] = rule;
    }
  });
  return byAppliesTo;
}

function resolvePowerOutageRule(food, rules) {
  const byAppliesTo = buildRuleIndex(rules);
  if (!food) return byAppliesTo.default || null;

  const foodRule = byAppliesTo[`food:${food.food_id}`];
  if (foodRule) return foodRule;

  const categoryRule = byAppliesTo[`category:${food.category}`];
  if (categoryRule) return categoryRule;

  return byAppliesTo.default || null;
}

function estimateFridgeTemp(fridgeTempF, outageMinutes, fridgeOpened, assumptions, debug) {
  const known = toOptionalNumber(fridgeTempF);
  if (known !== null) {
    debug.fridge_temp_source = "input";
    return known;
  }

  const thresholdMinutes = fridgeOpened ? 60 : 120;
  const conservativeMargin = 10;
  const assumedAboveThreshold = outageMinutes >= thresholdMinutes - conservativeMargin;
  const estimated = assumedAboveThreshold ? 41 : 39;

  assumptions.push(
    "Fridge temperature was unknown, so conservative warming assumptions were applied."
  );
  debug.fridge_temp_source = "estimated_unknown";
  debug.fridge_unknown_threshold_minutes = thresholdMinutes;
  debug.fridge_assumed_above_40 = assumedAboveThreshold;

  return estimated;
}

function estimateFreezerTemp(
  freezerTempF,
  outageMinutes,
  freezerOpened,
  freezerFullness,
  assumptions,
  debug
) {
  const known = toOptionalNumber(freezerTempF);
  if (known !== null) {
    debug.freezer_temp_source = "input";
    return known;
  }

  const fullness = normalizeFreezerFullness(freezerFullness);
  const baseThresholdMinutes = FREEZER_UNKNOWN_THRESHOLDS_MINUTES[fullness];
  const adjustedThreshold = freezerOpened
    ? Math.max(30, Math.floor(baseThresholdMinutes * 0.6))
    : baseThresholdMinutes;
  const conservativeMargin = 15;
  const assumedWarmed = outageMinutes >= adjustedThreshold - conservativeMargin;
  const estimated = assumedWarmed ? 33 : 20;

  assumptions.push(
    `Freezer temperature was unknown, so '${fullness}' freezer warming assumptions were applied conservatively.`
  );
  debug.freezer_temp_source = "estimated_unknown";
  debug.freezer_unknown_threshold_minutes = adjustedThreshold;
  debug.freezer_assumed_above_32 = assumedWarmed;

  return estimated;
}

function evaluatePowerOutageRisk(input) {
  const normalized = {
    food: input && input.food ? input.food : null,
    fridgeTempF: toOptionalNumber(input && input.fridgeTempF),
    freezerTempF: toOptionalNumber(input && input.freezerTempF),
    outageMinutes: clampNonNegativeInteger(input && input.outageMinutes),
    fridgeOpened: toBoolean(input && input.fridgeOpened),
    freezerOpened: toBoolean(input && input.freezerOpened),
    freezerFullness: normalizeFreezerFullness(input && input.freezerFullness),
    highRiskConsumer: toBoolean(input && input.highRiskConsumer),
    rules: input && input.rules ? input.rules : {}
  };

  const assumptions = [
    "Conservative output is educational only and not medical advice.",
    "These estimates do not guarantee safety.",
    "When in doubt, throw it out."
  ];

  const reasons = [];
  const debug = {
    input: {
      outageMinutes: normalized.outageMinutes,
      fridgeOpened: normalized.fridgeOpened,
      freezerOpened: normalized.freezerOpened,
      freezerFullness: normalized.freezerFullness,
      highRiskConsumer: normalized.highRiskConsumer
    }
  };

  const matchedRule = resolvePowerOutageRule(normalized.food, normalized.rules);
  if (!matchedRule) {
    return {
      status: STATUS.USE_CAUTION,
      reasons: [
        "No matching outage rule was configured for this food.",
        "Use caution and prefer discarding food if temperature history is unclear."
      ],
      recommendedAction: "Use caution. If you cannot verify safe temperatures, discard.",
      assumptions,
      relatedTools: [],
      debug: {
        ...debug,
        matched_rule: null
      }
    };
  }

  const fridgeEffective = estimateFridgeTemp(
    normalized.fridgeTempF,
    normalized.outageMinutes,
    normalized.fridgeOpened,
    assumptions,
    debug
  );
  const freezerEffective = estimateFreezerTemp(
    normalized.freezerTempF,
    normalized.outageMinutes,
    normalized.freezerOpened,
    normalized.freezerFullness,
    assumptions,
    debug
  );

  const worstTemp = Math.max(fridgeEffective, freezerEffective);
  const thresholdF = Number(matchedRule.temp_threshold_f);
  const overThreshold = worstTemp >= thresholdF;

  let safeLimitMinutes = clampNonNegativeInteger(matchedRule.max_safe_minutes);
  const adjustments = [];

  if (normalized.fridgeOpened) {
    safeLimitMinutes -= 30;
    adjustments.push("Fridge door opened: -30 minutes");
  }
  if (normalized.freezerOpened) {
    safeLimitMinutes -= 45;
    adjustments.push("Freezer door opened: -45 minutes");
  }

  const fullnessPenalty = FREEZER_FULLNESS_PENALTY_MINUTES[normalized.freezerFullness];
  if (fullnessPenalty > 0) {
    safeLimitMinutes -= fullnessPenalty;
    adjustments.push(`Freezer fullness (${normalized.freezerFullness}): -${fullnessPenalty} minutes`);
  }

  if (normalized.highRiskConsumer) {
    safeLimitMinutes -= 30;
    adjustments.push("High-risk consumer: -30 minutes");
  }

  if (normalized.food && normalized.food.high_risk_food) {
    safeLimitMinutes -= 20;
    adjustments.push("High-risk food profile: -20 minutes");
  }

  safeLimitMinutes = Math.max(0, safeLimitMinutes);

  reasons.push(
    `Matched outage rule '${matchedRule.rule_id}' (${matchedRule.applies_to}).`,
    `Worst-case temperature considered: ${worstTemp.toFixed(1)}F.`,
    `Rule threshold: ${thresholdF}F; conservative outage window: ${safeLimitMinutes} minutes.`,
    `Outage duration evaluated: ${normalized.outageMinutes} minutes.`
  );

  adjustments.forEach((line) => reasons.push(line));

  let status = STATUS.SAFE;
  let recommendedAction = "Continue monitoring temperatures and use food promptly.";
  const relatedTools = [];

  if (overThreshold && normalized.outageMinutes >= safeLimitMinutes) {
    status = STATUS.DISCARD;
    reasons.push("Temperature threshold was reached and outage exceeded the conservative window.");
    recommendedAction = "Discard this food. Conservative outage limits were exceeded.";
  } else if (
    overThreshold ||
    normalized.outageMinutes >= safeLimitMinutes ||
    normalized.outageMinutes >= Math.floor(safeLimitMinutes * 0.75)
  ) {
    status = STATUS.USE_CAUTION;
    reasons.push("Conditions are near or past conservative boundaries.");
    recommendedAction =
      "Use caution. Verify temperatures when possible and discard if uncertainty remains.";
  } else {
    reasons.push("Conditions remain within conservative boundaries.");
  }

  if (freezerEffective >= 32 || debug.freezer_assumed_above_32 || normalized.freezerOpened) {
    relatedTools.push({
      href: "/can-i-refreeze-this/",
      label: "Can I refreeze this?"
    });
    reasons.push("Freezer warming risk detected; review freezer recovery guidance.");
  }

  return {
    status,
    reasons,
    recommendedAction,
    assumptions,
    relatedTools,
    debug: {
      ...debug,
      matched_rule: matchedRule.rule_id,
      matched_applies_to: matchedRule.applies_to,
      threshold_f: thresholdF,
      effective_fridge_temp_f: fridgeEffective,
      effective_freezer_temp_f: freezerEffective,
      worst_effective_temp_f: worstTemp,
      safe_limit_minutes: safeLimitMinutes,
      over_threshold: overThreshold
    }
  };
}

module.exports = {
  evaluatePowerOutageRisk,
  resolvePowerOutageRule
};
