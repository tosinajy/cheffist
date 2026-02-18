# Cheffist (Eleventy First Scaffold)

This repository is scaffolded for an Eleventy-first static site with a CSV-to-JSON data pipeline.

## Conventions

- Templates/pages live in `src/`.
- Generated JSON and site metadata live in `src/_data/`.
- Layouts and components live in `src/_includes/`.
- CSV source of truth lives in `data/`.
- Build and validation scripts live in `scripts/`.
- Test coverage for pipeline/logic lives in `tests/`.

## Data Source of Truth

`data/*.csv` files are the editable source records.
Generated artifacts in `src/_data/*.json` should be treated as build output.

## Pipeline

1. `npm run data:build`
2. `scripts/build-data.js` reads `data/foods.csv`, `data/sitout_rules.csv`, and `data/sources.csv`.
3. It validates schema and row-level constraints, then writes deterministic outputs to:
`src/_data/foods.json`, `src/_data/rules.json`, `src/_data/sources.json`, and `src/_data/dataset.json`.

## How to Add Foods

1. Open `data/foods.csv`.
2. Add one row per food item using the existing header columns.
3. Run `npm run data:build`.
4. Commit both CSV changes and generated JSON updates.

## Run Locally

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Build site: `npm run build`
- Run tests: `npm test`

## Eleventy Notes

- Passthrough copy is configured for `src/assets/` to output `/assets/`.
- Clean URLs use directory-style page structure (for example `src/index.njk` -> `/`).
- Calculators are intentionally not implemented in this phase.
