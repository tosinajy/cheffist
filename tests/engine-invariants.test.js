const { test } = require("node:test");
const assert = require("node:assert/strict");

const { evaluateCalculator } = require("../src/assets/calculator-engine");

function statusRank(status) {
  const rank = {
    DISCARD: 0,
    "USE CAUTION": 1,
    SAFE: 2,
    NEEDS_INPUT: -1
  };
  return rank[status] ?? -1;
}

test("cross-tool sanity: high-risk food has stricter threshold than non-high-risk in same category", () => {
  const foods = {
    byId: {
      chicken_low_risk: {
        food_id: "chicken_low_risk",
        category: "protein",
        high_risk_food: false,
        states: []
      },
      chicken_high_risk: {
        food_id: "chicken_high_risk",
        category: "protein",
        high_risk_food: true,
        states: []
      }
    }
  };

  const rules = {
    items: [
      {
        rule_id: "category_protein",
        applies_to: "category:protein",
        scope: { type: "category" },
        temp_min_f: 40,
        temp_max_f: 90,
        max_safe_minutes: 120,
        covered_modifier_minutes: 0,
        high_risk_modifier_minutes: -30
      }
    ],
    byAppliesTo: {}
  };
  rules.byAppliesTo["category:protein"] = rules.items[0];

  const baseInput = {
    temp_value: 70,
    temp_unit: "F",
    hours: 1,
    minutes: 0,
    covered: false,
    high_risk_consumer: false
  };

  const lowRiskResult = evaluateCalculator(
    { ...baseInput, food_id: "chicken_low_risk" },
    foods,
    rules
  );
  const highRiskResult = evaluateCalculator(
    { ...baseInput, food_id: "chicken_high_risk" },
    foods,
    rules
  );

  assert.ok(
    highRiskResult.conservative_safe_limit_minutes <
      lowRiskResult.conservative_safe_limit_minutes,
    "high-risk food should have a stricter safe limit"
  );
  assert.ok(
    statusRank(highRiskResult.status) <= statusRank(lowRiskResult.status),
    `high-risk status improved from ${lowRiskResult.status} to ${highRiskResult.status}`
  );
});
