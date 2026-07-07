# Task: Migrate the Cocktails **GET** path to the v1 API (Variante 1)

> Status: **Phase 1 done** (v1 DTO extensions, merged & non‑breaking). **Phase 2 open** (frontend
> data‑flow redesign). This is the one remaining piece of the `/api/v1` frontend migration; every
> other domain is already on v1. Do Phase 2 on its own branch/PR with **manual click‑testing**.

## Why this is its own task
`GET /cocktails` (list) intentionally returns the **slim `CocktailSummaryDto`** (no
steps/garnishes/ratings), while `GET /cocktails/{id}` returns the **full `CocktailDto`**. The old
frontend fetches **full recipes in lists/search** and renders them directly. So migrating is a
**data‑flow redesign** (lists = summaries, details lazy‑loaded on demand), not a mechanical URL swap.

### The blocker that stopped the first attempt (read before starting)
`calcCocktailTotalPrice(cocktail, ingredients)` in `lib/CocktailRecipeCalculation.ts` is called with
**three incompatible cocktail shapes**:
1. `CocktailDto` — from `CocktailDetailModal` (after migration),
2. the **Prisma** calc‑item cocktail — `pages/.../manage/calculations/[id].tsx:~859` (`cocktail.cocktail`),
3. the **edit‑form values** cast — `components/cocktails/CocktailRecipeForm.tsx:~1038`
   (`values as unknown as CocktailRecipeFull`).

It reads `stepIngredient.ingredientId` / `stepIngredient.unitId` (Prisma) and
`stepIngredient.ingredient?.price` — but the DTO uses `ingredient.id` / `unit.id` and its embedded
ingredient ref has **no `price`**. A careless migration = **silently wrong cocktail prices**. This
function must be refactored first, deliberately, with price verification.

## Phase 1 — DONE (already merged, non‑breaking)
Extended the v1 DTOs so the compact list/search/detail views have the fields they need:
- `lib/schemas/cocktails.ts`: `CocktailGlassRef` += `deposit`, `hasImage`; `CocktailSummary` += `description`.
- `lib/api/dto/cocktails.ts`: mapper fills `deposit`/`hasImage`/`description` (glass `hasImage` from `_count.GlassImage`).
- `lib/api/controllers/cocktails.ts`: glass include now `{ include: { _count: { select: { GlassImage: true } } } }`.
- Spec regenerated + docs synced; drift guard green. `GET /cocktails` already supports server‑side `?search=`.

## Phase 2 — TODO (frontend redesign)

### Step 0 — Refactor the shared price function (do this first)
Make `calcCocktailTotalPrice` accept a **minimal shared interface** instead of `CocktailRecipeFull`,
so all three callers work:
```ts
interface PriceCalcCocktail {
  steps: { ingredients: { amount: number | null; ingredientId?: string; unitId?: string;
                          ingredient?: { id: string } | null; unit?: { id: string } | null }[] }[];
  garnishes: { garnish?: { id: string } | null; isAlternative?: boolean; optional?: boolean; garnishId?: string }[];
}
```
- Resolve ingredient id via `stepIngredient.ingredientId ?? stepIngredient.ingredient?.id`, unit id via
  `stepIngredient.unitId ?? stepIngredient.unit?.id`.
- Source ingredient **price** from the `ingredients: IngredientModel[]` param
  (`ingredients.find(i => i.id === ingredientId)?.price`), NOT from the embedded ref.
- Verify prices are **identical** before/after for a few known cocktails (manual, in the running app).

### Step 1 — Network helper (`lib/network/cocktails.ts`)
- `fetchCocktail` → `CocktailDto` from `/api/v1/workspaces/{ws}/cocktails/{id}`.
- `fetchCocktails` → `CocktailSummaryDto[]` from `/api/v1/workspaces/{ws}/cocktails?search=`.
- `prefetchAllCocktails` → summaries from v1.
- **Keep `fetchCocktailWithImage` on OLD** (`/api/workspaces/.../cocktails/{id}?include=image`) — the v1
  item DTO omits the base64 `CocktailRecipeImage` bytes the crop editor needs.

### Step 2 — Detail consumers → `CocktailDto`
`components/modals/CocktailDetailModal.tsx`, `components/cocktails/CocktailRecipeCardItem.tsx`.
Field mappings: `_count.CocktailRecipeImage`→`hasImage`; `glass._count.GlassImage`→`glass.hasImage`;
`garnish._count.GarnishImage`→`garnish.hasImage`; `ingredient._count.IngredientImage`→`ingredient.hasImage`;
`ratings[]` (avg) → `averageRating`/`ratingCount`; image `src` → `imageUrl` (or the v1 image URL built
from router `workspaceId` + id); `steps[].ingredients[].ingredientId/unitId` → `.ingredient.id/.unit.id`.

### Step 3 — `CompactCocktailRecipeInstruction` → `CocktailDto`
Replace `props.cocktailRecipe.workspaceId` (DTO drops it) with the router `workspaceId`; `glass._count`
→ `glass.hasImage`; `_count.CocktailRecipeImage` → `hasImage`. `showRating` already comes in as a
separate prop (decoupled) — keep.

### Step 4 — List/search consumers → `CocktailSummaryDto`
`components/order/OrderView.tsx`, `components/order/CompactCocktailCard.tsx`
(`glass.deposit` now exists), `components/modals/SearchModal.tsx`,
`components/search/SearchResultRow.tsx`, `pages/.../manage/cocktails/index.tsx`
(the garnishes column needs a decision: drop it, or lazy‑load full on expand).
OrderView client filter can use `name`/`tags`/`description` (all in the extended summary) or switch to
the server `?search=`.

### Step 5 — Decouple cards/calc (keep them on OLD, unchanged)
`CocktailRecipeCardItem` already accepts `CocktailDto | string` and **lazy‑loads by id**. So card and
order renderers should pass the cocktail **id** (from their old‑API data), not a full Prisma object —
then they need no cocktail‑shape migration. Verify each `CocktailRecipeCardItem`/`CompactCocktailCard`
call site passes an id or a `CocktailDto`, never a raw `CocktailRecipeFull`.

### Step 6 — Offline cache
`fetchWithCache`/`fetchListWithCache` store `storeName: 'cocktails'`. After the shape change, old
Prisma‑shaped cache entries are stale — bump a cache version / clear the `cocktails` store on first
load after deploy, or entries self‑heal on next network fetch (acceptable but note it).

## Verification checklist (must click‑test with a real login)
- [ ] `pnpm exec tsc --noEmit` = 0 errors; `pnpm test` green; `pnpm openapi:generate` + docs sync, drift guard green.
- [ ] Prices: a few known cocktails show the **same** computed price as before (detail modal, calc page, edit‑form live preview).
- [ ] Order view: search, add to order, deposit ("Glas zurück"), glass images render.
- [ ] Cocktail detail modal: image, glass/ice, steps + ingredients, garnishes, rating average, PDF export.
- [ ] Cards page + card editor render cocktails (lazy‑loaded), no console field errors.
- [ ] Manage → cocktails list renders; edit still loads the image (old `fetchCocktailWithImage`).
- [ ] Offline: cache behaves (or is cleared) after the shape change.

## Out of scope (stays on OLD — no clean v1 path)
Cocktail **edit** load (base64), card **reads** (`CardSummaryDto`/`CardDto` reshape), monitor/signage
(base64 `content`→`imageUrl`), audit‑log modal (v1 DTO omits `changes`/`snapshot`), and the no‑v1
endpoints (actions, api‑keys, join‑codes, admin/translation, backups). See
`~/.claude/.../memory/v1-frontend-migration-state.md` for the full map.
