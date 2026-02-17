const { test } = require("node:test");
const assert = require("node:assert/strict");

const sitoutPrefillsData = require("../src/_data/sitoutPrefills");
const pseoConfig = require("../src/_data/pseoConfig.json");

function getPages() {
  if (Array.isArray(sitoutPrefillsData)) return sitoutPrefillsData;
  if (typeof sitoutPrefillsData === "function") return sitoutPrefillsData();
  if (typeof sitoutPrefillsData.buildSitoutPrefills === "function") {
    return sitoutPrefillsData.buildSitoutPrefills();
  }
  return [];
}

test("sitout prefilled pages are capped and deterministic", () => {
  const pages = getPages();
  assert.ok(pages.length > 0);
  assert.ok(pages.length <= pseoConfig.sitout.max_pages);

  const urls = pages.map((page) => page.url);
  const sorted = [...urls].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(urls, sorted);
});

test("state-based prefilled pages use raw/cooked only when state segment exists", () => {
  const pages = getPages();
  const stateSegmentPages = pages.filter((page) =>
    /\/sit-out\/(raw|cooked)\//.test(page.url)
  );

  assert.ok(stateSegmentPages.length > 0);
  assert.equal(pages.some((page) => /\/sit-out\/opened\//.test(page.url)), false);
  assert.equal(pages.some((page) => /\/sit-out\/unopened\//.test(page.url)), false);
});

test("prefilled pages exclude missing-rule scenarios and include configured noindex pages", () => {
  const pages = getPages();

  assert.equal(pages.some((page) => !page.matched_rule_id), false);
  assert.equal(pages.some((page) => page.indexable === false), true);
});
