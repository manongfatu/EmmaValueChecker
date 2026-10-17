# EMMA Value Sheet

A one-page value sheet for EMMA car audio competitors. Plain HTML, CSS and JS — no build step.

## Before you deploy: add the logo

Put the official EMMA logo at:

```
assets/emma-logo.png
```

A transparent PNG about 400–600 px wide works best. It's used in the top bar, as the favicon, and on the exported image. If the file is missing, the app falls back to a plain "EMMA" text label.

## Deploy to Vercel

**Option A — dashboard:** push this folder to a GitHub repo → vercel.com → Add New → Project → import the repo. Framework preset: **Other**. No build command, no output directory. Deploy.

**Option B — CLI:**

```bash
npm i -g vercel
cd emma-value-sheet
vercel        # preview
vercel --prod # production
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Catalog-style design, responsive down to phone width |
| `app.js` | Profiles, parts catalog, totals, local saving, PNG export |
| `data/parts.json` | **The parts database the site reads** (generated) |
| `data/source/` | Source tables: `emmanet-all.html` plus any hand-pasted `.tsv` files |
| `tools/build-parts.mjs` | Turns `data/source/` into `data/parts.json` |
| `vercel.json`, `.vercelignore` | Deploy config (tools and source files aren't uploaded) |
| `assets/emma-logo.png` | **You add this** |

## The parts database

`data/parts.json` holds 15,106 parts from 722 brands, built from the emmanet "All articles" table saved as `data/source/emmanet-all.html`. Categories come from emmanet's own icons (Speaker, Amplifier, Subwoofer, Headunit, Sound Processor, Battery), and each part keeps its emmanet article ID.

**To refresh it** when EMMA updates values: save the All articles table HTML again over `data/source/emmanet-all.html`, run `node tools/build-parts.mjs`, then commit and push.

## Adding single brands by hand

1. On emmanet.com, open a brand, select its table, and copy it.
2. Create `data/source/<Brand>.tsv`, start it with two lines, then paste:

   ```
   # brand: A/D/S
   # type: amp
   model	from	till	description	ASIA value	of
   460MX			4-channel amplifier	1342	2018
   ```

   - `# brand:` is required, spelled exactly as on emmanet.
   - `# type:` is the default category for the file. Without it, the category is guessed from the description.
   - Mixed brands (speakers + amps): add a `type` column and set it per row.
   - Category ids: `source`, `dsp`, `amp`, `speaker`, `sub`, `power`, `cable`, `other`.
3. Run `node tools/build-parts.mjs`. It prints the number of parts and warns about rows with no value or duplicates.
4. Commit and push. Vercel redeploys with the new parts.

If EMMA gives you a full export instead, save it as CSV with the same column names in `data/source/` (one file with a `brand` column also works if you add `# brand:` per file, or ask for a converter tweak).

## How it works

- **Profile** — first name, surname, team, car brand, model, year, class (same list as the EMMA value database). Multiple profiles per browser via the switcher in the top bar.
- **Parts catalog** — search across brand, model and description, filter by brand or category, press **+** to add. Pressing + again raises the quantity. Competitors can't enter or change values.
- **Value sheet** — grouped by category, quantity controls, remove. Values are looked up live from `parts.json`, so when you update a value every saved sheet updates too. If a part is removed from the database, the sheet keeps its last value and flags it.
- **Class limit meter** — for classes with a number in the name (E-Cat 3000, S-Cat 4000, M-Cat 8000, ESPL Trunk 3000 …). Confirm in the current rulebook how limits apply.
- **Save as image** — 2400 px PNG with the logo, competitor, car, every part with its ASIA value and year, and the total. On phones it opens the share sheet.
- **Saving** — profiles live in the browser's `localStorage`. ⋯ menu → Export/Import moves a profile between devices; imports only keep parts that exist in the database.

## Customising

- Value unit: `VALUE_UNIT` at the top of `app.js` (e.g. `"€"`). Empty shows plain numbers.
- Categories, classes and car brand suggestions are arrays at the top of `app.js`.
- Colours and fonts are CSS variables at the top of `styles.css` (`--accent` is the red).
