const { buildCalculatorContext } = require("../lib/calculator-page-context");

module.exports = {
  layout: "layouts/base.njk",
  title: "Food Left Out Calculator",
  canonical: "/food-left-out-calculator/",
  permalink: "/food-left-out-calculator/",
  eleventyComputed: {
    calculatorContext: (data) => buildCalculatorContext(data, data.calculatorInput)
  }
};
