const { buildFreezerRecoveryContext } = require("../lib/freezer-recovery-page-context");

module.exports = {
  layout: "layouts/base.njk",
  title: "Can I Refreeze This?",
  canonical: "/can-i-refreeze-this/",
  permalink: "/can-i-refreeze-this/",
  eleventyComputed: {
    freezerRecoveryContext: (data) =>
      buildFreezerRecoveryContext(data, data.freezerRecoveryInput)
  }
};
