(function init(rootFactory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = rootFactory();
    return;
  }

  if (typeof window !== "undefined") {
    window.CheffistSitoutEngine = rootFactory();
  }
})(function factory() {
  function toNumber(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return num;
  }

  function clampNonNegative(value) {
    return Math.max(0, value);
  }

  function toBoolean(value) {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "on" || value === "1" || value === 1) return true;
    return false;
  }

  function normalizeInput(input) {
    const normalized = {
      food_id: String(input.food_id || "").trim(),
      state: String(input.state || "").trim().toLowerCase(),
      temp_value: toNumber(input.temp_value, 70),
      temp_unit: String(input.temp_unit || "F").trim().toUpperCase() === "C" ? "C" : "F",
      hours: clampNonNegative(Math.trunc(toNumber(input.hours, 0))),
      minutes: clampNonNegative(Math.trunc(toNumber(input.minutes, 0))),
      covered: toBoolean(input.covered),
      high_risk_consumer: toBoolean(input.high_risk_consumer)
    };

    if (normalized.minutes > 59) {
      normalized.hours += Math.floor(normalized.minutes / 60);
      normalized.minutes %= 60;
    }

    return normalized;
  }

  function formatDuration(minutes) {
    const mins = clampNonNegative(Math.round(minutes));
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return {
      minutes: mins,
      label: `${hours}h ${rem}m`
    };
  }

  function toFahrenheit(value, unit) {
    if (unit === "C") return (value * 9) / 5 + 32;
    return value;
  }

  function resolveMatchingRule(rules, food, selectedState, tempF) {
    if (!food || !rules || !Array.isArray(rules.items)) return null;

    const inTempBand = (rule) => {
      const min = rule.temp_min_f;
      const max = rule.temp_max_f;
      if (min !== null && min !== undefined && tempF < min) return false;
      if (max !== null && max !== undefined && tempF > max) return false;
      return true;
    };

    const byAppliesTo = rules.byAppliesTo || {};

    if (selectedState) {
      const stateRule = byAppliesTo[`state:${food.food_id}:${selectedState}`];
      if (stateRule && inTempBand(stateRule)) return stateRule;
    }

    const foodRule = byAppliesTo[`food:${food.food_id}`];
    if (foodRule && inTempBand(foodRule)) return foodRule;

    const categoryRule = byAppliesTo[`category:${food.category}`];
    if (categoryRule && inTempBand(categoryRule)) return categoryRule;

    return null;
  }

  function evaluateCalculator(input, foods, rules) {
    const normalized = normalizeInput(input || {});
    const food = foods && foods.byId ? foods.byId[normalized.food_id] : null;

    if (!food) {
      return {
        status: "NEEDS_INPUT",
        conservative_safe_limit_minutes: null,
        conservative_safe_limit_label: "N/A",
        reasons: ["Choose a food to calculate a conservative sit-out estimate."],
        recommended_action: "Select a food, then enter temperature and time.",
        assumptions: [
          "Conservative estimates are based on configured category/food/state rules.",
          "Visible spoilage or off odors override any estimate.",
          "When in doubt, throw it out."
        ],
        input: normalized
      };
    }

    const selectedState = normalized.state || "";
    const stateEntry = (food.states || []).find((entry) => entry.state === selectedState) || null;
    const tempF = toFahrenheit(normalized.temp_value, normalized.temp_unit);
    const elapsedMinutes = normalized.hours * 60 + normalized.minutes;
    const matchedRule = resolveMatchingRule(rules, food, selectedState, tempF);

    if (!matchedRule) {
      return {
        status: "USE CAUTION",
        conservative_safe_limit_minutes: null,
        conservative_safe_limit_label: "No matching rule",
        reasons: [
          `No configured temperature rule matched ${tempF.toFixed(1)}F for this food.`,
          "Use extra caution and follow official food safety guidance."
        ],
        recommended_action: "Use caution. If uncertain about safety, discard.",
        assumptions: [
          "Rule priority is state-specific, then food-specific, then category-specific.",
          "Conservative estimates are educational and not medical advice.",
          "When in doubt, throw it out."
        ],
        matched_rule: null,
        input: normalized
      };
    }

    const reasons = [
      `Matched ${matchedRule.scope.type} rule '${matchedRule.rule_id}' (${matchedRule.applies_to}).`,
      `Temperature interpreted as ${tempF.toFixed(1)}F.`,
      `Elapsed time: ${elapsedMinutes} minutes.`
    ];

    let safeLimit = matchedRule.max_safe_minutes || 0;
    reasons.push(`Base conservative limit: ${safeLimit} minutes.`);

    if (normalized.covered && matchedRule.covered_modifier_minutes !== null) {
      safeLimit += matchedRule.covered_modifier_minutes;
      reasons.push(
        `Covered adjustment: ${matchedRule.covered_modifier_minutes} minutes.`
      );
    }

    const effectiveHighRisk =
      stateEntry && stateEntry.override_high_risk_food !== null
        ? stateEntry.override_high_risk_food
        : food.high_risk_food;

    if (
      (normalized.high_risk_consumer || effectiveHighRisk) &&
      matchedRule.high_risk_modifier_minutes !== null
    ) {
      safeLimit += matchedRule.high_risk_modifier_minutes;
      reasons.push(
        `High-risk adjustment: ${matchedRule.high_risk_modifier_minutes} minutes.`
      );
    }

    safeLimit = clampNonNegative(safeLimit);
    const safeDuration = formatDuration(safeLimit);

    let status = "SAFE";
    let recommendedAction = "Use promptly and keep monitoring for spoilage signs.";

    if (elapsedMinutes > safeLimit) {
      status = "DISCARD";
      recommendedAction =
        "Discard this food now. Conservative limit has been exceeded.";
      reasons.push("Elapsed time exceeds conservative limit.");
    } else if (elapsedMinutes > safeLimit * 0.75) {
      status = "USE CAUTION";
      recommendedAction =
        "Use caution: consume soon only if no spoilage signs are present.";
      reasons.push("Elapsed time is close to conservative limit.");
    } else {
      reasons.push("Elapsed time is within conservative limit.");
    }

    return {
      status,
      conservative_safe_limit_minutes: safeLimit,
      conservative_safe_limit_label: safeDuration.label,
      reasons,
      recommended_action: recommendedAction,
      assumptions: [
        "Rule priority is state-specific, then food-specific, then category-specific.",
        "Conservative estimates are educational and not medical advice.",
        "When in doubt, throw it out."
      ],
      matched_rule: matchedRule,
      input: normalized
    };
  }

  return {
    evaluateCalculator,
    normalizeInput
  };
});
