const fs = require("node:fs");
const path = require("node:path");

function buildReport() {
  const buildSitoutPrefills = require("../src/_data/sitoutPrefills");
  const pages = buildSitoutPrefills();

  const output = {
    generated_at: new Date().toISOString(),
    count: pages.length,
    pages: pages.map((page) => ({
      url: page.url,
      canonical: page.canonical || page.url,
      indexable: page.indexable !== false,
      status: page.status || null,
      variant: page.variant,
      noindex_reason: page.noindex_reason || null,
      matched_rule_id: page.matched_rule_id || null
    }))
  };

  const outDir = path.join(process.cwd(), "dist", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "pseo-pages.json"),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );
}

try {
  buildReport();
  process.stdout.write("Built dist/reports/pseo-pages.json\n");
} catch (error) {
  process.stderr.write(`Failed to build pSEO report: ${error.message}\n`);
  process.exitCode = 1;
}
