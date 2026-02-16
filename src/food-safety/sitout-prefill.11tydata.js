const { buildCalculatorContext } = require("../lib/calculator-page-context");

module.exports = {
  layout: "layouts/base.njk",
  pagination: {
    data: "sitoutPrefills",
    size: 1,
    alias: "prefill"
  },
  permalink: (data) => data.prefill.url,
  eleventyComputed: {
    title: (data) => data.prefill.title,
    canonical: (data) => data.prefill.url,
    calculatorInput: (data) => data.prefill.input,
    calculatorContext: (data) => buildCalculatorContext(data, data.prefill.input)
  }
};
