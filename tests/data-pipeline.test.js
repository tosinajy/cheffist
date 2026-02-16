const { test } = require("node:test");
const assert = require("node:assert/strict");

const { parseBoolean, splitList, validateFoodsRows } = require("../scripts/build-data");

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