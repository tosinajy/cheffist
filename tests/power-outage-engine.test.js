const { test } = require("node:test");
const assert = require("node:assert/strict");

const { evaluatePowerOutageRisk } = require("../lib/powerOutageEngine");

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
    byAppliesTo: {
      default: {
        rule_id: "default_power_outage",
        applies_to: "default",
        temp_threshold_f: 40,
        max_safe_minutes: 120
      },
      "category:dairy": {
        rule_id: "category_dairy_outage",
        applies_to: "category:dairy",
        temp_threshold_f: 40,
        max_safe_minutes: 60
      },
      "food:milk_whole": {
        rule_id: "food_milk_whole_outage",
        applies_to: "food:milk_whole",
        temp_threshold_f: 40,
        max_safe_minutes: 45
      }
    }
  };
}

test("power outage engine is deterministic for identical inputs", () => {
  const food = { food_id: "milk_whole", category: "dairy", high_risk_food: true };
  const rules = fixtureRules();
  const input = {
    food,
    fridgeTempF: null,
    freezerTempF: null,
    outageMinutes: 70,
    fridgeOpened: true,
    freezerOpened: false,
    freezerFullness: "half",
    highRiskConsumer: false,
    rules
  };

  const first = evaluatePowerOutageRisk(input);
  const second = evaluatePowerOutageRisk(input);
  assert.deepEqual(first, second);
});

test("increasing outage time never improves status", () => {
  const food = { food_id: "milk_whole", category: "dairy", high_risk_food: true };
  const rules = fixtureRules();
  const durations = [15, 30, 45, 60, 90, 120];

  let previous = null;
  durations.forEach((minutes) => {
    const result = evaluatePowerOutageRisk({
      food,
      fridgeTempF: 41,
      freezerTempF: 35,
      outageMinutes: minutes,
      fridgeOpened: false,
      freezerOpened: false,
      freezerFullness: "full",
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

test("opening doors never improves status", () => {
  const food = { food_id: "milk_whole", category: "dairy", high_risk_food: true };
  const rules = fixtureRules();

  const closedDoors = evaluatePowerOutageRisk({
    food,
    fridgeTempF: null,
    freezerTempF: null,
    outageMinutes: 70,
    fridgeOpened: false,
    freezerOpened: false,
    freezerFullness: "half",
    highRiskConsumer: false,
    rules
  });

  const openedDoors = evaluatePowerOutageRisk({
    food,
    fridgeTempF: null,
    freezerTempF: null,
    outageMinutes: 70,
    fridgeOpened: true,
    freezerOpened: true,
    freezerFullness: "half",
    highRiskConsumer: false,
    rules
  });

  assert.ok(
    statusRank(openedDoors.status) <= statusRank(closedDoors.status),
    `status improved from ${closedDoors.status} to ${openedDoors.status} when doors opened`
  );
});

test("high-risk consumer toggle never improves status", () => {
  const food = { food_id: "milk_whole", category: "dairy", high_risk_food: true };
  const rules = fixtureRules();

  const baseline = evaluatePowerOutageRisk({
    food,
    fridgeTempF: 41,
    freezerTempF: 35,
    outageMinutes: 40,
    fridgeOpened: false,
    freezerOpened: false,
    freezerFullness: "full",
    highRiskConsumer: false,
    rules
  });

  const highRisk = evaluatePowerOutageRisk({
    food,
    fridgeTempF: 41,
    freezerTempF: 35,
    outageMinutes: 40,
    fridgeOpened: false,
    freezerOpened: false,
    freezerFullness: "full",
    highRiskConsumer: true,
    rules
  });

  assert.ok(
    statusRank(highRisk.status) <= statusRank(baseline.status),
    `status improved from ${baseline.status} to ${highRisk.status} with high-risk toggle`
  );
});

test("output includes conservative disclaimers and action text", () => {
  const result = evaluatePowerOutageRisk({
    food: { food_id: "apple_whole", category: "produce", high_risk_food: false },
    outageMinutes: 20,
    fridgeOpened: false,
    freezerOpened: false,
    freezerFullness: "full",
    highRiskConsumer: false,
    rules: fixtureRules()
  });

  assert.ok(result.assumptions.some((line) => line.includes("not medical advice")));
  assert.ok(result.assumptions.some((line) => line.includes("When in doubt, throw it out.")));
  assert.equal(typeof result.recommendedAction, "string");
  assert.notEqual(result.recommendedAction.length, 0);
});

test("power outage output links freezer recovery tool when freezer warming risk exists", () => {
  const result = evaluatePowerOutageRisk({
    food: { food_id: "milk_whole", category: "dairy", high_risk_food: true },
    outageMinutes: 120,
    fridgeOpened: false,
    freezerOpened: true,
    freezerFullness: "empty",
    highRiskConsumer: false,
    rules: fixtureRules()
  });

  assert.ok(Array.isArray(result.relatedTools));
  assert.ok(
    result.relatedTools.some((tool) => tool.href === "/can-i-refreeze-this/"),
    "expected freezer recovery tool link"
  );
  assert.ok(result.relatedTools.length >= 3);
});

test("power outage SAFE output links freezer recovery as next scenario", () => {
  const result = evaluatePowerOutageRisk({
    food: { food_id: "apple_whole", category: "produce", high_risk_food: false },
    fridgeTempF: 37,
    freezerTempF: 10,
    outageMinutes: 20,
    fridgeOpened: false,
    freezerOpened: false,
    freezerFullness: "full",
    highRiskConsumer: false,
    rules: fixtureRules()
  });

  assert.equal(result.status, "SAFE");
  assert.ok(
    result.relatedTools.some((tool) => tool.href === "/can-i-refreeze-this/"),
    "SAFE status should link freezer recovery"
  );
  assert.ok(result.relatedTools.length >= 3);
});
