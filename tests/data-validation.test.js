const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  getAllowedStates,
  parseCsvFile,
  validateFoodsRows,
  validateRulesRows
} = require("../scripts/build-data");

const FOODS_REQUIRED_COLUMNS = [
  "food_id",
  "name",
  "slug",
  "category",
  "synonyms",
  "pantry_min_days",
  "pantry_max_days",
  "fridge_min_days",
  "fridge_max_days",
  "freezer_min_days",
  "freezer_max_days",
  "spoilage_signs",
  "storage_tips",
  "notes",
  "high_risk_food",
  "default_affiliate_tags"
];

function withTempCsv(contents, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cheffist-data-test-"));
  const filePath = path.join(dir, "foods.csv");
  fs.writeFileSync(filePath, contents, "utf8");

  try {
    return run(filePath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("happy path: build-data script succeeds with seeded CSVs", () => {
  const result = spawnSync("node", ["scripts/build-data.js"], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Built foods=\d+, states=\d+, rules=\d+, sources=\d+\./);
});

test("duplicate slug fails with clear reason", () => {
  const csv = [
    FOODS_REQUIRED_COLUMNS.join(","),
    "apple_a,Apple A,dup-slug,produce,apple a,1,2,3,4,5,6,soft,tip,,false,tag",
    "apple_b,Apple B,dup-slug,produce,apple b,1,2,3,4,5,6,soft,tip,,false,tag"
  ].join("\n");

  withTempCsv(csv, (filePath) => {
    const rows = parseCsvFile(filePath, FOODS_REQUIRED_COLUMNS);
    assert.throws(() => validateFoodsRows(rows), /duplicate slug 'dup-slug'/);
  });
});

test("negative duration fails with field-specific error", () => {
  const csv = [
    FOODS_REQUIRED_COLUMNS.join(","),
    "bad_duration,Bad Duration,bad-duration,produce,bad,1,2,-1,4,5,6,soft,tip,,false,tag"
  ].join("\n");

  withTempCsv(csv, (filePath) => {
    const rows = parseCsvFile(filePath, FOODS_REQUIRED_COLUMNS);
    assert.throws(() => validateFoodsRows(rows), /fridge_min_days must be >= 0/);
  });
});

test("min greater than max fails with row and field message", () => {
  const csv = [
    FOODS_REQUIRED_COLUMNS.join(","),
    "bad_range,Bad Range,bad-range,produce,bad,9,2,1,4,5,6,soft,tip,,false,tag"
  ].join("\n");

  withTempCsv(csv, (filePath) => {
    const rows = parseCsvFile(filePath, FOODS_REQUIRED_COLUMNS);
    assert.throws(
      () => validateFoodsRows(rows),
      /foods\.csv row 2: pantry_min_days must be <= pantry_max_days/
    );
  });
});

test("missing required header fails during parse/validation setup", () => {
  const missingHeaderColumns = FOODS_REQUIRED_COLUMNS.filter(
    (header) => header !== "slug"
  );
  const csv = [
    missingHeaderColumns.join(","),
    "missing_slug,Missing Slug,produce,item,1,2,3,4,5,6,soft,tip,,false,tag"
  ].join("\n");

  withTempCsv(csv, (filePath) => {
    assert.throws(
      () => parseCsvFile(filePath, FOODS_REQUIRED_COLUMNS),
      /is missing required columns: slug/
    );
  });
});

test("invalid state in applies_to fails with helpful error", () => {
  const foodsById = { chicken_raw: { food_id: "chicken_raw", category: "protein" } };
  const categories = new Set(["protein"]);

  assert.throws(
    () =>
      validateRulesRows(
        [
          {
            rule_id: "bad_state",
            applies_to: "state:chicken_raw:frozen",
            temp_min_f: "40",
            temp_max_f: "90",
            max_safe_minutes: "60",
            covered_modifier_minutes: "15",
            high_risk_modifier_minutes: "-30"
          }
        ],
        foodsById,
        categories,
        getAllowedStates()
      ),
    /state 'frozen' in applies_to must be one of/
  );
});

test("invalid applies_to shape fails", () => {
  const foodsById = { chicken_raw: { food_id: "chicken_raw", category: "protein" } };
  const categories = new Set(["protein"]);

  assert.throws(
    () =>
      validateRulesRows(
        [
          {
            rule_id: "bad_shape",
            applies_to: "all_foods",
            temp_min_f: "40",
            temp_max_f: "90",
            max_safe_minutes: "120",
            covered_modifier_minutes: "30",
            high_risk_modifier_minutes: "-15"
          }
        ],
        foodsById,
        categories,
        getAllowedStates()
      ),
    /applies_to must be food:\{food_id\}, category:\{category_slug\}, or state:\{food_id\}:\{state\}/
  );
});
