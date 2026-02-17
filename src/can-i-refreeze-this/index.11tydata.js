const { buildFreezerRecoveryContext } = require("../lib/freezer-recovery-page-context");
const {
  asJsonLd,
  baseUrlFrom,
  datasetNode,
  organizationNode
} = require("../lib/structured-data");

module.exports = {
  layout: "layouts/app-shell.njk",
  layoutContentWidth: "max-w-4xl",
  title: "Can I Refreeze This?",
  canonical: "/can-i-refreeze-this/",
  permalink: "/can-i-refreeze-this/",
  eleventyComputed: {
    freezerRecoveryContext: (data) =>
      buildFreezerRecoveryContext(data, data.freezerRecoveryInput),
    jsonLd: (data) => {
      const baseUrl = baseUrlFrom(data);
      const canonical = `${baseUrl}/can-i-refreeze-this/`;
      return asJsonLd([
        organizationNode(data),
        datasetNode(data),
        {
          "@type": "SoftwareApplication",
          "@id": `${canonical}#app`,
          name: "Freezer Recovery Calculator",
          applicationCategory: "HealthApplication",
          operatingSystem: "Web",
          url: canonical,
          description:
            "Conservative educational calculator for freezer thaw and refreeze scenarios."
        },
        {
          "@type": "WebPage",
          "@id": canonical,
          name: "Can I Refreeze This?",
          url: canonical,
          dateModified: data.dataset?.last_updated
        }
      ]);
    }
  }
};
