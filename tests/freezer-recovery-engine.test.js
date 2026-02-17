const { test } = require("node:test");
const assert = require("node:assert/strict");

const { evaluateFreezerRecovery } = require("../lib/freezerRecoveryEngine");

function statusRank(status) {
  const rank = {
    DISCARD: 0,
    USE_CAUTION: 1,
    SAFE: 2
  };
  return rank[status] ?? -1;
}

function fixtureRules() {
  return {
    byScopeAndState: {
      "default::any": {
        rule_id: "default_freezer_recovery_any",
        applies_to: "default",
        thaw_state: "any",
        temp_threshold_f: 40,
        max_safe_minutes: 120
      },
      "default::fully_thawed": {
        rule_id: "default_freezer_recovery_fully",
        applies_to: "default",
        thaw_state: "fully_thawed",
        temp_threshold_f: 40,
        max_safe_minutes: 60
      },
      "category:protein::fully_thawed": {
        rule_id: "category_protein_recovery_fully",
        applies_to: "category:protein",
        thaw_state: "fully_thawed",
        temp_threshold_f: 40,
        max_safe_minutes: 45
      },
      "food:milk_whole::fully_thawed": {
        rule_id: "food_milk_whole_recovery_fully",
        applies_to: "food:milk_whole",
        thaw_state: "fully_thawed",
        temp_threshold_f: 40,
        max_safe_minutes: 30
      }
    }
  };
}

test("thaw longer time never improves status", () => {
  const rules = fixtureRules();
  const food = { food_id: "milk_whole", category: "dairy", high_risk_food: true };
  const durations = [10, 20, 30, 45, 60, 90];

  let previous = null;
  durations.forEach((minutes) => {
    const result = evaluateFreezerRecovery({
      food,
      thawState: "fully_thawed",
      internalTempF: 41,
      thawMinutes: minutes,
      refrozen: false,
      highRiskConsumer: false,
      rules
    });

    if (previous) {
      assert.ok(
        statusRank(result.status) <= statusRank(previous.status),
        `status improved from ${previous.status} to ${result.status} at ${minutes} minutes`
      );
    }
    previous = result;
  });
});

test("freezer recovery engine is deterministic for identical inputs", () => {
  const rules = fixtureRules();
  const input = {
    food: { food_id: "milk_whole", category: "dairy", high_risk_food: true },
    thawState: "fully_thawed",
    internalTempF: 39,
    thawMinutes: 25,
    refrozen: false,
    highRiskConsumer: true,
    rules
  };

  const first = evaluateFreezerRecovery(input);
  const second = evaluateFreezerRecovery(input);
  assert.deepEqual(first, second);
});

test("fully thawed unsafe always returns DISCARD", () => {
  const rules = fixtureRules();
  const food = { food_id: "milk_whole", category: "dairy", high_risk_food: true };

  const result = evaluateFreezerRecovery({
    food,
    thawState: "fully_thawed",
    internalTempF: 45,
    thawMinutes: 120,
    refrozen: false,
    highRiskConsumer: false,
    rules
  });

  assert.equal(result.status, "DISCARD");
  assert.ok(
    result.reasons.some((line) => line.includes("Fully thawed food exceeded conservative")),
    "expected fully-thawed discard reason"
  );
});

test("refrozen after unsafe thaw returns DISCARD", () => {
  const rules = fixtureRules();

  const result = evaluateFreezerRecovery({
    food: { food_id: "milk_whole", category: "dairy", high_risk_food: true },
    thawState: "fully_thawed",
    internalTempF: 44,
    thawMinutes: 120,
    refrozen: true,
    highRiskConsumer: false,
    rules
  });

  assert.equal(result.status, "DISCARD");
});

test("assumptions always include conservative disclaimers", () => {
  const result = evaluateFreezerRecovery({
    food: { food_id: "apple_whole", category: "produce", high_risk_food: false },
    thawState: "partially_thawed",
    internalTempF: 30,
    thawMinutes: 20,
    refrozen: false,
    highRiskConsumer: false,
    rules: fixtureRules()
  });

  assert.ok(result.assumptions.some((line) => line.includes("not medical advice")));
  assert.ok(result.assumptions.some((line) => line.includes("When in doubt, throw it out.")));
});
