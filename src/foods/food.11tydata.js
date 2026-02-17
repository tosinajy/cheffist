const TOP_SITOUT_COMBOS = [
  { temp_f: 70, duration_minutes: 120, label: "70F for 2h" },
  { temp_f: 85, duration_minutes: 60, label: "85F for 1h" },
  { temp_f: 95, duration_minutes: 30, label: "95F for 30m" }
];

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
    topSitoutPages: (data) => pickTopSitoutPages(data),
    jsonLd: (data) => {
      const baseUrl = String(data.site?.url || "").replace(/\/$/, "");
      const canonical = `${baseUrl}/how-long-does-${data.food.slug}-last/`;
      const payload = {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            name: data.site?.organizationName || "Cheffist",
            url: baseUrl
          },
          {
            "@type": "WebPage",
            name: `How long does ${data.food.name} last?`,
            url: canonical,
            dateModified: data.dataset?.last_updated
          }
        ]
      };

      return JSON.stringify(payload);
    }
  }
};
