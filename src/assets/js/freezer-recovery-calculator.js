(function initFreezerRecoveryPage() {
  if (typeof window === "undefined") return;
  var engine = window.CheffistFreezerRecoveryEngine;
  if (!engine) return;

  var form = document.querySelector("[data-freezer-recovery-form]");
  var dataNode = document.getElementById("freezer-recovery-data");
  var statusNode = document.querySelector("[data-freezer-recovery-status]");
  var actionNode = document.querySelector("[data-freezer-recovery-action]");
  var reasonsNode = document.querySelector("[data-freezer-recovery-reasons]");
  var assumptionsNode = document.querySelector("[data-freezer-recovery-assumptions]");

  if (!form || !dataNode) return;

  var pageData = JSON.parse(dataNode.textContent);
  var foods = pageData.foods || { byId: {} };
  var freezerRecoveryRules = pageData.freezerRecoveryRules || {
    items: [],
    byScopeAndState: {}
  };

  function readInput() {
    var formData = new FormData(form);
    return {
      food_id: formData.get("food_id") || "",
      thaw_state: formData.get("thaw_state") || "partially_thawed",
      internal_temp_f: formData.get("internal_temp_f") || "",
      thaw_hours: formData.get("thaw_hours") || "0",
      thaw_minutes: formData.get("thaw_minutes") || "0",
      refrozen: formData.get("refrozen") || "",
      high_risk_consumer: formData.get("high_risk_consumer") || ""
    };
  }

  function parseInput(raw) {
    var hours = Number(raw.thaw_hours);
    var minutes = Number(raw.thaw_minutes);
    var normalizedHours = Number.isFinite(hours) ? Math.max(0, Math.trunc(hours)) : 0;
    var normalizedMinutes = Number.isFinite(minutes) ? Math.max(0, Math.trunc(minutes)) : 0;
    if (normalizedMinutes > 59) {
      normalizedHours += Math.floor(normalizedMinutes / 60);
      normalizedMinutes %= 60;
    }

    var tempValue = Number(raw.internal_temp_f);
    return {
      food_id: String(raw.food_id || "").trim(),
      thaw_state:
        raw.thaw_state === "fully_thawed" ? "fully_thawed" : "partially_thawed",
      internal_temp_f: Number.isFinite(tempValue) ? tempValue : null,
      thaw_hours: normalizedHours,
      thaw_minutes: normalizedMinutes,
      refrozen:
        raw.refrozen === true ||
        raw.refrozen === "1" ||
        raw.refrozen === "true" ||
        raw.refrozen === "on",
      high_risk_consumer:
        raw.high_risk_consumer === true ||
        raw.high_risk_consumer === "1" ||
        raw.high_risk_consumer === "true" ||
        raw.high_risk_consumer === "on"
    };
  }

  function renderResult(result) {
    statusNode.textContent = result.status;
    actionNode.textContent = result.recommendedAction;

    reasonsNode.innerHTML = "";
    result.reasons.forEach(function each(reason) {
      var li = document.createElement("li");
      li.textContent = reason;
      reasonsNode.appendChild(li);
    });

    assumptionsNode.innerHTML = "";
    result.assumptions.forEach(function each(assumption) {
      var li = document.createElement("li");
      li.textContent = assumption;
      assumptionsNode.appendChild(li);
    });
  }

  function writeUrl(input) {
    var params = new URLSearchParams();
    if (input.food_id) params.set("food_id", input.food_id);
    params.set("thaw_state", input.thaw_state);
    if (input.internal_temp_f !== null) params.set("internal_temp_f", String(input.internal_temp_f));
    params.set("thaw_hours", String(input.thaw_hours));
    params.set("thaw_minutes", String(input.thaw_minutes));
    if (input.refrozen) params.set("refrozen", "1");
    if (input.high_risk_consumer) params.set("high_risk_consumer", "1");

    var nextUrl =
      window.location.pathname + (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState({}, "", nextUrl);
  }

  function applyQueryPrefill() {
    var params = new URLSearchParams(window.location.search);
    params.forEach(function each(value, key) {
      var field = form.elements.namedItem(key);
      if (!field) return;
      if (field.type === "checkbox") {
        field.checked = value === "1" || value === "true" || value === "on";
      } else {
        field.value = value;
      }
    });
  }

  function recalculate() {
    var normalized = parseInput(readInput());
    var food = foods.byId[normalized.food_id] || null;
    if (!food) {
      renderResult({
        status: "USE_CAUTION",
        recommendedAction:
          "Select a food and thaw details to get conservative refreeze guidance.",
        reasons: [
          "Choose a food, thaw state, and thaw duration to evaluate conservative refreezing guidance."
        ],
        assumptions: [
          "Conservative output is educational only and not medical advice.",
          "These estimates do not guarantee safety.",
          "When in doubt, throw it out."
        ]
      });
      writeUrl(normalized);
      return;
    }

    var result = engine.evaluateFreezerRecovery({
      food: food,
      thawState: normalized.thaw_state,
      internalTempF: normalized.internal_temp_f,
      thawMinutes: normalized.thaw_hours * 60 + normalized.thaw_minutes,
      refrozen: normalized.refrozen,
      highRiskConsumer: normalized.high_risk_consumer,
      rules: freezerRecoveryRules
    });
    renderResult(result);
    writeUrl(normalized);
  }

  applyQueryPrefill();
  recalculate();

  form.addEventListener("submit", function onSubmit(event) {
    event.preventDefault();
    recalculate();
  });

  form.addEventListener("change", recalculate);
  form.addEventListener("input", recalculate);
})();
