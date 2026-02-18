"use strict";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  layout: "layouts/base.njk",
  pagination: {
    data: "foods.foods",
    size: 1,
    alias: "food"
  },
  eleventyComputed: {
    title: (data) => `How long does ${data.food.name} last?`,
    permalink: (data) => `/how-long-does-${data.food.slug}-last/`,
    canonical: (data) => {
      const siteUrl = (data.site && data.site.siteUrl) || "https://cheffist.com";
      return `${siteUrl}/how-long-does-${data.food.slug}-last/`;
    },
    relatedFoods: (data) => {
      const items = toArray(data.foods && data.foods.foods);
      return items
        .filter(
          (item) =>
            item.food_id !== data.food.food_id && item.category === data.food.category
        )
        .slice(0, 6);
    },
    matchingSources: (data) => {
      const items = toArray(data.sources);
      return items.filter((source) => {
        const appliesTo = toArray(source.applies_to);
        return (
          appliesTo.includes(data.food.food_id) ||
          appliesTo.includes(data.food.category)
        );
      });
    }
  }
};
