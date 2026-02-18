"use strict";

const STATUS = {
  SAFE: "SAFE",
  USE_CAUTION: "USE_CAUTION",
  DISCARD: "DISCARD"
};

const SCOPE_PRIORITY = {
  state: 0,
  food: 1,
  category: 2
};

function toFiniteNumber(value) {
  const numberValue = typeof value === "string" ? Number(value.trim()) : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeTemp({ value, unit }) {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) {
    throw new Error("Temperature value must be a finite number");
  }

  const normalizedUnit = (unit || "F").toString().trim().toUpperCase();
  if (normalizedUnit !== "F" && normalizedUnit !== "C") {
    throw new Error("Temperature unit must be F or C");
  }

  const tempF = normalizedUnit === "C" ? (numericValue * 9) / 5 + 32 : numericValue;
  return { tempF: Number(tempF.toFixed(2)) };
}

function normalizeDuration({ hours = 0, minutes = 0 }) {
  const numericHours = toFiniteNumber(hours);
  const numericMinutes = toFiniteNumber(minutes);

  if (numericHours === null || numericMinutes === null) {
    throw new Error("Duration hours and minutes must be finite numbers");
  }
  if (numericHours < 0 || numericMinutes < 0) {
    throw new Error("Duration cannot be negative");
  }

  const totalMinutes = Math.floor(numericHours * 60 + numericMinutes);
  return { totalMinutes };
}

function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

function parseAppliesTo(appliesToValue) {
  const appliesTo = normalizeText(appliesToValue);

  let match = appliesTo.match(/^state:([a-z0-9_]+):([a-z]+)$/);
  if (match) {
    return {
      scope: "state",
      food_id: match[1],
      state: match[2],
      priority: SCOPE_PRIORITY.state,
      key: appliesTo
    };
  }

  match = appliesTo.match(/^food:([a-z0-9_]+)$/);
  if (match) {
    return {
      scope: "food",
      food_id: match[1],
      priority: SCOPE_PRIORITY.food,
      key: appliesTo
    };
  }

  match = appliesTo.match(/^category:([a-z0-9-]+)$/);
  if (match) {
    return {
      scope: "category",
      category: match[1],
      priority: SCOPE_PRIORITY.category,
      key: appliesTo
    };
  }

  return null;
}

function doesRuleApplyToFood({ food, state, rule }) {
  const parsed = parseAppliesTo(rule && rule.applies_to);
  if (!parsed) {
    return false;
  }

  const foodId = normalizeText(food && food.food_id);
  const category = normalizeText(food && food.category);
  const normalizedState = normalizeText(state || (food && food.state));

  if (parsed.scope === "state") {
    return parsed.food_id === foodId && parsed.state === normalizedState;
  }
  if (parsed.scope === "food") {
    return parsed.food_id === foodId;
  }
  if (parsed.scope === "category") {
    return parsed.category === category;
  }

  return false;
}

function sortRulesDeterministically(rules) {
  return [...rules].sort((a, b) => {
    const aPriority = a._priority ?? SCOPE_PRIORITY.category;
    const bPriority = b._priority ?? SCOPE_PRIORITY.category;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    const aSafe = Number(a.max_safe_minutes);
    const bSafe = Number(b.max_safe_minutes);
    if (aSafe !== bSafe) {
      return aSafe - bSafe;
    }

    return String(a.rule_id).localeCompare(String(b.rule_id));
  });
}

function getApplicableRules({ food, state, rules }) {
  const inputRules = Array.isArray(rules) ? rules : [];
  const matches = [];

  for (const rule of inputRules) {
    if (!doesRuleApplyToFood({ food, state, rule })) {
      continue;
    }
    const parsed = parseAppliesTo(rule.applies_to);
    matches.push({
      ...rule,
      _priority: parsed.priority,
      _scope: parsed.scope
    });
  }

  return sortRulesDeterministically(matches);
}

function intOrZero(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function evaluateSitoutRisk({
  food,
  state,
  tempF,
  minutes,
  covered,
  highRiskConsumer,
  rules
}) {
  const assumptions = [
    "Educational guidance only, not medical advice.",
    "Guidance is conservative and not a guarantee of safety.",
    "When in doubt, discard."
  ];
  const reasons = [];

  const normalizedTemp = toFiniteNumber(tempF);
  const normalizedMinutes = toFiniteNumber(minutes);

  if (normalizedTemp === null || normalizedMinutes === null || normalizedMinutes < 0) {
    return {
      status: STATUS.USE_CAUTION,
      safeLimitMinutes: 0,
      reasons: ["Input data is invalid for temperature or duration."],
      assumptions,
      recommendedAction: "When in doubt, discard.",
      debug: {
        matchedRuleIds: [],
        input: { tempF, minutes, state: state || null }
      }
    };
  }

  const applicableRules = getApplicableRules({ food, state, rules });
  const tempMatchedRules = applicableRules.filter(
    (rule) => normalizedTemp >= Number(rule.temp_min_f) && normalizedTemp <= Number(rule.temp_max_f)
  );

  if (tempMatchedRules.length === 0) {
    reasons.push("No matching sit-out rule for this food and temperature range.");
    reasons.push("Risk estimate defaults to conservative caution due to missing matching rule data.");

    return {
      status: STATUS.USE_CAUTION,
      safeLimitMinutes: 0,
      reasons,
      assumptions,
      recommendedAction: "When in doubt, discard.",
      debug: {
        matchedRuleIds: [],
        applicableRuleIds: applicableRules.map((rule) => rule.rule_id),
        input: {
          tempF: normalizedTemp,
          minutes: Math.floor(normalizedMinutes),
          covered: Boolean(covered),
          highRiskConsumer: Boolean(highRiskConsumer),
          state: state || null
        }
      }
    };
  }

  const bestPriority = tempMatchedRules.reduce(
    (lowest, rule) => Math.min(lowest, rule._priority),
    Number.POSITIVE_INFINITY
  );

  const priorityMatchedRules = sortRulesDeterministically(
    tempMatchedRules.filter((rule) => rule._priority === bestPriority)
  );
  const selectedRule = priorityMatchedRules[0];

  const baseCap = Math.floor(Number(selectedRule.max_safe_minutes));
  let safeLimitMinutes = baseCap;

  reasons.push(
    `Matched ${tempMatchedRules.length} temperature rule(s); prioritizing ${selectedRule._scope}-specific rule "${selectedRule.rule_id}".`
  );

  if (Boolean(highRiskConsumer)) {
    const highRiskModifier = Math.min(0, intOrZero(selectedRule.high_risk_modifier_minutes));
    safeLimitMinutes += highRiskModifier;
    reasons.push("High-risk consumer mode reduces the conservative sit-out limit.");
  }

  if (Boolean(covered)) {
    const coveredModifier = Math.min(0, intOrZero(selectedRule.covered_modifier_minutes));
    safeLimitMinutes += coveredModifier;
    reasons.push(
      coveredModifier < 0
        ? "Covered state applied with conservative adjustment."
        : "Covered state kept neutral to avoid raising conservative limits."
    );
  }

  safeLimitMinutes = Math.max(0, Math.floor(safeLimitMinutes));
  safeLimitMinutes = Math.min(baseCap, safeLimitMinutes);

  const cautionBuffer = Math.max(5, Math.floor(safeLimitMinutes * 0.1));
  const cautionThreshold = Math.max(0, safeLimitMinutes - cautionBuffer);
  const elapsed = Math.floor(normalizedMinutes);

  let status = STATUS.SAFE;
  let recommendedAction =
    "Consume promptly and refrigerate immediately if not eating now.";

  if (elapsed > safeLimitMinutes) {
    status = STATUS.DISCARD;
    recommendedAction = "Discard the food.";
    reasons.push("Elapsed sit-out time exceeds the conservative limit.");
  } else if (elapsed >= cautionThreshold) {
    status = STATUS.USE_CAUTION;
    recommendedAction =
      "Use caution and refrigerate immediately; when in doubt, discard.";
    reasons.push("Elapsed time is near the conservative limit.");
  } else {
    reasons.push("Elapsed time remains below the conservative caution threshold.");
  }

  return {
    status,
    safeLimitMinutes,
    reasons,
    assumptions,
    recommendedAction,
    debug: {
      matchedRuleIds: tempMatchedRules.map((rule) => rule.rule_id),
      prioritizedRuleIds: priorityMatchedRules.map((rule) => rule.rule_id),
      selectedRuleId: selectedRule.rule_id,
      selectedScope: selectedRule._scope,
      baseCapMinutes: baseCap,
      cautionThresholdMinutes: cautionThreshold,
      input: {
        tempF: normalizedTemp,
        minutes: elapsed,
        covered: Boolean(covered),
        highRiskConsumer: Boolean(highRiskConsumer),
        state: state || null
      }
    }
  };
}

module.exports = {
  STATUS,
  evaluateSitoutRisk,
  getApplicableRules,
  normalizeDuration,
  normalizeTemp,
  parseAppliesTo
};
