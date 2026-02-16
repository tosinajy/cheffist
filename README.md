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

## Data pipeline

1. `scripts/build-data.js` reads `data/foods.csv`.
2. It parses/normalizes records.
3. It writes:
   - `src/_data/foods.json`
   - `src/_data/foods.meta.json`

## Add foods

1. Edit `data/foods.csv` and append a row with headers:
   `id,name,category,unit,calories_per_unit`
2. Run `npm run data:build`.
3. Commit both CSV changes and generated JSON updates.

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