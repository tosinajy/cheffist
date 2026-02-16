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
