const { test } = require("node:test");
const assert = require("node:assert/strict");

const { evaluateCalculator } = require("../src/assets/calculator-engine");

function fixtureData() {
  const foods = {
    byId: {
      apple_whole: {
        food_id: "apple_whole",
        category: "produce",
        high_risk_food: false,
        states: []
      },
      eggs_shell: {
        food_id: "eggs_shell",
        category: "protein",
        high_risk_food: true,
        states: []
      },
      milk_whole: {
        food_id: "milk_whole",
        category: "dairy",
        high_risk_food: true,
        states: [
          {
            food_id: "milk_whole",
            state: "opened",
            label: "Opened milk",
            override_high_risk_food: true
          },
          {
            food_id: "milk_whole",
            state: "unopened",
            label: "Unopened milk",
            override_high_risk_food: null
          }
        ]
      },
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
      },
      chicken_cooked: {
        food_id: "chicken_cooked",
        category: "cooked_foods",
        high_risk_food: true,
        states: [
          {
            food_id: "chicken_cooked",
            state: "cooked",
            label: "Cooked chicken",
            override_high_risk_food: true
          }
        ]
      },
      rice_cooked: {
        food_id: "rice_cooked",
        category: "cooked_foods",
        high_risk_food: true,
        states: [
          {
            food_id: "rice_cooked",
            state: "cooked",
            label: "Cooked rice",
            override_high_risk_food: true
          }
        ]
      }
    }
  };

  const rules = {
    byAppliesTo: {
      "category:produce": {
        rule_id: "category_produce_room_temp",
        applies_to: "category:produce",
        scope: { type: "category" },
        temp_min_f: 40,
        temp_max_f: 90,
        max_safe_minutes: 180,
        covered_modifier_minutes: 20,
        high_risk_modifier_minutes: -30
      },
      "category:protein": {
        rule_id: "category_protein_room_temp",
        applies_to: "category:protein",
        scope: { type: "category" },
        temp_min_f: 40,
        temp_max_f: 90,
        max_safe_minutes: 120,
        covered_modifier_minutes: 30,
        high_risk_modifier_minutes: -15
      },
      "category:cooked_foods": {
        rule_id: "category_cooked_foods_room_temp",
        applies_to: "category:cooked_foods",
        scope: { type: "category" },
        temp_min_f: 40,
        temp_max_f: 90,
        max_safe_minutes: 90,
        covered_modifier_minutes: 20,
        high_risk_modifier_minutes: -20
      },
      "food:milk_whole": {
        rule_id: "food_milk_whole_room_temp",
        applies_to: "food:milk_whole",
        scope: { type: "food" },
        temp_min_f: 40,
        temp_max_f: 90,
        max_safe_minutes: 90,
        covered_modifier_minutes: 10,
        high_risk_modifier_minutes: -20
      },
      "state:chicken_raw:raw": {
        rule_id: "state_chicken_raw_raw_room_temp",
        applies_to: "state:chicken_raw:raw",
        scope: { type: "state" },
        temp_min_f: 40,
        temp_max_f: 90,
        max_safe_minutes: 60,
        covered_modifier_minutes: 15,
        high_risk_modifier_minutes: -30
      },
      "state:rice_cooked:cooked": {
        rule_id: "state_rice_cooked_cooked_room_temp",
        applies_to: "state:rice_cooked:cooked",
        scope: { type: "state" },
        temp_min_f: 40,
        temp_max_f: 90,
        max_safe_minutes: 60,
        covered_modifier_minutes: 15,
        high_risk_modifier_minutes: -25
      }
    }
  };

  rules.items = Object.values(rules.byAppliesTo);
  return { foods, rules };
}

function statusRank(status) {
  const rank = {
    DISCARD: 0,
    "USE CAUTION": 1,
    SAFE: 2,
    NEEDS_INPUT: -1
  };
  return rank[status] ?? -1;
}

test("sitout engine golden cases", () => {
  const { foods, rules } = fixtureData();

  const cases = [
    {
      name: "non-high-risk produce baseline",
      input: { food_id: "apple_whole", temp_value: 70, hours: 0, minutes: 30 },
      expectedStatus: "SAFE",
      expectedLimit: 180,
      reasonIncludes: ["Matched category rule", "Base conservative limit: 180"]
    },
    {
      name: "covered increases safe limit",
      input: {
        food_id: "apple_whole",
        temp_value: 70,
        hours: 0,
        minutes: 30,
        covered: true
      },
      expectedStatus: "SAFE",
      expectedLimit: 200,
      reasonIncludes: ["Covered adjustment: 20"]
    },
    {
      name: "high risk consumer lowers limit",
      input: {
        food_id: "apple_whole",
        temp_value: 70,
        hours: 0,
        minutes: 30,
        high_risk_consumer: true
      },
      expectedStatus: "SAFE",
      expectedLimit: 150,
      reasonIncludes: ["High-risk adjustment: -30"]
    },
    {
      name: "high-risk food in caution zone",
      input: { food_id: "eggs_shell", temp_value: 70, hours: 1, minutes: 30 },
      expectedStatus: "USE CAUTION",
      expectedLimit: 105,
      reasonIncludes: ["Matched category rule", "Elapsed time is close to conservative limit"]
    },
    {
      name: "high-risk food exceeded limit",
      input: { food_id: "eggs_shell", temp_value: 70, hours: 2, minutes: 0 },
      expectedStatus: "DISCARD",
      expectedLimit: 105,
      reasonIncludes: ["Elapsed time exceeds conservative limit"]
    },
    {
      name: "food-specific rule overrides category",
      input: { food_id: "milk_whole", state: "unopened", temp_value: 70, hours: 1, minutes: 0 },
      expectedStatus: "USE CAUTION",
      expectedLimit: 70,
      reasonIncludes: ["Matched food rule 'food_milk_whole_room_temp'"]
    },
    {
      name: "food-specific discard",
      input: { food_id: "milk_whole", state: "opened", temp_value: 70, hours: 1, minutes: 20 },
      expectedStatus: "DISCARD",
      expectedLimit: 70,
      reasonIncludes: ["Elapsed time exceeds conservative limit"]
    },
    {
      name: "state-specific raw chicken safe",
      input: { food_id: "chicken_raw", state: "raw", temp_value: 70, hours: 0, minutes: 20 },
      expectedStatus: "SAFE",
      expectedLimit: 30,
      reasonIncludes: ["Matched state rule 'state_chicken_raw_raw_room_temp'"]
    },
    {
      name: "state-specific raw chicken caution",
      input: { food_id: "chicken_raw", state: "raw", temp_value: 70, hours: 0, minutes: 30 },
      expectedStatus: "USE CAUTION",
      expectedLimit: 30,
      reasonIncludes: ["Elapsed time is close to conservative limit"]
    },
    {
      name: "cooked category fallback rule",
      input: {
        food_id: "chicken_cooked",
        state: "cooked",
        temp_value: 70,
        hours: 1,
        minutes: 0
      },
      expectedStatus: "USE CAUTION",
      expectedLimit: 70,
      reasonIncludes: ["Matched category rule 'category_cooked_foods_room_temp'"]
    },
    {
      name: "state-specific cooked rice discard",
      input: { food_id: "rice_cooked", state: "cooked", temp_value: 70, hours: 0, minutes: 40 },
      expectedStatus: "DISCARD",
      expectedLimit: 35,
      reasonIncludes: ["Matched state rule 'state_rice_cooked_cooked_room_temp'"]
    },
    {
      name: "out-of-range temperature uses caution with no rule",
      input: { food_id: "apple_whole", temp_value: 95, hours: 0, minutes: 30 },
      expectedStatus: "USE CAUTION",
      expectedLimit: null,
      reasonIncludes: ["No configured temperature rule matched 95.0F"]
    }
  ];

  cases.forEach((scenario) => {
    const result = evaluateCalculator(scenario.input, foods, rules);
    assert.equal(result.status, scenario.expectedStatus, scenario.name);
    assert.equal(result.conservative_safe_limit_minutes, scenario.expectedLimit, scenario.name);

    scenario.reasonIncludes.forEach((phrase) => {
      assert.equal(
        result.reasons.some((reason) => reason.includes(phrase)),
        true,
        `${scenario.name}: missing reason phrase '${phrase}'`
      );
    });

    assert.equal(
      result.assumptions.some((line) => line.includes("not medical advice")),
      true,
      `${scenario.name}: missing disclaimer assumption`
    );
    assert.equal(
      result.assumptions.some((line) => line.includes("When in doubt, throw it out.")),
      true,
      `${scenario.name}: missing throw-it-out assumption`
    );
  });
});

test("conservatism invariant: increasing time never improves status", () => {
  const { foods, rules } = fixtureData();
  const times = [0, 30, 90, 120, 180];

  let previous = null;
  times.forEach((minutes) => {
    const result = evaluateCalculator(
      {
        food_id: "eggs_shell",
        temp_value: 70,
        hours: Math.floor(minutes / 60),
        minutes: minutes % 60
      },
      foods,
      rules
    );

    if (previous) {
      assert.ok(
        statusRank(result.status) <= statusRank(previous.status),
        `status improved from ${previous.status} to ${result.status} at ${minutes} minutes`
      );
    }
    previous = result;
  });
});

test("conservatism invariant: increasing temperature never improves status", () => {
  const { foods, rules } = fixtureData();
  const temps = [70, 85, 95];

  let previous = null;
  temps.forEach((temp) => {
    const result = evaluateCalculator(
      {
        food_id: "chicken_raw",
        state: "raw",
        temp_value: temp,
        temp_unit: "F",
        hours: 0,
        minutes: 30
      },
      foods,
      rules
    );

    if (previous) {
      assert.ok(
        statusRank(result.status) <= statusRank(previous.status),
        `status improved from ${previous.status} to ${result.status} at ${temp}F`
      );
    }
    previous = result;
  });
});
