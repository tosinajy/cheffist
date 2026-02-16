const { evaluateCalculator, normalizeInput } = require("../assets/calculator-engine");

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

  return {
    initialInput: initialResult.input,
    initialResult,
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
