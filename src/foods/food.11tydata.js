const TOP_SITOUT_COMBOS = [
  { temp_f: 70, duration_minutes: 120, label: "70F for 2h" },
  { temp_f: 85, duration_minutes: 60, label: "85F for 1h" },
  { temp_f: 95, duration_minutes: 30, label: "95F for 30m" }
];
const {
  asJsonLd,
  baseUrlFrom,
  datasetNode,
  organizationNode
} = require("../lib/structured-data");
const { buildAdContext } = require("../lib/ad-context");

function pickDefaultState(food) {
  const states = (food.states || []).map((entry) => entry.state);
  if (states.includes("raw")) return "raw";
  if (states.includes("cooked")) return "cooked";
  return "";
}

function pickTopSitoutPages(data) {
  const prefills = data.sitoutPrefills || [];
  const preferredStates = ["raw", "cooked", ""];
  const selected = [];
  const defaultState = pickDefaultState(data.food);

  TOP_SITOUT_COMBOS.forEach((combo) => {
    const candidates = prefills
      .filter(
        (entry) =>
          entry.food_id === data.food.food_id &&
          entry.variant === "temp_duration" &&
          entry.temp_f === combo.temp_f &&
          entry.duration_minutes === combo.duration_minutes
      )
      .sort((a, b) => {
        const aIdx = preferredStates.indexOf(a.state || "");
        const bIdx = preferredStates.indexOf(b.state || "");
        return aIdx - bIdx || a.url.localeCompare(b.url);
      });

    if (candidates.length) {
      selected.push({
        label: combo.label,
        url: candidates[0].url,
        isStaticPrefill: true
      });
      return;
    }

    const params = new URLSearchParams({
      food_id: data.food.food_id,
      temp_value: String(combo.temp_f),
      temp_unit: "F",
      hours: String(Math.floor(combo.duration_minutes / 60)),
      minutes: String(combo.duration_minutes % 60)
    });

    if (defaultState) {
      params.set("state", defaultState);
    }

    selected.push({
      label: combo.label,
      url: `/food-left-out-calculator/?${params.toString()}`,
      isStaticPrefill: false
    });
  });

  return selected.slice(0, 3);
}

function categoryHubLink(food) {
  const category = String(food.category || "");
  if (category === "dairy") return "/dairy-food-safety/";
  if (category === "produce") return "/produce-food-safety/";
  if (category === "protein" || category === "seafood" || category === "cooked_foods") {
    return "/meat-food-safety/";
  }
  return null;
}

module.exports = {
  layout: "layouts/base.njk",
  pagination: {
    data: "foods.items",
    size: 1,
    alias: "food"
  },
  permalink: (data) => `/how-long-does-${data.food.slug}-last/`,
  eleventyComputed: {
    title: (data) => `How long does ${data.food.name} last?`,
    canonical: (data) => {
      const baseUrl = String(data.site?.url || "").replace(/\/$/, "");
      return `${baseUrl}/how-long-does-${data.food.slug}-last/`;
    },
    sourcesUsed: (data) => {
      const sourceItems = data.sources?.items ?? [];
      const targets = new Set([data.food.food_id, data.food.category, "all_foods"]);
      return sourceItems.filter((source) => targets.has(source.applies_to));
    },
    relatedFoods: (data) => {
      const foodItems = data.foods?.items ?? [];
      return foodItems
        .filter(
          (candidate) =>
            candidate.category === data.food.category &&
            candidate.food_id !== data.food.food_id
        )
        .slice(0, 6);
    },
    calculatorFoodLink: (data) => {
      const state = pickDefaultState(data.food);
      const params = new URLSearchParams({ food_id: data.food.food_id });
      if (state) {
        params.set("state", state);
      }
      return `/food-left-out-calculator/?${params.toString()}`;
    },
    freezerRecoveryLink: (data) => {
      const params = new URLSearchParams({
        food_id: data.food.food_id,
        thaw_state: "partially_thawed",
        thaw_hours: "0",
        thaw_minutes: "30"
      });
      return `/can-i-refreeze-this/?${params.toString()}`;
    },
    categoryHubLink: (data) => categoryHubLink(data.food),
    topSitoutPages: (data) => pickTopSitoutPages(data),
    adContext: (data) =>
      buildAdContext({
        adConfig: data.adConfig,
        status: "SAFE",
        isHighRiskScenario: false
      }),
    jsonLd: (data) => {
      const baseUrl = baseUrlFrom(data);
      const canonical = `${baseUrl}/how-long-does-${data.food.slug}-last/`;
      const pantryRange = `${data.food.pantry_min_days}-${data.food.pantry_max_days} days`;
      const fridgeRange = `${data.food.fridge_min_days}-${data.food.fridge_max_days} days`;
      const freezerRange = `${data.food.freezer_min_days}-${data.food.freezer_max_days} days`;

      const faq = {
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: `How long does ${data.food.name} last?`,
            acceptedAnswer: {
              "@type": "Answer",
              text:
                `${data.food.name} storage ranges are Pantry: ${pantryRange}, ` +
                `Fridge: ${fridgeRange}, Freezer: ${freezerRange}. ` +
                "Use spoilage signs and conservative judgment; this guidance is educational only."
            }
          },
          {
            "@type": "Question",
            name: `How long can ${data.food.name} sit out?`,
            acceptedAnswer: {
              "@type": "Answer",
              text:
                `Sit-out risk for ${data.food.name} depends on time, temperature, and food state. ` +
                `Use the food left out calculator for a conservative estimate and discard when uncertain.`
            }
          }
        ]
      };

      return asJsonLd([
        organizationNode(data),
        datasetNode(data),
        {
          "@type": "WebPage",
          "@id": canonical,
          name: `How long does ${data.food.name} last?`,
          url: canonical,
          dateModified: data.dataset?.last_updated
        },
        faq
      ]);
    }
  }
};
