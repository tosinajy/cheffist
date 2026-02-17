const defaultAdConfig = require("../_data/adConfig.json");

function normalizePlacements(config) {
  if (!config || !Array.isArray(config.placements)) return [];
  return config.placements
    .map((placement) => String(placement || "").trim())
    .filter(Boolean);
}

function buildAdContext({
  adConfig,
  status,
  isHighRiskScenario = false,
  isPrintable = false
} = {}) {
  const resolvedConfig = adConfig || defaultAdConfig;
  const placements = normalizePlacements(resolvedConfig);
  const adsEnabled = Boolean(resolvedConfig && resolvedConfig.enableAds);
  const blockedByStatus = String(status || "").toUpperCase() === "DISCARD";
  const enabled = adsEnabled && !blockedByStatus && !isHighRiskScenario && !isPrintable;
  const can = {
    food_after_hero: enabled && placements.includes("food_after_hero"),
    food_after_spoilage: enabled && placements.includes("food_after_spoilage"),
    bottom_page: enabled && placements.includes("bottom_page")
  };

  return {
    enabled,
    placements,
    can
  };
}

module.exports = {
  buildAdContext
};
