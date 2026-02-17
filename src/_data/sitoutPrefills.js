function durationLabel(minutes) {
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function titleCase(input) {
  return String(input || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function scenarioStates(food) {
  const states = food.states || [];
  if (!states.length) return [""];

  const supported = states
    .map((entry) => entry.state)
    .filter((state) => state === "raw" || state === "cooked");

  if (!supported.length) return [""];
  return [...new Set(supported)].sort();
}

module.exports = function buildSitoutPrefills() {
  const foods = require("./foods.json");
  const rules = require("./rules.json");
  const pseoConfig = require("./pseoConfig.json");
  const { evaluateCalculator } = require("../assets/calculator-engine");

  const config = pseoConfig.sitout || {};
  const durations = config.durations_minutes || [30, 60, 120, 240];
  const temps = config.temperatures_f || [70, 85, 95];
  const maxPages = Number(config.max_pages || 240);
  const defaultTempF = Number(config.default_temp_f || 70);
  const noindexConfig = config.noindex || {};
  const safeTempNoindexSet = new Set(noindexConfig.safe_temp_variant_temps_f || [defaultTempF]);

  const pages = [];
  const sortedFoods = [...(foods.items || [])].sort((a, b) => a.slug.localeCompare(b.slug));

  sortedFoods.forEach((food) => {
    scenarioStates(food).forEach((state) => {
      const stateSegment = state ? `${state}/` : "";
      const stateLabel = state ? ` (${titleCase(state)})` : "";

      durations.forEach((minutes) => {
        const duration = durationLabel(minutes);
        const input = {
          food_id: food.food_id,
          state,
          temp_value: defaultTempF,
          temp_unit: "F",
          hours: Math.floor(minutes / 60),
          minutes: minutes % 60,
          covered: false,
          high_risk_consumer: false
        };
        const durationResult = evaluateCalculator(input, foods, rules);
        if (!durationResult.matched_rule) return;

        const durationCanonical = `/food-safety/${food.slug}/sit-out/${stateSegment}${duration}/`;
        const durationIndexable = true;

        pages.push({
          variant: "duration",
          food_id: food.food_id,
          food_slug: food.slug,
          state,
          duration_minutes: minutes,
          temp_f: defaultTempF,
          url: durationCanonical,
          canonical: durationCanonical,
          indexable: durationIndexable,
          noindex_reason: null,
          status: durationResult.status,
          matched_rule_id: durationResult.matched_rule.rule_id,
          title: `Can ${food.name}${stateLabel} sit out for ${duration}?`,
          h1: `Can ${food.name}${stateLabel} sit out for ${duration}?`,
          input,
          explanation: {
            summary:
              "This prefilled scenario applies the conservative sit-out rule set to your selected food, temperature, and duration.",
            outcome_changes: [
              "Higher room temperatures reduce the conservative safe window.",
              "Covered food may slightly extend the estimate when configured.",
              "High-risk food/state and high-risk consumer settings shorten limits."
            ]
          }
        });

        temps.forEach((tempF) => {
          const tempInput = {
            food_id: food.food_id,
            state,
            temp_value: tempF,
            temp_unit: "F",
            hours: Math.floor(minutes / 60),
            minutes: minutes % 60,
            covered: false,
            high_risk_consumer: false
          };
          const tempResult = evaluateCalculator(tempInput, foods, rules);
          if (!tempResult.matched_rule) return;

          const noindexBecauseNearDuplicate =
            tempResult.status === "SAFE" && safeTempNoindexSet.has(tempF);
          const tempCanonical = `/food-safety/${food.slug}/sit-out/${stateSegment}${tempF}f/${duration}/`;

          pages.push({
            variant: "temp_duration",
            food_id: food.food_id,
            food_slug: food.slug,
            state,
            duration_minutes: minutes,
            temp_f: tempF,
            url: tempCanonical,
            canonical: tempCanonical,
            indexable: !noindexBecauseNearDuplicate,
            noindex_reason: noindexBecauseNearDuplicate
              ? "safe_near_duplicate"
              : null,
            status: tempResult.status,
            matched_rule_id: tempResult.matched_rule.rule_id,
            title: `How long can ${food.name}${stateLabel} sit out at ${tempF}F for ${duration}?`,
            h1: `How long can ${food.name}${stateLabel} sit out at ${tempF}F for ${duration}?`,
            input: tempInput,
            explanation: {
              summary:
                "This page preloads a specific temperature and elapsed time to show the conservative recommendation immediately.",
              outcome_changes: [
                "Longer elapsed time increases discard risk.",
                "Selecting a different state can switch to a more specific rule.",
                "Use caution when any spoilage signs are present regardless of estimates."
              ]
            }
          });
        });
      });
    });
  });

  pages.sort((a, b) => a.url.localeCompare(b.url));

  if (pages.length > maxPages) {
    return pages.slice(0, maxPages);
  }

  return pages;
};
