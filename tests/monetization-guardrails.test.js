const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runNpm(args) {
  const command = `${npmCommand()} ${args.join(" ")}`;
  return spawnSync(command, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true
  });
}

test("monetization lint fails on prohibited safety phrases", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "monetization-lint-"));
  const srcDir = path.join(tempRoot, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(
    path.join(srcDir, "bad.njk"),
    "<p>This method is guaranteed safe for everyone.</p>\n",
    "utf8"
  );

  const result = spawnSync(
    process.execPath,
    [path.join(process.cwd(), "scripts/monetization-lint.js"), srcDir],
    { encoding: "utf8" }
  );

  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /guaranteed safe/i);
});

test("DISCARD sit-out page keeps monetization below safety output", () => {
  const build = runNpm(["run", "build"]);

  assert.equal(build.status, 0, build.stderr || build.stdout);

  const discardPagePath = path.join(
    process.cwd(),
    "_site",
    "food-safety",
    "chicken-raw",
    "sit-out",
    "raw",
    "85f",
    "4h",
    "index.html"
  );

  assert.equal(fs.existsSync(discardPagePath), true, "Expected known DISCARD page to exist.");

  const html = fs.readFileSync(discardPagePath, "utf8");
  const resultIndex = html.indexOf("<h2>Result</h2>");
  assert.notEqual(resultIndex, -1, "Result heading missing.");

  const firstAdIndex = html.indexOf("Ad slot:");
  assert.equal(firstAdIndex, -1, "DISCARD page should not render ad slots.");

  const disclaimerIndex = html.indexOf('Read the <a href="/disclaimer/">disclaimer</a>');
  const affiliateIndex = html.indexOf("Recommended tools (affiliate links)");
  assert.notEqual(disclaimerIndex, -1, "Disclaimer text missing.");
  assert.notEqual(affiliateIndex, -1, "Affiliate block heading missing.");
  assert.ok(
    affiliateIndex > disclaimerIndex,
    "Affiliate block must appear below disclaimer on DISCARD pages."
  );
});
