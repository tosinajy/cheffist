const fs = require("node:fs");
const path = require("node:path");

const prohibitedPhrases = [
  "guaranteed safe",
  "100% safe",
  "completely safe"
];

function getTemplateFiles(rootDir) {
  const out = [];
  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && fullPath.endsWith(".njk")) {
        out.push(fullPath);
      }
    }
  }

  return out.sort((a, b) => a.localeCompare(b));
}

function findMatches(content) {
  const lines = content.split(/\r?\n/);
  const matches = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].toLowerCase();
    for (const phrase of prohibitedPhrases) {
      if (line.includes(phrase)) {
        matches.push({ line: i + 1, phrase });
      }
    }
  }

  return matches;
}

function main() {
  const rootArg = process.argv[2];
  const scanRoot = path.resolve(process.cwd(), rootArg || "src");
  const files = getTemplateFiles(scanRoot);
  const findings = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    const matches = findMatches(content);
    matches.forEach((match) => findings.push({ filePath, ...match }));
  }

  if (findings.length) {
    // eslint-disable-next-line no-console
    console.error("Monetization lint failed. Prohibited safety phrases found:");
    findings.forEach((finding) => {
      // eslint-disable-next-line no-console
      console.error(
        `- ${path.relative(process.cwd(), finding.filePath)}:${finding.line} contains "${finding.phrase}"`
      );
    });
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log("Monetization lint passed.");
}

main();
