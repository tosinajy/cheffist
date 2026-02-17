const { evaluatePowerOutageRisk } = require("../../lib/powerOutageEngine");
const { getRelevantProducts } = require("../../lib/affiliateEngine");
const { buildAdContext } = require("./ad-context");

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

function toBool(value) {
  return value === true || value === "true" || value === "1" || value === 1 || value === "on";
}

function normalizeInput(input) {
  const normalized = {
    food_id: String(input.food_id || "").trim(),
    fridge_temp_f: toOptionalNumber(input.fridge_temp_f),
    freezer_temp_f: toOptionalNumber(input.freezer_temp_f),
    outage_hours: toNonNegativeInt(input.outage_hours || 0),
    outage_minutes: toNonNegativeInt(input.outage_minutes || 0),
    fridge_opened: toBool(input.fridge_opened),
    freezer_opened: toBool(input.freezer_opened),
    freezer_fullness: String(input.freezer_fullness || "half").trim().toLowerCase(),
    high_risk_consumer: toBool(input.high_risk_consumer)
  };

  if (normalized.outage_minutes > 59) {
    normalized.outage_hours += Math.floor(normalized.outage_minutes / 60);
    normalized.outage_minutes %= 60;
  }

  if (!["full", "half", "empty"].includes(normalized.freezer_fullness)) {
    normalized.freezer_fullness = "half";
  }

  return normalized;
}

function defaultResult() {
  return {
    status: "USE_CAUTION",
    reasons: [
      "Choose a food and outage details to evaluate conservative outage risk."
    ],
    recommendedAction: "Use caution when outage temperatures are uncertain.",
    assumptions: [
      "Conservative output is educational only and not medical advice.",
      "These estimates do not guarantee safety.",
      "When in doubt, throw it out."
    ],
    relatedTools: []
  };
}

function buildPowerOutageContext(data, prefillInput) {
  const normalized = normalizeInput(prefillInput || {});
  const hasPrefill = Boolean(
    normalized.food_id ||
      String(prefillInput?.fridge_temp_f || "").trim() ||
      String(prefillInput?.freezer_temp_f || "").trim() ||
      String(prefillInput?.outage_hours || "").trim() ||
      String(prefillInput?.outage_minutes || "").trim() ||
      normalized.fridge_opened ||
      normalized.freezer_opened ||
      normalized.high_risk_consumer
  );

  const food = data.foods?.byId?.[normalized.food_id] || null;
  const outageMinutes = normalized.outage_hours * 60 + normalized.outage_minutes;
  const initialResult =
    hasPrefill && food
      ? evaluatePowerOutageRisk({
          food,
          fridgeTempF: normalized.fridge_temp_f,
          freezerTempF: normalized.freezer_temp_f,
          outageMinutes,
          fridgeOpened: normalized.fridge_opened,
          freezerOpened: normalized.freezer_opened,
          freezerFullness: normalized.freezer_fullness,
          highRiskConsumer: normalized.high_risk_consumer,
          rules: data.powerOutageRules
        })
      : defaultResult();

  const affiliateProducts = getRelevantProducts({
    food,
    category: food?.category || "",
    scenarioType: "outage",
    status: initialResult.status,
    products: data.affiliateProducts
  });
  const adContext = buildAdContext({
    adConfig: data.adConfig,
    status: initialResult.status,
    isHighRiskScenario: Boolean(normalized.high_risk_consumer || food?.high_risk_food)
  });

  return {
    initialInput: normalized,
    initialResult,
    hasPrefill,
    affiliateProducts,
    adContext
  };
}

module.exports = {
  buildPowerOutageContext
};
