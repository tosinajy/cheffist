const {
  asJsonLd,
  baseUrlFrom,
  datasetNode,
  organizationNode
} = require("../lib/structured-data");
const { getRelevantProducts } = require("../../lib/affiliateEngine");
const { buildAdContext } = require("../lib/ad-context");

module.exports = {
  layout: "layouts/base.njk",
  title: "Printable Food Storage Chart",
  canonical: "/printable-food-storage-chart/",
  permalink: "/printable-food-storage-chart/",
  showEmailCapture: false,
  eleventyComputed: {
    printableAffiliateProducts: (data) =>
      getRelevantProducts({
        scenarioType: "storage",
        status: "SAFE",
        category: "",
        products: data.affiliateProducts
      }),
    adContext: (data) =>
      buildAdContext({
        adConfig: data.adConfig,
        status: "SAFE",
        isPrintable: true
      }),
    jsonLd: (data) => {
      const baseUrl = baseUrlFrom(data);
      const canonical = `${baseUrl}/printable-food-storage-chart/`;
      return asJsonLd([
        organizationNode(data),
        datasetNode(data),
        {
          "@type": "WebPage",
          "@id": canonical,
          name: "Printable Food Storage Chart",
          url: canonical,
          dateModified: data.dataset?.last_updated
        }
      ]);
    }
  }
};
