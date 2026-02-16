const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const OUTPUT_DIR = path.join(ROOT, "src", "_data");

const FILES = {
  foods: path.join(DATA_DIR, "foods.csv"),
  rules: path.join(DATA_DIR, "sitout_rules.csv"),
  sources: path.join(DATA_DIR, "sources.csv"),
  dataset: path.join(DATA_DIR, "DATASET_VERSION.json")
};

const REQUIRED = {
  foods: [
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
  ],
  rules: [
    "rule_id",
    "applies_to",
    "temp_min_f",
    "temp_max_f",
    "max_safe_minutes",
    "covered_modifier_minutes",
    "high_risk_modifier_minutes"
  ],
  sources: ["source_id", "title", "publisher", "url", "notes", "applies_to"]
};

function parseCsvFile(filePath, requiredColumns) {
  const csv = fs.readFileSync(filePath, "utf8");
  let headers = [];

  let records;
  try {
    records = parse(csv, {
      bom: true,
      skip_empty_lines: true,
      trim: true,
      columns: (line) => {
        headers = line.map((col) => String(col).trim());
        return headers;
      }
    });
  } catch (error) {
    throw new Error(`Failed to parse ${rel(filePath)}: ${error.message}`);
  }

  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(
      `${rel(filePath)} is missing required columns: ${missingColumns.join(", ")}`
    );
  }

  return records;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function splitList(value) {
  if (value === undefined || value === null || value === "") return [];
  return String(value)
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function toRequiredInt(row, field, rowNumber) {
  const raw = row[field];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    throw new Error(`foods.csv row ${rowNumber}: ${field} is required`);
  }

  const num = Number(raw);
  if (!Number.isInteger(num)) {
    throw new Error(`foods.csv row ${rowNumber}: ${field} must be an integer`);
  }
  if (num < 0) {
    throw new Error(`foods.csv row ${rowNumber}: ${field} must be >= 0`);
  }

  return num;
}

function toOptionalInt(row, field, rowNumber, fileName) {
  const raw = row[field];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return null;
  }

  const num = Number(raw);
  if (!Number.isInteger(num)) {
    throw new Error(`${fileName} row ${rowNumber}: ${field} must be an integer or empty`);
  }
  return num;
}

function parseBoolean(value, rowNumber) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "true") return true;
  if (normalized === "false") return false;

  throw new Error(
    `foods.csv row ${rowNumber}: high_risk_food must be true or false`
  );
}

function assertNonEmpty(row, field, rowNumber, fileName) {
  if (!String(row[field] || "").trim()) {
    throw new Error(`${fileName} row ${rowNumber}: ${field} is required`);
  }
}

function validateFoodsRows(rows) {
  const seenFoodIds = new Set();
  const seenSlugs = new Set();
  const normalized = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    assertNonEmpty(row, "food_id", rowNumber, "foods.csv");
    assertNonEmpty(row, "name", rowNumber, "foods.csv");
    assertNonEmpty(row, "slug", rowNumber, "foods.csv");
    assertNonEmpty(row, "category", rowNumber, "foods.csv");

    const foodId = String(row.food_id).trim();
    const slug = String(row.slug).trim();

    if (seenFoodIds.has(foodId)) {
      throw new Error(`foods.csv row ${rowNumber}: duplicate food_id '${foodId}'`);
    }
    if (seenSlugs.has(slug)) {
      throw new Error(`foods.csv row ${rowNumber}: duplicate slug '${slug}'`);
    }

    seenFoodIds.add(foodId);
    seenSlugs.add(slug);

    const pantryMin = toRequiredInt(row, "pantry_min_days", rowNumber);
    const pantryMax = toRequiredInt(row, "pantry_max_days", rowNumber);
    const fridgeMin = toRequiredInt(row, "fridge_min_days", rowNumber);
    const fridgeMax = toRequiredInt(row, "fridge_max_days", rowNumber);
    const freezerMin = toRequiredInt(row, "freezer_min_days", rowNumber);
    const freezerMax = toRequiredInt(row, "freezer_max_days", rowNumber);

    if (pantryMin > pantryMax) {
      throw new Error(
        `foods.csv row ${rowNumber}: pantry_min_days must be <= pantry_max_days`
      );
    }
    if (fridgeMin > fridgeMax) {
      throw new Error(
        `foods.csv row ${rowNumber}: fridge_min_days must be <= fridge_max_days`
      );
    }
    if (freezerMin > freezerMax) {
      throw new Error(
        `foods.csv row ${rowNumber}: freezer_min_days must be <= freezer_max_days`
      );
    }

    normalized.push({
      food_id: foodId,
      name: String(row.name).trim(),
      slug,
      category: String(row.category).trim(),
      synonyms: splitList(row.synonyms),
      pantry_min_days: pantryMin,
      pantry_max_days: pantryMax,
      fridge_min_days: fridgeMin,
      fridge_max_days: fridgeMax,
      freezer_min_days: freezerMin,
      freezer_max_days: freezerMax,
      spoilage_signs: splitList(row.spoilage_signs),
      storage_tips: splitList(row.storage_tips),
      notes: String(row.notes || "").trim(),
      high_risk_food: parseBoolean(row.high_risk_food, rowNumber),
      default_affiliate_tags: splitList(row.default_affiliate_tags)
    });
  });

  normalized.sort((a, b) => a.food_id.localeCompare(b.food_id));

  const byId = {};
  const bySlug = {};
  normalized.forEach((food) => {
    byId[food.food_id] = food;
    bySlug[food.slug] = food;
  });

  return { items: normalized, byId, bySlug };
}

function validateRulesRows(rows) {
  const seenRuleIds = new Set();
  const normalized = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    assertNonEmpty(row, "rule_id", rowNumber, "sitout_rules.csv");
    assertNonEmpty(row, "applies_to", rowNumber, "sitout_rules.csv");

    const ruleId = String(row.rule_id).trim();
    if (seenRuleIds.has(ruleId)) {
      throw new Error(`sitout_rules.csv row ${rowNumber}: duplicate rule_id '${ruleId}'`);
    }
    seenRuleIds.add(ruleId);

    normalized.push({
      rule_id: ruleId,
      applies_to: String(row.applies_to).trim(),
      temp_min_f: toOptionalInt(row, "temp_min_f", rowNumber, "sitout_rules.csv"),
      temp_max_f: toOptionalInt(row, "temp_max_f", rowNumber, "sitout_rules.csv"),
      max_safe_minutes: toOptionalInt(
        row,
        "max_safe_minutes",
        rowNumber,
        "sitout_rules.csv"
      ),
      covered_modifier_minutes: toOptionalInt(
        row,
        "covered_modifier_minutes",
        rowNumber,
        "sitout_rules.csv"
      ),
      high_risk_modifier_minutes: toOptionalInt(
        row,
        "high_risk_modifier_minutes",
        rowNumber,
        "sitout_rules.csv"
      )
    });
  });

  normalized.sort((a, b) => a.rule_id.localeCompare(b.rule_id));

  const byId = {};
  normalized.forEach((rule) => {
    byId[rule.rule_id] = rule;
  });

  return { items: normalized, byId };
}

function validateSourceRows(rows) {
  const seenSourceIds = new Set();
  const normalized = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    assertNonEmpty(row, "source_id", rowNumber, "sources.csv");
    assertNonEmpty(row, "title", rowNumber, "sources.csv");
    assertNonEmpty(row, "publisher", rowNumber, "sources.csv");
    assertNonEmpty(row, "url", rowNumber, "sources.csv");
    assertNonEmpty(row, "applies_to", rowNumber, "sources.csv");

    const sourceId = String(row.source_id).trim();
    if (seenSourceIds.has(sourceId)) {
      throw new Error(`sources.csv row ${rowNumber}: duplicate source_id '${sourceId}'`);
    }
    seenSourceIds.add(sourceId);

    normalized.push({
      source_id: sourceId,
      title: String(row.title).trim(),
      publisher: String(row.publisher).trim(),
      url: String(row.url).trim(),
      notes: String(row.notes || "").trim(),
      applies_to: String(row.applies_to).trim()
    });
  });

  normalized.sort((a, b) => a.source_id.localeCompare(b.source_id));

  const byId = {};
  normalized.forEach((source) => {
    byId[source.source_id] = source;
  });

  return { items: normalized, byId };
}

function readDatasetVersion() {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(FILES.dataset, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse ${rel(FILES.dataset)}: ${error.message}`);
  }

  const version = String(parsed.version || "").trim();
  const lastUpdated = String(parsed.last_updated || "").trim();
  const notes = String(parsed.notes || "").trim();

  if (!version) throw new Error("DATASET_VERSION.json: version is required");
  if (!lastUpdated) throw new Error("DATASET_VERSION.json: last_updated is required");

  return {
    version,
    last_updated: lastUpdated,
    notes
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildData() {
  const foodsRaw = parseCsvFile(FILES.foods, REQUIRED.foods);
  const rulesRaw = parseCsvFile(FILES.rules, REQUIRED.rules);
  const sourcesRaw = parseCsvFile(FILES.sources, REQUIRED.sources);

  const foods = validateFoodsRows(foodsRaw);
  const rules = validateRulesRows(rulesRaw);
  const sources = validateSourceRows(sourcesRaw);
  const dataset = readDatasetVersion();

  writeJson(path.join(OUTPUT_DIR, "foods.json"), foods);
  writeJson(path.join(OUTPUT_DIR, "rules.json"), rules);
  writeJson(path.join(OUTPUT_DIR, "sources.json"), sources);
  writeJson(path.join(OUTPUT_DIR, "dataset.json"), dataset);

  return {
    foodsCount: foods.items.length,
    rulesCount: rules.items.length,
    sourcesCount: sources.items.length
  };
}

if (require.main === module) {
  try {
    const result = buildData();
    process.stdout.write(
      `Built foods=${result.foodsCount}, rules=${result.rulesCount}, sources=${result.sourcesCount}.\n`
    );
  } catch (error) {
    process.stderr.write(`Data build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildData,
  parseBoolean,
  parseCsvFile,
  splitList,
  validateFoodsRows
};