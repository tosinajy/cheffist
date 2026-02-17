const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DEFAULT_SUBMISSIONS_PATH = path.resolve(process.cwd(), "data/submissions.json");

function asString(value) {
  return String(value == null ? "" : value).trim();
}

function toBool(value) {
  const normalized = asString(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readSubmissions(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Submissions store must be a JSON array.");
  }
  return parsed;
}

function writeSubmissions(filePath, items) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function normalizeSubmission(input) {
  const name = asString(input.name);
  const email = asString(input.email).toLowerCase();
  const consent = toBool(input.consent);
  const honeypot = asString(input.website || input.company || "");
  const source = asString(input.source || "unknown");

  if (honeypot) {
    throw new Error("Spam detected.");
  }
  if (!name) {
    throw new Error("Name is required.");
  }
  if (name.length > 120) {
    throw new Error("Name must be 120 characters or fewer.");
  }
  if (!email) {
    throw new Error("Email is required.");
  }
  if (!isValidEmail(email)) {
    throw new Error("Email format is invalid.");
  }
  if (!consent) {
    throw new Error("Consent is required.");
  }

  return {
    id: crypto.randomUUID(),
    name,
    email,
    consent: true,
    source,
    created_at: new Date().toISOString()
  };
}

function saveSubmission(input, options = {}) {
  const submissionsPath = options.submissionsPath || DEFAULT_SUBMISSIONS_PATH;
  const next = normalizeSubmission(input);
  const submissions = readSubmissions(submissionsPath);
  submissions.push(next);
  writeSubmissions(submissionsPath, submissions);
  return next;
}

module.exports = {
  DEFAULT_SUBMISSIONS_PATH,
  normalizeSubmission,
  saveSubmission
};
