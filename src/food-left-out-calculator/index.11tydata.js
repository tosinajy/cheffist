const { buildCalculatorContext } = require("../lib/calculator-page-context");
const {
  asJsonLd,
  baseUrlFrom,
  datasetNode,
  organizationNode
} = require("../lib/structured-data");

module.exports = {
  layout: "layouts/app-shell.njk",
  layoutContentWidth: "max-w-4xl",
  title: "Food Left Out Calculator",
  canonical: "/food-left-out-calculator/",
  permalink: "/food-left-out-calculator/",
  eleventyComputed: {
    calculatorContext: (data) => buildCalculatorContext(data, data.calculatorInput),
    jsonLd: (data) => {
      const baseUrl = baseUrlFrom(data);
      const canonical = `${baseUrl}/food-left-out-calculator/`;
      return asJsonLd([
        organizationNode(data),
        datasetNode(data),
        {
          "@type": "SoftwareApplication",
          "@id": `${canonical}#app`,
          name: "Food Left Out Calculator",
          applicationCategory: "HealthApplication",
          operatingSystem: "Web",
          url: canonical,
          description:
            "Conservative educational calculator for food sit-out scenarios based on configured rule inputs."
        },
        {
          "@type": "WebPage",
          "@id": canonical,
          name: "Food Left Out Calculator",
          url: canonical,
          dateModified: data.dataset?.last_updated
        }
      ]);
    }
  }
};
