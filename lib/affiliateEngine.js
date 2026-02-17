"use strict";

const MAX_PRODUCTS = 3;

const SCENARIO_TAG_PRIORITY = {
  sitout: ["thermometer", "fridge_thermometer", "container", "freezer_bag", "vacuum_sealer"],
  outage: ["fridge_thermometer", "thermometer", "container", "freezer_bag", "vacuum_sealer"],
  freezer: ["vacuum_sealer", "freezer_bag", "thermometer", "container", "fridge_thermometer"],
  storage: ["container", "freezer_bag", "fridge_thermometer", "thermometer", "vacuum_sealer"]
};

function normalizeStatus(status) {
  const raw = String(status || "").trim().toUpperCase();
  if (raw === "USE CAUTION") return "USE_CAUTION";
  return raw;
}

function normalizedProducts(productsInput) {
  if (!productsInput) return [];
  if (Array.isArray(productsInput)) return productsInput;
  if (Array.isArray(productsInput.items)) return productsInput.items;
  return [];
}

function hasMatch(filterValues, candidate) {
  if (!filterValues || !filterValues.length) return true;
  return filterValues.includes(candidate);
}

function scoreByTagPriority(product, scenarioType, status) {
  const tagOrder = SCENARIO_TAG_PRIORITY[scenarioType] || SCENARIO_TAG_PRIORITY.storage;
  let best = tagOrder.length + 2;

  product.category_tags.forEach((tag) => {
    const idx = tagOrder.indexOf(tag);
    if (idx !== -1) best = Math.min(best, idx);
  });

  if (status === "DISCARD") {
    if (product.category_tags.includes("thermometer")) best = Math.min(best, -3);
    if (product.category_tags.includes("fridge_thermometer")) best = Math.min(best, -2);
    if (product.category_tags.includes("container") || product.category_tags.includes("freezer_bag")) {
      best = Math.min(best, -1);
    }
  }

  if (scenarioType === "outage" && product.category_tags.includes("fridge_thermometer")) {
    best = Math.min(best, -2);
  }
  if (scenarioType === "freezer" && product.category_tags.includes("vacuum_sealer")) {
    best = Math.min(best, -2);
  }
  if (scenarioType === "freezer" && product.category_tags.includes("freezer_bag")) {
    best = Math.min(best, -1);
  }
  if (scenarioType === "sitout" && product.category_tags.includes("thermometer")) {
    best = Math.min(best, -2);
  }

  return best;
}

function getRelevantProducts(input) {
  const scenarioType = String(input?.scenarioType || "storage").trim().toLowerCase();
  const status = normalizeStatus(input?.status);
  const food = input?.food || null;
  const category = String(input?.category || food?.category || "").trim();
  const products = normalizedProducts(input?.products || input?.affiliateProducts);

  const filtered = products.filter((product) => {
    if (!hasMatch(product.applies_to_scenarios, scenarioType)) return false;
    const foodId = food?.food_id ? String(food.food_id) : "";
    if (!hasMatch(product.applies_to_food_ids, foodId)) return false;
    if (!hasMatch(product.applies_to_categories, category)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aScore = scoreByTagPriority(a, scenarioType, status);
    const bScore = scoreByTagPriority(b, scenarioType, status);
    if (aScore !== bScore) return aScore - bScore;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.product_id.localeCompare(b.product_id);
  });

  return sorted.slice(0, MAX_PRODUCTS);
}

module.exports = {
  getRelevantProducts
};
