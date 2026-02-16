const { test } = require("node:test");
const assert = require("node:assert/strict");

const { normalizeFoods, parseCsv } = require("../scripts/build-data");

test("parseCsv parses basic CSV rows", () => {
  const csv = [
    "id,name,category,unit,calories_per_unit",
    "banana,Banana,fruit,100g,89"
  ].join("\n");

  const records = parseCsv(csv);
  assert.equal(records.length, 1);
  assert.equal(records[0].name, "Banana");
});

test("normalizeFoods coerces numeric calories", () => {
  const foods = normalizeFoods([
    {
      id: "oatmeal",
      name: "Oatmeal",
      category: "grain",
      unit: "100g",
      calories_per_unit: "68"
    }
  ]);

  assert.equal(foods[0].calories_per_unit, 68);
});