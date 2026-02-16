const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const OUTPUT_DIR = path.join(ROOT, "src", "_data");
const SOURCE_FILE = path.join(DATA_DIR, "foods.csv");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "foods.json");
const META_FILE = path.join(OUTPUT_DIR, "foods.meta.json");

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const record = {};

    headers.forEach((header, i) => {
      record[header] = (values[i] ?? "").trim();
    });

    return record;
  });
}

function splitCsvLine(line) {
  const out = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      out.push(value);
      value = "";
      continue;
    }

    value += char;
  }

  out.push(value);
  return out;
}

function normalizeFoods(records) {
  return records.map((record) => ({
    id: record.id || "",
    name: record.name || "",
    category: record.category || "",
    unit: record.unit || "",
    calories_per_unit: toNumber(record.calories_per_unit)
  }));
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function ensureSeedCsv() {
  if (fs.existsSync(SOURCE_FILE)) return;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const seed = [
    "id,name,category,unit,calories_per_unit",
    "apple,Apple,fruit,100g,52"
  ].join("\n");

  fs.writeFileSync(SOURCE_FILE, seed, "utf8");
}

function buildData() {
  ensureSeedCsv();

  const csv = fs.readFileSync(SOURCE_FILE, "utf8");
  const parsed = parseCsv(csv);
  const foods = normalizeFoods(parsed);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(foods, null, 2)}\n`, "utf8");

  const metadata = {
    source: path.relative(ROOT, SOURCE_FILE).replace(/\\/g, "/"),
    generated_at: new Date().toISOString(),
    count: foods.length
  };
  fs.writeFileSync(META_FILE, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return { foods, metadata };
}

if (require.main === module) {
  const result = buildData();
  process.stdout.write(`Built ${result.metadata.count} food records.\n`);
}

module.exports = {
  buildData,
  normalizeFoods,
  parseCsv,
  splitCsvLine,
  toNumber
};