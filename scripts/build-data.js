const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const OUTPUT_DIR = path.join(ROOT, "src", "_data");

const FILES = {
  foods: path.join(DATA_DIR, "foods.csv"),
  foodStates: path.join(DATA_DIR, "foods_states.csv"),
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
  foodStates: ["food_id", "state", "label", "override_high_risk_food", "notes"],
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
  return parseCsvText(csv, requiredColumns, rel(filePath));
}

function parseCsvText(csvText, requiredColumns, fileLabel) {
  let headers = [];
  let records;
  try {
    records = parse(csvText, {
      bom: true,
      skip_empty_lines: true,
      trim: true,
      columns: (line) => {
        headers = line.map((col) => String(col).trim());
        return headers;
      }
    });
  } catch (error) {
    throw new Error(`Failed to parse ${fileLabel}: ${error.message}`);
  }

  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(`${fileLabel} is missing required columns: ${missingColumns.join(", ")}`);
  }

  return records;
}

function parseOptionalCsvFile(filePath, requiredColumns) {
  if (!fs.existsSync(filePath)) return [];
  return parseCsvFile(filePath, requiredColumns);
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

function toRequiredInt(row, field, rowNumber, fileName) {
  const raw = row[field];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    throw new Error(`${fileName} row ${rowNumber}: ${field} is required`);
  }

  const num = Number(raw);
  if (!Number.isInteger(num)) {
    throw new Error(`${fileName} row ${rowNumber}: ${field} must be an integer`);
  }
  if (num < 0) {
    throw new Error(`${fileName} row ${rowNumber}: ${field} must be >= 0`);
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

  throw new Error(`foods.csv row ${rowNumber}: high_risk_food must be true or false`);
}

function parseBooleanField(value, rowNumber, fileName, fieldName) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "true") return true;
  if (normalized === "false") return false;

  throw new Error(`${fileName} row ${rowNumber}: ${fieldName} must be true or false`);
}

function parseOptionalBoolean(value, rowNumber, fileName, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return parseBooleanField(value, rowNumber, fileName, fieldName);
}

function assertNonEmpty(row, field, rowNumber, fileName) {
  if (!String(row[field] || "").trim()) {
    throw new Error(`${fileName} row ${rowNumber}: ${field} is required`);
  }
}

function getAllowedStates() {
  const configured = process.env.ALLOWED_FOOD_STATES;
  const defaults = ["raw", "cooked", "opened", "unopened"];
  const values = (configured || defaults.join(","))
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(values)];
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

    const pantryMin = toRequiredInt(row, "pantry_min_days", rowNumber, "foods.csv");
    const pantryMax = toRequiredInt(row, "pantry_max_days", rowNumber, "foods.csv");
    const fridgeMin = toRequiredInt(row, "fridge_min_days", rowNumber, "foods.csv");
    const fridgeMax = toRequiredInt(row, "fridge_max_days", rowNumber, "foods.csv");
    const freezerMin = toRequiredInt(row, "freezer_min_days", rowNumber, "foods.csv");
    const freezerMax = toRequiredInt(row, "freezer_max_days", rowNumber, "foods.csv");

    if (pantryMin > pantryMax) {
      throw new Error(`foods.csv row ${rowNumber}: pantry_min_days must be <= pantry_max_days`);
    }
    if (fridgeMin > fridgeMax) {
      throw new Error(`foods.csv row ${rowNumber}: fridge_min_days must be <= fridge_max_days`);
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
      default_affiliate_tags: splitList(row.default_affiliate_tags),
      states: []
    });
  });

  normalized.sort((a, b) => a.food_id.localeCompare(b.food_id));

  const byId = {};
  const bySlug = {};
  const categories = new Set();
  normalized.forEach((food) => {
    byId[food.food_id] = food;
    bySlug[food.slug] = food;
    categories.add(food.category);
  });

  return { items: normalized, byId, bySlug, categories: [...categories].sort() };
}

function validateFoodStatesRows(rows, foodsById, allowedStates) {
  const seenKeys = new Set();
  const normalized = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    assertNonEmpty(row, "food_id", rowNumber, "foods_states.csv");
    assertNonEmpty(row, "state", rowNumber, "foods_states.csv");
    assertNonEmpty(row, "label", rowNumber, "foods_states.csv");

    const foodId = String(row.food_id).trim();
    const state = String(row.state).trim().toLowerCase();

    if (!foodsById[foodId]) {
      throw new Error(`foods_states.csv row ${rowNumber}: unknown food_id '${foodId}'`);
    }
    if (!allowedStates.includes(state)) {
      throw new Error(
        `foods_states.csv row ${rowNumber}: state '${state}' must be one of ${allowedStates.join(", ")}`
      );
    }

    const key = `${foodId}:${state}`;
    if (seenKeys.has(key)) {
      throw new Error(`foods_states.csv row ${rowNumber}: duplicate state key '${key}'`);
    }
    seenKeys.add(key);

    normalized.push({
      food_id: foodId,
      state,
      label: String(row.label).trim(),
      override_high_risk_food: parseOptionalBoolean(
        row.override_high_risk_food,
        rowNumber,
        "foods_states.csv",
        "override_high_risk_food"
      ),
      notes: String(row.notes || "").trim()
    });
  });

  normalized.sort(
    (a, b) => a.food_id.localeCompare(b.food_id) || a.state.localeCompare(b.state)
  );

  const byFoodId = {};
  const byKey = {};
  normalized.forEach((stateEntry) => {
    if (!byFoodId[stateEntry.food_id]) byFoodId[stateEntry.food_id] = [];
    byFoodId[stateEntry.food_id].push(stateEntry);
    byKey[`${stateEntry.food_id}:${stateEntry.state}`] = stateEntry;
  });

  return { items: normalized, byFoodId, byKey, allowedStates };
}

function parseAppliesTo(appliesToValue, rowNumber, foodsById, categories, allowedStates) {
  const appliesTo = String(appliesToValue || "").trim();
  const invalid = () =>
    new Error(
      `sitout_rules.csv row ${rowNumber}: applies_to must be food:{food_id}, category:{category_slug}, or state:{food_id}:{state}`
    );

  if (appliesTo.startsWith("food:")) {
    const foodId = appliesTo.slice(5);
    if (!foodId) throw invalid();
    if (!foodsById[foodId]) {
      throw new Error(`sitout_rules.csv row ${rowNumber}: unknown food_id '${foodId}' in applies_to`);
    }
    return { type: "food", key: foodId, food_id: foodId };
  }

  if (appliesTo.startsWith("category:")) {
    const category = appliesTo.slice(9);
    if (!category) throw invalid();
    if (!categories.has(category)) {
      throw new Error(
        `sitout_rules.csv row ${rowNumber}: unknown category '${category}' in applies_to`
      );
    }
    return { type: "category", key: category, category };
  }

  if (appliesTo.startsWith("state:")) {
    const parts = appliesTo.split(":");
    if (parts.length !== 3) throw invalid();
    const foodId = parts[1];
    const state = parts[2];
    if (!foodId || !state) throw invalid();
    if (!foodsById[foodId]) {
      throw new Error(`sitout_rules.csv row ${rowNumber}: unknown food_id '${foodId}' in applies_to`);
    }
    if (!allowedStates.includes(state)) {
      throw new Error(
        `sitout_rules.csv row ${rowNumber}: state '${state}' in applies_to must be one of ${allowedStates.join(", ")}`
      );
    }
    return { type: "state", key: `${foodId}:${state}`, food_id: foodId, state };
  }

  throw invalid();
}

function validateRulesRows(rows, foodsById, categories, allowedStates) {
  const seenRuleIds = new Set();
  const seenAppliesTo = new Set();
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

    const appliesTo = String(row.applies_to).trim();
    if (seenAppliesTo.has(appliesTo)) {
      throw new Error(`sitout_rules.csv row ${rowNumber}: duplicate applies_to '${appliesTo}'`);
    }
    seenAppliesTo.add(appliesTo);

    const scope = parseAppliesTo(appliesTo, rowNumber, foodsById, categories, allowedStates);
    const priority = scope.type === "state" ? 3 : scope.type === "food" ? 2 : 1;

    normalized.push({
      rule_id: ruleId,
      applies_to: appliesTo,
      scope,
      priority,
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
  const byAppliesTo = {};
  normalized.forEach((rule) => {
    byId[rule.rule_id] = rule;
    byAppliesTo[rule.applies_to] = rule;
  });

  return {
    items: normalized,
    byId,
    byAppliesTo,
    matchingPriority: ["state", "food", "category"]
  };
}

function resolveRuleForFood(rules, { food_id, category, state }) {
  const byAppliesTo = rules.byAppliesTo || {};

  if (state) {
    const stateRule = byAppliesTo[`state:${food_id}:${state}`];
    if (stateRule) return stateRule;
  }

  const foodRule = byAppliesTo[`food:${food_id}`];
  if (foodRule) return foodRule;

  const categoryRule = byAppliesTo[`category:${category}`];
  if (categoryRule) return categoryRule;

  return null;
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
  const foodStatesRaw = parseOptionalCsvFile(FILES.foodStates, REQUIRED.foodStates);
  const rulesRaw = parseCsvFile(FILES.rules, REQUIRED.rules);
  const sourcesRaw = parseCsvFile(FILES.sources, REQUIRED.sources);

  const foods = validateFoodsRows(foodsRaw);
  const allowedStates = getAllowedStates();
  const foodStates = validateFoodStatesRows(foodStatesRaw, foods.byId, allowedStates);

  foods.items.forEach((food) => {
    const stateItems = foodStates.byFoodId[food.food_id] || [];
    food.states = stateItems;
  });

  const rules = validateRulesRows(
    rulesRaw,
    foods.byId,
    new Set(foods.categories),
    allowedStates
  );
  const sources = validateSourceRows(sourcesRaw);
  const dataset = readDatasetVersion();

  writeJson(path.join(OUTPUT_DIR, "foods.json"), foods);
  writeJson(path.join(OUTPUT_DIR, "foodStates.json"), foodStates);
  writeJson(path.join(OUTPUT_DIR, "rules.json"), rules);
  writeJson(path.join(OUTPUT_DIR, "sources.json"), sources);
  writeJson(path.join(OUTPUT_DIR, "dataset.json"), dataset);

  return {
    foodsCount: foods.items.length,
    statesCount: foodStates.items.length,
    rulesCount: rules.items.length,
    sourcesCount: sources.items.length
  };
}

if (require.main === module) {
  try {
    const result = buildData();
    process.stdout.write(
      `Built foods=${result.foodsCount}, states=${result.statesCount}, rules=${result.rulesCount}, sources=${result.sourcesCount}.\n`
    );
  } catch (error) {
    process.stderr.write(`Data build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildData,
  getAllowedStates,
  parseAppliesTo,
  parseBoolean,
  parseCsvFile,
  parseCsvText,
  resolveRuleForFood,
  splitList,
  validateFoodsRows,
  validateRulesRows
};
