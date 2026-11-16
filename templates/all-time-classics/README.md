# All Time Classics

Built-in `CATALOG` template **"All Time Classics"** (de + en). See `docs/plans/ONBOARDING-PLAN.md`, sections 1 and 2.
The loader (`lib/templates/builtIn.ts`, `lib/templates/sync.ts`) reads `manifest.json` + `backup.json` + `images/`
and copies them into a read-only template workspace on startup.

## Contents

| File | Purpose |
| --- | --- |
| `content-draft.json` | **Editable source**: 22 cocktails, 45 ingredients, 15 garnishes, 10 glasses, tag definitions, the card, with stable keys and de/en texts |
| `images/` | 22 cocktail photos (`<cocktail-key>.jpg`) + 9 glass icons (`glass-<key>.png`), all from Wikimedia Commons |
| `SOURCES.md` | Recipe sources per cocktail, deviations from IBA, image licenses/verification, rejected candidates, license summary, share-alike notes, gaps |
| `ATTRIBUTION.md` | Credit lines. **Read by the generator**: the "Template source line (short)" quote becomes the manifest `source`, the "Plain-text lines" block becomes the manifest `attributions` |
| `manifest.json` | Key, kind, version, name/description, locales, `published`, `sortOrder` (hand-written); `source` + `attributions` (generated) |
| `backup.json` | **Generated** from `content-draft.json`. Do not edit by hand |

## Workflow

1. Edit `content-draft.json` (texts, recipes, tags, card), `ATTRIBUTION.md` (credits) or `images/`.
2. Run `pnpm templates:build-catalog all-time-classics --bump`. The script
   - validates the draft (unique keys and names per language, every referenced glass/ingredient/garnish/cocktail,
     base unit/ice/step-action names, tag definitions for every used tag, a credit line for every image, no unused
     images or tag definitions) and the result (backup schema + references, like the loader),
   - writes `backup.json` (deterministic: same draft → same file) and `source`/`attributions` in `manifest.json`,
   - with `--bump`, raises `version` when `backup.json` or the credits changed. Without a version bump running
     instances keep their database copy.
3. Run `pnpm exec vitest run lib/templates` and review the diff, then commit.

`pnpm templates:pull` (export of a workspace maintained in the app) also works for this template, but it replaces
`backup.json` with random ids and content-addressed image names (credits are carried over) and does not update
`content-draft.json`. Use one of the two; currently `content-draft.json` is the source.

### How the draft maps to the backup

- Ids are derived from the keys (`cocktail-<key>`, `ingredient-<key>`, `step-<cocktail>-<n>`, `card-group-<card>-<group>`).
  The import assigns new ids anyway.
- The first language of `meta.languages` (`de`) is the primary content language (texts on the entities). The other
  languages become `*Translations` rows. A workspace in another language gets them swapped on import (pivot).
- Units, ice and step actions are referenced by the base names (`CL`, `ICE_CUBES`, `SHAKE` …). Only the used ones are
  written; the import matches them by name in the target workspace. The `translations` setting of `templates/base`
  (labels) is included and merged (existing labels win).
- `bottleVolumeCl` → ingredient volume in `CL`. `volumeMl` of glasses → glass volume in cl.
- Prices: none. `guestInfoComplete`: always `false` (the CATALOG import also forces this).
- `shortName` has no translation column in the data model. It is only written when it is the same in every
  language (e.g. "Bourbon", "Triple Sec"); otherwise it is left empty.
- `tags` (top level): definition per tag slug with a default tag category (`lib/tags/defaultTagCategories.ts`,
  referenced by its de or en name), de/en label and `public` (default `true`). Ingredient-type tags (`juice`,
  `syrup`, `filler` …) are `public: false`, so they never show on guest menus. When the template is applied, existing
  tag definitions of the workspace are kept; `basics`/`selection` only bring the definitions of tags in use.
- `cards`: the card "All Time Classics" with groups by base spirit/style (Aperitivo, Gin, Whiskey & Cognac,
  Rum & Cachaça, Vodka, Tequila). Card and group names are not translatable in the data model, so they are chosen to
  work in both languages.

## Image credits in the app

- `GET /api/v1/templates` returns the manifest `source` per template (`source`).
- `GET /api/v1/templates/{key}/items` returns `imageCredit` per glass/ingredient/garnish/cocktail with an image (from
  `attributions`, matched by the item's primary name; `lib/templates/credits.ts`), for the setup wizard to show.
- 12 CC BY-SA and 5 CC BY photos require their credit wherever they are shown. After a template is applied, the images
  live in the bar's workspace without a credit (open point, see below).

## Pending maintainer decisions

- **Daiquiri and Tom Collins photos** (Will Shenton, CC BY-SA 3.0): **pending maintainer decision.** There is no
  VRT/OTRS permission ticket; the uploader account name matches the author and the files have been unchallenged since
  2016 (`SOURCES.md` §2). They are included for now. To replace them, swap `images/daiquiri.jpg` /
  `images/tom-collins.jpg`, update the credit lines in `ATTRIBUTION.md` and `SOURCES.md`, and rebuild with `--bump`.
- Credits after import: show `imageCredit`/`source` in the bar's workspace too (e.g. copy the credit into the
  cocktail notes on import, or keep an image-credits page)?
- `isDefault`: the manifest does not mark this catalog as the default CATALOG template.

## How the content was produced

- **Selection**: 21 cocktails from the IBA lists (The Unforgettables, Contemporary Classics, New Era) plus the Gin &
  Tonic, which has no IBA spec. The mix covers all major base spirits and serve styles (stirred, shaken, built,
  muddled, blended, sparkling).
- **Recipes**: Amounts and methods were taken from the current IBA specs (iba-world.com, fetched 2026-11-15) and
  converted from ml to cl. Every deviation is listed in `SOURCES.md` §1. Recipes are facts. Brand names in IBA specs
  (e.g. Kahlúa, Cointreau) were replaced with generic ingredients, except where the brand *is* the ingredient
  (Campari, Aperol, Angostura).
- **Texts**: All descriptions and history notes (de + en) are **original texts** written for this template. Nothing
  was copied from IBA, Wikipedia (CC BY-SA) or other sources. The listed sources were used only to check facts.
- **IBA name**: The IBA is cited as a fact source only (`SOURCES.md`), never as branding. User-facing texts say
  "oriented on common bar standards (incl. IBA); not affiliated with the IBA", and tags are neutral (`classic`,
  `contemporary-classic`, `new-classic`), not IBA category names. Keep it that way: the template must not look like an
  official or endorsed IBA collection, and it should not reproduce the IBA list as a whole (EU database right) – stay
  with a curated selection.
- **Guest info**: ABV, allergens (EU 14, `Allergen` enum), allergen sources and additives (`Additive` enum) are
  **indicative** defaults for typical generic products. They were set only where clearly applicable, e.g. EGGS for
  egg white, SULPHITES for wine-based products, NUTS/ALMONDS for orgeat, FISH for Worcestershire sauce, CELERY for
  celery salt, QUININE for tonic, CAFFEINE for coffee. Per the plan, import them with `guestInfoComplete = false`
  and leave prices empty.
- **Images**: Only Wikimedia Commons files with a verified license (CC0 / PD / CC BY / CC BY-SA; no NC/ND). Each
  file was checked visually for people, logos and brand labels. All are Wikimedia thumbnails, with no local edits.
  Details are in `SOURCES.md` §2.

## Draft format notes

- `amount: null` means "top up" or "to taste", i.e. the source has no fixed amount (soda in Mojito/Spritz;
  Tabasco, celery salt and pepper in Bloody Mary).
- `steps[].action` / `actionGroup` use the default `WorkspaceCocktailRecipeStepAction` names (MIXING: SHAKE, STIR,
  BUILD_IN_GLASS, MUDDLE, BLENDER, …; POURING: SINGLE_STRAIN, DIRTY_ICE, WITHOUT, …). Steps without ingredients
  (e.g. a final `STIR` or `SINGLE_STRAIN`) only describe the technique.
- `ice` uses the default ice names (`ICE_CUBES`, `ICE_CRUSHED`, `WITHOUT_ICE`). Units use the default unit names.
- `shortName`, `allergenSources` and garnish `allergens`/`additives` are optional extras that match the Prisma
  fields.
- `tags` on items are language-neutral slugs (e.g. `classic`, `stirred`); their de/en labels and
  categories are in the top-level `tags` map. Ingredient spirit tags use the same slugs as the cocktail tags
  (`tequila`, `cachaca`) so guest-menu filters match both.

## Review checklist (maintainer)

**Recipes (facts)**
- [ ] Compare each cocktail with its IBA page (links in `SOURCES.md` §1), especially the documented deviations.
- [ ] Whiskey Sour: egg white is 2 cl (optional). IBA says "few drops". Keep it, reduce it, or use another unit?
- [ ] Gin & Tonic (no IBA spec): is 4 cl gin + 12 cl tonic in a balloon glass with a lime wedge OK?
- [ ] Old Fashioned: 3 dashes for "few dashes" Angostura; water not modelled. Old Fashioned & Boulevardier: bourbon
      chosen where IBA allows bourbon *or* rye.
- [ ] Unit mappings: tsp → `BAR_SPOON` (Mojito, Caipirinha), "pinch" salt → 1 `PIECE` (Paloma), "1 espresso" →
      3 cl, "1 lime" → 1 `PIECE`.
- [ ] Glass/ice choices: coupe vs. cocktail glass (Daiquiri, Margarita, Sidecar, Boulevardier); Bloody Mary on ice
      in a highball (IBA default is a rocks glass); crushed ice for Mai Tai and Caipirinha.
- [ ] Mai Tai "Martinique molasses rum": keep it as its own ingredient or merge it with a generic aged rum?
- [ ] French 75: Champagne top-up is a third `BUILD_IN_GLASS` step after straining. Check that the app handles
      this order.

**Guest information (indicative)**
- [ ] ABV values (e.g. rye 45 %, tequila 38 %, triple sec 40 %, Angostura 44.7 %) and bottle sizes.
- [ ] Allergens/additives: SULPHITES on vermouths/sparkling wines; COLORING on Campari/Aperol; cocktail cherry
      (SULPHITES, COLORING, PRESERVATIVE); Worcestershire sauce (FISH; some brands also contain GLUTEN from malt
      vinegar); coconut cream has no allergen (coconut is not an EU tree nut).

**Wording (de/en)**
- [ ] Read all `name` / `description` / `history` texts in both languages for tone, length and spelling (DE:
      "Coupette", "Wermut", "Zeste"; EN: British vs. American spelling, the draft uses British "flavour/savoury").
- [ ] History notes stay cautious where origins are disputed (Margarita, Bloody Mary, Paloma, Cosmopolitan, Negroni
      story). Keep that tone.
- [ ] Brand mentions in texts: "Trader Vic" (Mai Tai history) and "Tabasco" (as an example) only.

**Images & licenses**
- [ ] Spot-check the licenses on the Commons pages linked in `SOURCES.md` §2 (status as of 2026-11-15).
- [ ] Daiquiri & Tom Collins (Will Shenton, no VRT ticket; uploader name matches the author): accept, or replace?
      **Pending maintainer decision** (included for now).
- [ ] Old Fashioned: use the requested credit line "© Erich Wagner (www.eventografie.de)" verbatim.
- [ ] Make sure the app/template shows the `ATTRIBUTION.md` lines wherever template images appear (needed for the
      CC BY and CC BY-SA images; see the share-alike notes in `SOURCES.md` §4).
- [ ] Gap: no image for the `copper-mug` glass (the app's default icon will be used).
- [ ] Visual fit: French 75 is shown in a silver goblet; Boulevardier is shown on the rocks while the spec serves
      it up.
