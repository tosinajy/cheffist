const { evaluateFreezerRecovery } = require("../../lib/freezerRecoveryEngine");
const { getRelevantProducts } = require("../../lib/affiliateEngine");

function toBool(value) {
  return value === true || value === "true" || value === "1" || value === 1 || value === "on";
}

function toOptionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

function toNonNegativeInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.trunc(num));
}

function normalizeRecoveryInput(input) {
  const normalized = {
    food_id: String(input.food_id || "").trim(),
    thaw_state: String(input.thaw_state || "partially_thawed").trim().toLowerCase(),
    internal_temp_f: toOptionalNumber(input.internal_temp_f),
    thaw_hours: toNonNegativeInt(input.thaw_hours || 0),
    thaw_minutes: toNonNegativeInt(input.thaw_minutes || 0),
    refrozen: toBool(input.refrozen),
    high_risk_consumer: toBool(input.high_risk_consumer)
  };

  if (normalized.thaw_minutes > 59) {
    normalized.thaw_hours += Math.floor(normalized.thaw_minutes / 60);
    normalized.thaw_minutes %= 60;
  }

  if (normalized.thaw_state !== "partially_thawed" && normalized.thaw_state !== "fully_thawed") {
    normalized.thaw_state = "partially_thawed";
  }

  return normalized;
}

function defaultResult() {
  return {
    status: "USE_CAUTION",
    recommendedAction: "Select a food and thaw details to get conservative refreeze guidance.",
    reasons: [
      "Choose a food, thaw state, and thaw duration to evaluate conservative refreezing guidance."
    ],
    assumptions: [
      "Conservative output is educational only and not medical advice.",
      "These estimates do not guarantee safety.",
      "When in doubt, throw it out."
    ]
  };
}

function buildFreezerRecoveryContext(data, prefillInput) {
  const prefill = prefillInput || {};
  const normalized = normalizeRecoveryInput(prefill);
  const hasPrefill = Boolean(
    normalized.food_id ||
      String(prefill.internal_temp_f || "").trim() ||
      String(prefill.thaw_hours || "").trim() ||
      String(prefill.thaw_minutes || "").trim() ||
      normalized.refrozen ||
      normalized.high_risk_consumer
  );

  const food = data.foods?.byId?.[normalized.food_id] || null;
  const thawMinutes = normalized.thaw_hours * 60 + normalized.thaw_minutes;

  const initialResult =
    hasPrefill && food
      ? evaluateFreezerRecovery({
          food,
          thawState: normalized.thaw_state,
          internalTempF: normalized.internal_temp_f,
          thawMinutes,
          refrozen: normalized.refrozen,
          highRiskConsumer: normalized.high_risk_consumer,
          rules: data.freezerRecoveryRules
        })
      : defaultResult();
  const affiliateProducts = getRelevantProducts({
    food,
    category: food?.category || "",
    scenarioType: "freezer",
    status: initialResult.status,
    products: data.affiliateProducts
  });

  return {
    initialInput: normalized,
    initialResult,
    affiliateProducts,
    hasPrefill,
    serialized: JSON.stringify({
      foods: data.foods,
      freezerRecoveryRules: data.freezerRecoveryRules
    })
  };
}

module.exports = {
  buildFreezerRecoveryContext,
  normalizeRecoveryInput
};
