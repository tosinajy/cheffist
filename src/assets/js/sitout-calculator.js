"use strict";

(() => {
  const dataEl = document.getElementById("calculator-data");
  if (!dataEl) return;

  const payload = JSON.parse(dataEl.textContent);
  const foods = payload.foods || [];
  const rules = payload.rules || [];
  const foodsById = Object.fromEntries(foods.map((food) => [food.food_id, food]));
  const foodsByName = Object.fromEntries(foods.map((food) => [food.name.toLowerCase(), food.food_id]));

  const form = document.getElementById("sitout-form");
  const foodQueryEl = document.getElementById("food-query");
  const foodSuggestionsEl = document.getElementById("food-suggestions");
  const foodIdEl = document.getElementById("food-id");
  const stateWrapEl = document.getElementById("state-wrap");
  const stateEl = document.getElementById("state");
  const tempValueEl = document.getElementById("temp-value");
  const hoursEl = document.getElementById("hours");
  const minutesEl = document.getElementById("minutes");
  const coveredEl = document.getElementById("covered");
  const highRiskEl = document.getElementById("high-risk-consumer");
  const resultEmptyEl = document.getElementById("result-empty");
  const resultContentEl = document.getElementById("result-content");
  if (!form || !foodQueryEl || !foodIdEl || !stateWrapEl || !stateEl || !tempValueEl || !hoursEl || !minutesEl || !coveredEl || !highRiskEl || !resultContentEl || !foodSuggestionsEl) {
    return;
  }

  const searchableFoods = foods.map((food) => ({
    ...food,
    _searchText: [
      food.name,
      food.category,
      ...(food.synonyms || []),
      ...(food.default_affiliate_tags || [])
    ]
      .join(" ")
      .toLowerCase()
  }));

  function toFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeTemp(value, unit) {
    const numeric = toFiniteNumber(value);
    if (numeric === null) throw new Error("invalid temp");
    if ((unit || "F").toUpperCase() === "C") {
      return Number((((numeric * 9) / 5) + 32).toFixed(2));
    }
    return numeric;
  }

  function normalizeDuration(hours, minutes) {
    const h = toFiniteNumber(hours) ?? 0;
    const m = toFiniteNumber(minutes) ?? 0;
    if (h < 0 || m < 0) throw new Error("invalid duration");
    return Math.floor(h * 60 + m);
  }

  function parseAppliesTo(value) {
    const v = (value || "").toLowerCase().trim();
    let match = v.match(/^state:([a-z0-9_]+):([a-z]+)$/);
    if (match) return { scope: "state", food_id: match[1], state: match[2], priority: 0 };
    match = v.match(/^food:([a-z0-9_]+)$/);
    if (match) return { scope: "food", food_id: match[1], priority: 1 };
    match = v.match(/^category:([a-z0-9-]+)$/);
    if (match) return { scope: "category", category: match[1], priority: 2 };
    return null;
  }

  function getApplicableRules(food, state) {
    const matches = [];
    for (const rule of rules) {
      const parsed = parseAppliesTo(rule.applies_to);
      if (!parsed) continue;

      const foodId = (food.food_id || "").toLowerCase();
      const category = (food.category || "").toLowerCase();
      const currentState = (state || "").toLowerCase();

      let applies = false;
      if (parsed.scope === "state") applies = parsed.food_id === foodId && parsed.state === currentState;
      if (parsed.scope === "food") applies = parsed.food_id === foodId;
      if (parsed.scope === "category") applies = parsed.category === category;
      if (!applies) continue;

      matches.push({ ...rule, _priority: parsed.priority, _scope: parsed.scope });
    }

    return matches.sort((a, b) => {
      if (a._priority !== b._priority) return a._priority - b._priority;
      if (a.max_safe_minutes !== b.max_safe_minutes) return a.max_safe_minutes - b.max_safe_minutes;
      return String(a.rule_id).localeCompare(String(b.rule_id));
    });
  }

  function evaluateSitoutRisk(input) {
    const assumptions = [
      "Educational guidance only, not medical advice.",
      "Guidance is conservative and not a guarantee of safety.",
      "When in doubt, discard."
    ];
    const reasons = [];

    const tempF = input.tempF;
    const minutes = input.minutes;
    if (!Number.isFinite(tempF) || !Number.isFinite(minutes) || minutes < 0) {
      return {
        status: "USE_CAUTION",
        safeLimitMinutes: 0,
        reasons: ["Input data is invalid for temperature or duration."],
        assumptions,
        recommendedAction: "When in doubt, discard."
      };
    }

    const applicable = getApplicableRules(input.food, input.state);
    const tempMatches = applicable.filter((rule) => tempF >= rule.temp_min_f && tempF <= rule.temp_max_f);
    if (tempMatches.length === 0) {
      return {
        status: "USE_CAUTION",
        safeLimitMinutes: 0,
        reasons: [
          "No matching sit-out rule for this food and temperature range.",
          "Risk estimate defaults to conservative caution due to missing matching rule data."
        ],
        assumptions,
        recommendedAction: "When in doubt, discard."
      };
    }

    const bestPriority = Math.min(...tempMatches.map((rule) => rule._priority));
    const selected = tempMatches
      .filter((rule) => rule._priority === bestPriority)
      .sort((a, b) => {
        if (a.max_safe_minutes !== b.max_safe_minutes) return a.max_safe_minutes - b.max_safe_minutes;
        return String(a.rule_id).localeCompare(String(b.rule_id));
      })[0];

    let limit = Math.floor(selected.max_safe_minutes);
    const baseCap = limit;

    reasons.push(`Matched ${tempMatches.length} temperature rule(s); prioritizing ${selected._scope}-specific rule "${selected.rule_id}".`);

    if (input.highRiskConsumer) {
      limit += Math.min(0, Number.parseInt(selected.high_risk_modifier_minutes, 10) || 0);
      reasons.push("High-risk consumer mode reduces the conservative sit-out limit.");
    }
    if (input.covered) {
      const coveredModifier = Math.min(0, Number.parseInt(selected.covered_modifier_minutes, 10) || 0);
      limit += coveredModifier;
      reasons.push(coveredModifier < 0 ? "Covered state applied with conservative adjustment." : "Covered state kept neutral to avoid raising conservative limits.");
    }

    limit = Math.max(0, Math.floor(limit));
    limit = Math.min(baseCap, limit);

    const cautionBuffer = Math.max(5, Math.floor(limit * 0.1));
    const cautionThreshold = Math.max(0, limit - cautionBuffer);

    let status = "SAFE";
    let recommendedAction = "Consume promptly and refrigerate immediately if not eating now.";

    if (minutes > limit) {
      status = "DISCARD";
      recommendedAction = "Discard the food.";
      reasons.push("Elapsed sit-out time exceeds the conservative limit.");
    } else if (minutes >= cautionThreshold) {
      status = "USE_CAUTION";
      recommendedAction = "Use caution and refrigerate immediately; when in doubt, discard.";
      reasons.push("Elapsed time is near the conservative limit.");
    } else {
      reasons.push("Elapsed time remains below the conservative caution threshold.");
    }

    return { status, safeLimitMinutes: limit, reasons, assumptions, recommendedAction };
  }

  function safeLimitHuman(minutes) {
    const mins = Math.max(0, Math.floor(minutes));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function toggleStateSelector(foodId, selectedState) {
    const food = foodsById[foodId];
    const states = food && Array.isArray(food.states) ? food.states : [];

    stateEl.innerHTML = '<option value="">Select state</option>';
    for (const item of states) {
      const option = document.createElement("option");
      option.value = item.state;
      option.textContent = item.label;
      if (item.state === selectedState) {
        option.selected = true;
      }
      stateEl.appendChild(option);
    }

    if (states.length > 0) {
      stateWrapEl.classList.remove("hidden");
    } else {
      stateWrapEl.classList.add("hidden");
      stateEl.value = "";
    }
  }

  function setSuggestionsOpen(isOpen) {
    foodSuggestionsEl.classList.toggle("hidden", !isOpen);
    foodQueryEl.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  function findFoodMatches(query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) {
      return searchableFoods.slice(0, 8);
    }

    const exact = searchableFoods.find((food) => food.name.toLowerCase() === q);
    if (exact) {
      return [exact];
    }

    const startsWith = searchableFoods.filter((food) => food.name.toLowerCase().startsWith(q));
    const contains = searchableFoods.filter(
      (food) => !food.name.toLowerCase().startsWith(q) && food._searchText.includes(q)
    );

    return [...startsWith, ...contains].slice(0, 8);
  }

  function selectFood(food) {
    if (!food) {
      return;
    }
    foodQueryEl.value = food.name;
    foodIdEl.value = food.food_id;
    toggleStateSelector(food.food_id, stateEl.value);
    setSuggestionsOpen(false);
  }

  function renderSuggestions(query) {
    const matches = findFoodMatches(query);
    foodSuggestionsEl.innerHTML = "";

    if (matches.length === 0) {
      setSuggestionsOpen(false);
      return;
    }

    for (const food of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "flex w-full items-start justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50";
      button.innerHTML = `<span>${food.name}</span><span class="ml-3 text-xs text-surface-500 capitalize">${food.category}</span>`;
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectFood(food);
        recalculate();
      });
      foodSuggestionsEl.appendChild(button);
    }

    setSuggestionsOpen(true);
  }

  function syncFoodIdFromQuery() {
    const typed = (foodQueryEl.value || "").trim().toLowerCase();
    const exactId = foodsByName[typed];
    const firstPrefixMatch = searchableFoods.find((food) => food.name.toLowerCase().startsWith(typed));
    const nextId = exactId || (typed && firstPrefixMatch ? firstPrefixMatch.food_id : "");
    foodIdEl.value = nextId;
    toggleStateSelector(nextId, stateEl.value);
  }

  function getCurrentInput() {
    const foodId = foodIdEl.value;
    const food = foodsById[foodId] || null;
    const tempUnitEl = form.querySelector('input[name="temp_unit"]:checked');
    const tempUnit = tempUnitEl ? tempUnitEl.value : "F";

    const state = (stateEl.value || "").toLowerCase();

    if (!food) {
      return null;
    }

    const effectiveStateMeta = (food.states || []).find((item) => item.state === state);
    const highRiskFromState = effectiveStateMeta && effectiveStateMeta.override_high_risk_food !== null && effectiveStateMeta.override_high_risk_food !== undefined
      ? Boolean(effectiveStateMeta.override_high_risk_food)
      : Boolean(food.high_risk_food);

    const foodForEval = { ...food, high_risk_food: highRiskFromState };

    return {
      food: foodForEval,
      state,
      tempUnit,
      tempValue: tempValueEl.value,
      hours: hoursEl.value,
      minutes: minutesEl.value,
      covered: coveredEl.checked,
      highRiskConsumer: highRiskEl.checked
    };
  }

  function updateQueryString(input) {
    const params = new URLSearchParams();
    if (input.food.food_id) params.set("food_id", input.food.food_id);
    if (input.state) params.set("state", input.state);
    if (input.tempValue !== "") params.set("temp_value", input.tempValue);
    params.set("temp_unit", input.tempUnit);
    if (input.hours !== "") params.set("hours", input.hours);
    if (input.minutes !== "") params.set("minutes", input.minutes);
    if (input.covered) params.set("covered", "1");
    if (input.highRiskConsumer) params.set("high_risk_consumer", "1");

    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", next);
  }

  function renderResult(result) {
    const statusClass = {
      SAFE: "bg-green-100 text-green-800",
      USE_CAUTION: "bg-amber-100 text-amber-800",
      DISCARD: "bg-red-100 text-red-800"
    }[result.status] || "bg-surface-100 text-surface-800";

    resultContentEl.innerHTML = `
      <div class="mb-4 flex items-center justify-between gap-2">
        <h2 class="text-lg font-semibold text-surface-900">Conservative Assessment</h2>
        <span class="rounded-full px-3 py-1 text-xs font-semibold ${statusClass}">${result.status.replace("_", " ")}</span>
      </div>
      <p class="rounded-xl bg-surface-50 p-4 text-sm text-surface-700">Conservative safe limit: <strong>${safeLimitHuman(result.safeLimitMinutes)}</strong> (${result.safeLimitMinutes} min)</p>
      <div class="mt-5 grid gap-5">
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-[0.12em] text-surface-500">Reasons</h3>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-surface-700">${result.reasons.map((reason) => `<li>${reason}</li>`).join("")}</ul>
        </div>
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-[0.12em] text-surface-500">Assumptions</h3>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-surface-700">${result.assumptions.map((item) => `<li>${item}</li>`).join("")}</ul>
          <a href="/disclaimer/" class="mt-2 inline-block text-sm font-medium text-brand hover:underline">Read full disclaimer</a>
        </div>
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-[0.12em] text-surface-500">Recommended action</h3>
          <p class="mt-2 rounded-xl border border-surface-200 p-3 text-sm text-surface-800">${result.recommendedAction}</p>
        </div>
      </div>
    `;

    resultContentEl.classList.remove("hidden");
    if (resultEmptyEl) {
      resultEmptyEl.classList.add("hidden");
    }
  }

  function renderEmpty() {
    if (resultEmptyEl) {
      resultEmptyEl.classList.remove("hidden");
    }
    resultContentEl.classList.add("hidden");
    resultContentEl.innerHTML = "";
  }

  function recalculate() {
    syncFoodIdFromQuery();
    const input = getCurrentInput();

    if (!input || input.tempValue === "" || (input.hours === "" && input.minutes === "")) {
      renderEmpty();
      if (input) {
        updateQueryString(input);
      }
      return;
    }

    try {
      const tempF = normalizeTemp(input.tempValue, input.tempUnit);
      const totalMinutes = normalizeDuration(input.hours, input.minutes);

      const result = evaluateSitoutRisk({
        food: input.food,
        state: input.state,
        tempF,
        minutes: totalMinutes,
        covered: input.covered,
        highRiskConsumer: input.highRiskConsumer
      });

      renderResult(result);
      updateQueryString(input);
    } catch {
      renderEmpty();
    }
  }

  function applyQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const foodId = params.get("food_id") || "";
    const food = foodsById[foodId] || null;

    if (food) {
      foodIdEl.value = foodId;
      foodQueryEl.value = food.name;
    }

    const state = (params.get("state") || "").toLowerCase();
    toggleStateSelector(foodIdEl.value, state);
    if (state) {
      stateEl.value = state;
    }

    if (params.has("temp_value")) tempValueEl.value = params.get("temp_value");
    if (params.has("temp_unit")) {
      const unit = (params.get("temp_unit") || "F").toUpperCase() === "C" ? "C" : "F";
      const radio = form.querySelector(`input[name="temp_unit"][value="${unit}"]`);
      if (radio) radio.checked = true;
    }
    if (params.has("hours")) hoursEl.value = params.get("hours");
    if (params.has("minutes")) minutesEl.value = params.get("minutes");
    coveredEl.checked = params.get("covered") === "1" || params.get("covered") === "true";
    highRiskEl.checked = params.get("high_risk_consumer") === "1" || params.get("high_risk_consumer") === "true";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    recalculate();
  });

  foodQueryEl.addEventListener("focus", () => {
    renderSuggestions(foodQueryEl.value);
  });

  foodQueryEl.addEventListener("blur", () => {
    setTimeout(() => setSuggestionsOpen(false), 120);
  });

  foodQueryEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSuggestionsOpen(false);
    }
  });

  [foodQueryEl, stateEl, tempValueEl, hoursEl, minutesEl, coveredEl, highRiskEl].forEach((el) => {
    el.addEventListener("change", recalculate);
    el.addEventListener("input", recalculate);
  });

  foodQueryEl.addEventListener("input", () => {
    renderSuggestions(foodQueryEl.value);
  });

  form.querySelectorAll('input[name="temp_unit"]').forEach((el) => el.addEventListener("change", recalculate));

  applyQueryParams();
  toggleStateSelector(foodIdEl.value, stateEl.value);
  recalculate();
})();
