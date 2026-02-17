const { evaluateCalculator, normalizeInput } = require("../assets/calculator-engine");
const { getRelevantProducts } = require("../../lib/affiliateEngine");

function buildCalculatorContext(data, prefillInput) {
  const prefill = prefillInput || {};
  const normalized = normalizeInput(prefill);
  const hasPrefill = Boolean(
    normalized.food_id ||
      String(prefill.state || "").trim() ||
      String(prefill.temp_value || "").trim() ||
      String(prefill.hours || "").trim() ||
      String(prefill.minutes || "").trim()
  );

  const initialResult = hasPrefill
    ? evaluateCalculator(normalized, data.foods, data.rules)
    : evaluateCalculator({}, data.foods, data.rules);
  const selectedFood = data.foods?.byId?.[initialResult.input.food_id] || null;
  const affiliateProducts = getRelevantProducts({
    food: selectedFood,
    category: selectedFood?.category || "",
    scenarioType: "sitout",
    status: initialResult.status,
    products: data.affiliateProducts
  });

  return {
    initialInput: initialResult.input,
    initialResult,
    affiliateProducts,
    hasPrefill,
    serialized: JSON.stringify({
      foods: data.foods,
      rules: data.rules
    })
  };
}

module.exports = {
  buildCalculatorContext
};
