# Cheffist

Eleventy-first scaffold for a data-driven food site.

## Project structure

- `src/`: templates and pages rendered by Eleventy.
- `src/_data/`: generated JSON data + pipeline metadata consumed at build time.
- `src/_includes/`: shared layouts/components.
- `src/assets/`: static assets copied through to output.
- `data/`: source CSV files (source of truth).
- `scripts/`: Node scripts for CSV -> JSON generation and validation hooks.
- `tests/`: Node tests for data pipeline and future business logic.

## Data source of truth

CSV files in `data/` are canonical. Generated files in `src/_data/` are build artifacts created by `npm run data:build`.

Current schema files:
- `data/foods.csv`
- `data/foods_states.csv` (optional state variants)
- `data/sitout_rules.csv`
- `data/sources.csv`
- `data/DATASET_VERSION.json`

## Data pipeline

1. `scripts/build-data.js` reads `data/foods.csv`.
2. Optionally reads `data/foods_states.csv` for per-food state variants.
3. It parses/normalizes records.
4. It writes:
   - `src/_data/foods.json`
   - `src/_data/foodStates.json`
   - `src/_data/rules.json`
   - `src/_data/sources.json`
   - `src/_data/dataset.json`

## Add foods

1. Edit `data/foods.csv` and append a row with headers:
   `food_id,name,slug,category,synonyms,pantry_min_days,pantry_max_days,fridge_min_days,fridge_max_days,freezer_min_days,freezer_max_days,spoilage_signs,storage_tips,notes,high_risk_food,default_affiliate_tags`
2. Use pipe-separated lists for multi-value fields (`synonyms`, `spoilage_signs`, `storage_tips`, `default_affiliate_tags`).
3. Run `npm run data:build`.
4. Commit both CSV changes and generated JSON updates.

## Commands

- `npm run dev`: serve Eleventy locally.
- `npm run data:build`: generate JSON from CSV.
- `npm run build`: run data pipeline then Eleventy production build.
- `npm test`: run Node test runner.

## Node version

- `.nvmrc` pins major version `20`.
- `package.json` engines require `>=20 <23`.

## Eleventy conventions

- Input directory is `src`.
- Includes directory is `src/_includes`.
- Data directory is `src/_data`.
- Output directory is `_site`.
- `src/assets/` is passthrough-copied.
- Clean URLs use Eleventy directory-style permalinks (for example `about/index.html` -> `/about/`).
