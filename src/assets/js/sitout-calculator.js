(function initCalculatorPage() {
  if (typeof window === "undefined") return;
  const engine = window.CheffistSitoutEngine;
  if (!engine) return;

  const form = document.querySelector("[data-calculator-form]");
  const stateWrap = document.querySelector("[data-state-wrap]");
  const stateSelect = document.querySelector("[data-state-select]");
  const resultsNode = document.querySelector("[data-results]");
  const serializedDataNode = document.getElementById("calculator-data");
  const statusNode = document.querySelector("[data-result-status]");
  const limitNode = document.querySelector("[data-result-limit]");
  const reasonsNode = document.querySelector("[data-result-reasons]");
  const assumptionsNode = document.querySelector("[data-result-assumptions]");
  const actionNode = document.querySelector("[data-result-action]");
  const matchedRuleNode = document.querySelector("[data-result-rule]");

  if (!form || !serializedDataNode) return;

  const pageData = JSON.parse(serializedDataNode.textContent);
  const foods = pageData.foods || { items: [], byId: {} };
  const rules = pageData.rules || { items: [], byAppliesTo: {} };

  function currentFormInput() {
    const formData = new FormData(form);
    return {
      food_id: formData.get("food_id") || "",
      state: formData.get("state") || "",
      temp_value: formData.get("temp_value") || "",
      temp_unit: formData.get("temp_unit") || "F",
      hours: formData.get("hours") || "0",
      minutes: formData.get("minutes") || "0",
      covered: formData.get("covered") || "",
      high_risk_consumer: formData.get("high_risk_consumer") || ""
    };
  }

  function syncStateVisibility(selectedFoodId, preferredState) {
    const food = foods.byId[selectedFoodId];
    const states = (food && food.states) || [];

    if (!states.length) {
      stateWrap.hidden = true;
      stateSelect.innerHTML = '<option value="">N/A</option>';
      stateSelect.value = "";
      return;
    }

    stateWrap.hidden = false;
    const options = ['<option value="">Select state</option>']
      .concat(
        states.map(
          (state) =>
            `<option value="${state.state}">${state.label}</option>`
        )
      )
      .join("");
    stateSelect.innerHTML = options;
    stateSelect.value = preferredState || "";
  }

  function renderResult(result) {
    resultsNode.hidden = false;
    statusNode.textContent = result.status;
    limitNode.textContent = result.conservative_safe_limit_label;
    actionNode.textContent = result.recommended_action;
    matchedRuleNode.textContent = result.matched_rule
      ? `${result.matched_rule.rule_id} (${result.matched_rule.applies_to})`
      : "No matching rule";

    reasonsNode.innerHTML = "";
    result.reasons.forEach((reason) => {
      const li = document.createElement("li");
      li.textContent = reason;
      reasonsNode.appendChild(li);
    });

    assumptionsNode.innerHTML = "";
    result.assumptions.forEach((assumption) => {
      const li = document.createElement("li");
      li.textContent = assumption;
      assumptionsNode.appendChild(li);
    });
  }

  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of params.entries()) {
      const field = form.elements.namedItem(key);
      if (!field) continue;

      if (field.type === "checkbox") {
        field.checked = value === "1" || value === "true" || value === "on";
      } else {
        field.value = value;
      }
    }

    const selectedFoodId = form.elements.namedItem("food_id").value;
    const selectedState = params.get("state") || "";
    syncStateVisibility(selectedFoodId, selectedState);
  }

  function writeUrl(input) {
    const params = new URLSearchParams();
    Object.entries(input).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined) return;
      if (typeof value === "boolean") {
        if (value) params.set(key, "1");
        return;
      }
      params.set(key, String(value));
    });

    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }

  function recalculate() {
    const input = currentFormInput();
    syncStateVisibility(input.food_id, input.state);
    const result = engine.evaluateCalculator(input, foods, rules);
    renderResult(result);
    writeUrl(result.input);
  }

  applyUrlParams();
  recalculate();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    recalculate();
  });

  form.addEventListener("change", () => recalculate());
  form.addEventListener("input", () => recalculate());
})();
