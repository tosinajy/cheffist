const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  getAllowedStates,
  parseAppliesTo,
  parseBoolean,
  resolveRuleForFood,
  splitList,
  validateFoodsRows,
  validateRulesRows
} = require("../scripts/build-data");

test("splitList converts pipe-delimited values into arrays", () => {
  assert.deepEqual(splitList("a| b |c"), ["a", "b", "c"]);
});

test("parseBoolean accepts true/false", () => {
  assert.equal(parseBoolean("true", 2), true);
  assert.equal(parseBoolean("false", 2), false);
});

test("validateFoodsRows enforces min <= max with row+field message", () => {
  assert.throws(
    () =>
      validateFoodsRows([
        {
          food_id: "bad_food",
          name: "Bad Food",
          slug: "bad-food",
          category: "test",
          synonyms: "bad|food",
          pantry_min_days: "5",
          pantry_max_days: "2",
          fridge_min_days: "1",
          fridge_max_days: "1",
          freezer_min_days: "1",
          freezer_max_days: "1",
          spoilage_signs: "smell",
          storage_tips: "tip",
          notes: "",
          high_risk_food: "false",
          default_affiliate_tags: "tag"
        }
      ]),
    /foods\.csv row 2: pantry_min_days must be <= pantry_max_days/
  );
});

test("validateFoodsRows builds deterministic byId/bySlug maps", () => {
  const out = validateFoodsRows([
    {
      food_id: "z_food",
      name: "Z Food",
      slug: "z-food",
      category: "test",
      synonyms: "z",
      pantry_min_days: "1",
      pantry_max_days: "1",
      fridge_min_days: "1",
      fridge_max_days: "1",
      freezer_min_days: "1",
      freezer_max_days: "1",
      spoilage_signs: "sign",
      storage_tips: "tip",
      notes: "",
      high_risk_food: "false",
      default_affiliate_tags: "tag"
    },
    {
      food_id: "a_food",
      name: "A Food",
      slug: "a-food",
      category: "test",
      synonyms: "a",
      pantry_min_days: "1",
      pantry_max_days: "1",
      fridge_min_days: "1",
      fridge_max_days: "1",
      freezer_min_days: "1",
      freezer_max_days: "1",
      spoilage_signs: "sign",
      storage_tips: "tip",
      notes: "",
      high_risk_food: "true",
      default_affiliate_tags: "tag"
    }
  ]);

  assert.deepEqual(out.items.map((item) => item.food_id), ["a_food", "z_food"]);
  assert.equal(out.byId.a_food.slug, "a-food");
  assert.equal(out.bySlug["z-food"].food_id, "z_food");
});

test("parseAppliesTo accepts state/category/food formats", () => {
  const foodsById = { chicken_raw: { food_id: "chicken_raw", category: "protein" } };
  const categories = new Set(["protein"]);
  const allowedStates = getAllowedStates();

  const stateScope = parseAppliesTo(
    "state:chicken_raw:raw",
    2,
    foodsById,
    categories,
    allowedStates
  );
  const foodScope = parseAppliesTo(
    "food:chicken_raw",
    2,
    foodsById,
    categories,
    allowedStates
  );
  const categoryScope = parseAppliesTo(
    "category:protein",
    2,
    foodsById,
    categories,
    allowedStates
  );

  assert.equal(stateScope.type, "state");
  assert.equal(foodScope.type, "food");
  assert.equal(categoryScope.type, "category");
});

test("resolveRuleForFood prefers state over food over category", () => {
  const foodsById = {
    chicken_raw: { food_id: "chicken_raw", category: "protein" }
  };
  const categories = new Set(["protein"]);
  const allowedStates = getAllowedStates();
  const rules = validateRulesRows(
    [
      {
        rule_id: "category_rule",
        applies_to: "category:protein",
        temp_min_f: "40",
        temp_max_f: "90",
        max_safe_minutes: "120",
        covered_modifier_minutes: "30",
        high_risk_modifier_minutes: "-15"
      },
      {
        rule_id: "food_rule",
        applies_to: "food:chicken_raw",
        temp_min_f: "40",
        temp_max_f: "90",
        max_safe_minutes: "90",
        covered_modifier_minutes: "20",
        high_risk_modifier_minutes: "-20"
      },
      {
        rule_id: "state_rule",
        applies_to: "state:chicken_raw:raw",
        temp_min_f: "40",
        temp_max_f: "90",
        max_safe_minutes: "60",
        covered_modifier_minutes: "15",
        high_risk_modifier_minutes: "-30"
      }
    ],
    foodsById,
    categories,
    allowedStates
  );

  const match = resolveRuleForFood(rules, {
    food_id: "chicken_raw",
    category: "protein",
    state: "raw"
  });

  assert.equal(match.rule_id, "state_rule");
});
