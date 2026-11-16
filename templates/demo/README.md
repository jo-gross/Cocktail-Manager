# `demo` – content of the demo instance

Built-in template of kind `DEMO` (default, published). Every demo visitor on a demo instance (`DEMO_MODE=true`) gets a
copy in their language (`de` or `en`, see `lib/demo/createDemoWorkspace.ts`), plus generated activity (statistics,
ratings, queue – `lib/demo/sampleActivity.ts`). On regular instances it is synced into the database like every built-in
template but never applied.

Content (German primary, English translations for all glasses, garnishes, ingredients and cocktails):

- 12 cocktails with recipes, prices, glass, ice, garnishes, history texts and images (6), allergens/additives/ABV
  confirmed on all ingredients
- 2 cards: **Classics** (Highballs, Sours, Stirred) and **Summer Specials** (Spritz & Highballs, Zero Proof); card and
  group names are English bar terms because cards have no translations
- tag definitions (flavor, spirit, style, properties, season) matching the `BASE` tag categories
- guest menu "Cocktailkarte" (`/m/{workspaceId}`, slug `cocktails`): Speakeasy design, source card Classics plus a
  manual summer section; stays enabled, published and default after cloning (`keepGuestMenuState`)
- signage: a landscape guest menu slide
- calculation "Summer Party (120)"
- settings: Europe/Berlin, EUR, bar day starts at 05:00

Images were taken from the former `config/images` and resized to the app's upload sizes (cocktails 504×896, glasses
400×400).

## Changing the content

The repo files are only the initial version; maintain the content in the app and pull it back:

1. Start an instance with this repo (the template is synced into the database on start).
2. Clone the built-in template into an editable one and join it with the returned one-time code:

   ```bash
   curl -X POST -H "Authorization: Bearer $INSTANCE_MASTER_API_KEY" -H 'Content-Type: application/json' \
     -d '{"key":"demo-edit"}' http://localhost:3000/api/admin/templates/demo/clone
   # → { "data": { "joinCode": "…", "template": { "workspaceId": "…" } } }
   ```

   Alternatively curate any workspace (e.g. one with All-Time-Classics content applied).
3. Edit recipes, cards, the guest menu etc. in that workspace. Keep English translations complete (Settings → content
   languages `de` + `en`) and keep `published` guest menus published. Calculations need a user and are therefore not
   copied into memberless template workspaces (database copy, clone): re-create the calculation before pulling.
   Demos of the built-in template read the repo files, so they always contain it.
4. Write it back into the repo (bumps `version`, rewrites `backup.json` and `images/`):

   ```bash
   DATABASE_URL=… pnpm templates:pull <workspaceId> demo --kind DEMO
   ```

5. Review the diff (only demo content, no personal data; `images/` are content-addressed), adjust `manifest.json` if
   needed, commit. The next start of every instance replaces the database copy of the built-in `demo` template.
6. Delete the editing template again: `DELETE /api/admin/templates/demo-edit` (master key).
