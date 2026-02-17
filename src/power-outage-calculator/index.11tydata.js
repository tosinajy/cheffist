const { buildPowerOutageContext } = require("../lib/power-outage-page-context");

module.exports = {
  layout: "layouts/base.njk",
  title: "Power Outage Food Safety Calculator",
  canonical: "/power-outage-calculator/",
  permalink: "/power-outage-calculator/",
  eleventyComputed: {
    powerOutageContext: (data) => buildPowerOutageContext(data, data.powerOutageInput)
  }
};
