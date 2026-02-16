const { test } = require("node:test");
const assert = require("node:assert/strict");

const { evaluateCalculator } = require("../src/assets/calculator-engine");

function sampleData() {
  const foods = {
    byId: {
      chicken_raw: {
        food_id: "chicken_raw",
        category: "protein",
        high_risk_food: true,
        states: [
          {
            food_id: "chicken_raw",
            state: "raw",
            label: "Raw chicken",
            override_high_risk_food: true
          }
        ]
      }
    }
  };

  const stateRule = {
    rule_id: "state_rule",
    applies_to: "state:chicken_raw:raw",
    scope: { type: "state" },
    max_safe_minutes: 60,
    covered_modifier_minutes: 15,
    high_risk_modifier_minutes: -30,
    temp_min_f: 40,
    temp_max_f: 90
  };

  const foodRule = {
    rule_id: "food_rule",
    applies_to: "food:chicken_raw",
    scope: { type: "food" },
    max_safe_minutes: 90,
    covered_modifier_minutes: 20,
    high_risk_modifier_minutes: -20,
    temp_min_f: 40,
    temp_max_f: 90
  };

  const categoryRule = {
    rule_id: "category_rule",
    applies_to: "category:protein",
    scope: { type: "category" },
    max_safe_minutes: 120,
    covered_modifier_minutes: 30,
    high_risk_modifier_minutes: -15,
    temp_min_f: 40,
    temp_max_f: 90
  };

  const rules = {
    items: [stateRule, foodRule, categoryRule],
    byAppliesTo: {
      [stateRule.applies_to]: stateRule,
      [foodRule.applies_to]: foodRule,
      [categoryRule.applies_to]: categoryRule
    }
  };

  return { foods, rules };
}

test("evaluateCalculator uses state-specific rule when available", () => {
  const { foods, rules } = sampleData();
  const result = evaluateCalculator(
    {
      food_id: "chicken_raw",
      state: "raw",
      temp_value: 75,
      temp_unit: "F",
      hours: 0,
      minutes: 30
    },
    foods,
    rules
  );

  assert.equal(result.matched_rule.rule_id, "state_rule");
});

test("evaluateCalculator returns DISCARD when elapsed exceeds conservative limit", () => {
  const { foods, rules } = sampleData();
  const result = evaluateCalculator(
    {
      food_id: "chicken_raw",
      state: "raw",
      temp_value: 75,
      temp_unit: "F",
      hours: 2,
      minutes: 0
    },
    foods,
    rules
  );

  assert.equal(result.status, "DISCARD");
});
