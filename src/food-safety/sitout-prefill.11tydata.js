const { buildCalculatorContext } = require("../lib/calculator-page-context");

module.exports = {
  layout: "layouts/app-shell.njk",
  layoutContentWidth: "max-w-4xl",
  pagination: {
    data: "sitoutPrefills",
    size: 1,
    alias: "prefill"
  },
  permalink: (data) => data.prefill.url,
  eleventyComputed: {
    title: (data) => data.prefill.title,
    canonical: (data) => data.prefill.canonical || data.prefill.url,
    noindex: (data) => data.prefill.indexable === false,
    calculatorInput: (data) => data.prefill.input,
    calculatorContext: (data) => buildCalculatorContext(data, data.prefill.input)
  }
};
