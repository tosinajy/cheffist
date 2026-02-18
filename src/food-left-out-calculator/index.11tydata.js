"use strict";

const {
  evaluateSitoutRisk,
  normalizeDuration,
  normalizeTemp
} = require("../lib/sitoutEngine");
const fallbackFoodsData = require("../_data/foods.json");
const fallbackRulesData = require("../_data/rules.json");

function toBoolean(value) {
  if (value === true || value === false) {
    return value;
  }
  const normalized = (value || "").toString().trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function toString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function getFoodById(foodsById, foodId) {
  if (!foodId) {
    return null;
  }
  return foodsById[foodId] || null;
}

function getEffectiveHighRisk(food, selectedState) {
  if (!food) {
    return false;
  }
  if (!selectedState) {
    return Boolean(food.high_risk_food);
  }
  const stateMeta = (food.states || []).find((item) => item.state === selectedState);
  if (!stateMeta || stateMeta.override_high_risk_food === null || stateMeta.override_high_risk_food === undefined) {
    return Boolean(food.high_risk_food);
  }
  return Boolean(stateMeta.override_high_risk_food);
}

function buildServerResult({ prefill, foodsById, rules }) {
  const food = getFoodById(foodsById, prefill.food_id);
  if (!food) {
    return null;
  }

  const hasTemp = prefill.temp_value !== "" && prefill.temp_value !== null && prefill.temp_value !== undefined;
  const hasDuration = prefill.hours !== "" || prefill.minutes !== "";

  if (!hasTemp || !hasDuration) {
    return null;
  }

  try {
    const { tempF } = normalizeTemp({
      value: Number(prefill.temp_value),
      unit: prefill.temp_unit || "F"
    });
    const { totalMinutes } = normalizeDuration({
      hours: Number(prefill.hours || 0),
      minutes: Number(prefill.minutes || 0)
    });

    const foodForRule = {
      ...food,
      high_risk_food: getEffectiveHighRisk(food, prefill.state)
    };

    return evaluateSitoutRisk({
      food: foodForRule,
      state: prefill.state || "",
      tempF,
      minutes: totalMinutes,
      covered: toBoolean(prefill.covered),
      highRiskConsumer: toBoolean(prefill.high_risk_consumer),
      rules
    });
  } catch {
    return null;
  }
}

module.exports = (data) => {
  const foodsData =
    data.foods &&
    typeof data.foods === "object" &&
    Array.isArray(data.foods.foods) &&
    data.foods.byId &&
    typeof data.foods.byId === "object"
      ? data.foods
      : fallbackFoodsData;

  const foods = Array.isArray(foodsData.foods) ? foodsData.foods : [];
  const foodsById = foodsData.byId && typeof foodsData.byId === "object" ? foodsData.byId : {};

  const rules =
    Array.isArray(data.rules) && data.rules.length > 0
      ? data.rules
      : fallbackRulesData || [];

  const defaultInput = {
    food_id: "",
    state: "",
    temp_value: "",
    temp_unit: "F",
    hours: "",
    minutes: "",
    covered: false,
    high_risk_consumer: false
  };

  const prefill = {
    ...defaultInput,
    ...(data.calculatorPrefill || {})
  };

  prefill.food_id = toString(prefill.food_id).trim();
  prefill.state = toString(prefill.state).trim().toLowerCase();
  prefill.temp_value = toString(prefill.temp_value).trim();
  prefill.temp_unit = (toString(prefill.temp_unit).trim().toUpperCase() || "F") === "C" ? "C" : "F";
  prefill.hours = toString(prefill.hours).trim();
  prefill.minutes = toString(prefill.minutes).trim();
  prefill.covered = toBoolean(prefill.covered);
  prefill.high_risk_consumer = toBoolean(prefill.high_risk_consumer);

  const selectedFood = getFoodById(foodsById, prefill.food_id);
  if (selectedFood && prefill.state) {
    const validState = (selectedFood.states || []).some((item) => item.state === prefill.state);
    if (!validState) {
      prefill.state = "";
    }
  }

  const selectedFoodLabel = selectedFood ? selectedFood.name : "";
  const serverResult = buildServerResult({ prefill, foodsById, rules });

  return {
    title: "Food Left Out Calculator",
    layout: "layouts/base.njk",
    permalink: "/food-left-out-calculator/",
    canonical: "https://cheffist.com/food-left-out-calculator/",
    calculator: {
      foods,
      rules,
      initialInput: prefill,
      selectedFoodLabel,
      selectedFood,
      clientDataJson: JSON.stringify({ foods, rules }),
      serverResult
    }
  };
};
