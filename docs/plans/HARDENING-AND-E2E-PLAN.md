# Plan: Backend-Hardening, Transaktionen, Warnings & E2E-Release-Gate

Stand: 2026-11-12 · Branch `chore/backend-hardening` · Status: **P0–P4 umgesetzt**, P5–P8 offen

> **Umsetzungsstand P0–P4** (Details: [`docs/API-REVIEW.md`](../API-REVIEW.md), [`docs/BACKEND-CONVENTIONS.md`](../BACKEND-CONVENTIONS.md), [`docs/TESTING.md`](../TESTING.md))
>
> - Entscheidungen: Legacy-API **entfernt** (statt Adapter), Importe **alles oder nichts**.
> - P0: alle kritischen Funde C1–C6 sowie H4/H5 behoben, jeweils mit Regressionstest.
> - P1: Bausteine (`lib/api/scope.ts`, `lib/db/tx.ts`, `lib/http/prismaErrors.ts`, `lib/http/safeFetch.ts`, `lib/images/*`), `/api/health` mit Version/Commit, `/api/health/ready`, globale Security-Header.
> - P2: `pages/api/workspaces/**` und `/api/users/settings` gelöscht, OpenAPI nur noch `/api/v1`.
> - P3: alle Gruppen reviewt und gehärtet; Migration `20261112120000_harden_references` (Bereinigung Cross-Workspace-Referenzen, Indizes, CHECK). Abweichung zum Plan: kein `Restrict`/`NoAction`-FK für Zutaten/Gläser (bricht Workspace-Kaskaden), stattdessen Row-Lock in der App; kein partieller Unique-Index für Default-Gästekarten (nicht in Prisma modellierbar).
> - P4: 314 Integrationstests, generische Mandanten-Isolations-Suite, vollständige Auth-Matrix, Coverage-Gate in CI (177/180, Rest = Chromium-PDF).

Ziel: das Projekt auf eine stabilere Basis heben.

1. Alle API-Endpunkte sind geprüft und gehärtet: AuthZ, Workspace-Isolation, Validierung, Fehler, Limits.
2. Überall, wo mehrere Schreibzugriffe zusammengehören, gibt es korrekte Transaktionen bzw. atomare SQL.
3. Es gibt keine Lint-/Build-Warnings mehr, und neue werden in der CI verhindert.
4. Ein vollständiges E2E-Testing läuft gegen eine echte laufende Instanz (Upgrade-Umgebung + Staging), und das **wöchentliche Release wird nur veröffentlicht, wenn es grün ist**.

---

## 0. Ausgangslage (Ist-Analyse)

### 0.1 Zahlen

| Bereich | Befund |
| --- | --- |
| API-Routen | 244 Dateien: ~96 Legacy (`pages/api/workspaces/**`), ~125 v1 (`pages/api/v1/**`), Rest public/admin/demo/scraper/auth |
| Frontend → API | nutzt **ausschließlich `/api/v1`** (311 Aufrufe, 0 Legacy). Legacy wird nur noch von externen API-Clients genutzt. |
| Legacy vs. v1 | v1 = dünne Wrapper → `lib/api/controllers/*`. **Legacy = 96 eigenständige Kopien** mit eigener Prisma-Logik. Bugfixes in den Controllern erreichen Legacy nicht. Umgekehrt importiert v1 teils Legacy (`backups`, `join`, `updateTranslation`, `regenerateUnitConversions`). |
| Transaktionen | Controller: 38 mit `$transaction`, 62 ohne (davon ~25 problematisch). Legacy: 33 mit, ~45 ohne. **Kein** Isolation-Level, kein Lock, kein `maxWait` im ganzen Projekt. |
| ESLint | **195 Warnings**, 0 Errors: `react-hooks/refs` 78 (76 davon in `CocktailRecipeForm.tsx`), `set-state-in-effect` 55, `exhaustive-deps` 43, `immutability` 14 (13× `X.pullToRefresh = …`), `no-img-element` 3, `alt-text` 1, `unused-vars` 1 |
| Build / tsc / Unit-Tests | Build ohne Warnings, `tsc` sauber, 508 Unit-Tests grün |
| Integration-Tests | 6 Dateien (~660 Zeilen): Auth-Matrix (Stichprobe!), Glasses, Ingredients, Cocktails, Queue/Stats, WorkspaceAdmin. **Keine Cross-Workspace-Tests.** |
| E2E | Branch `feat/e2e` (`55584d5`, 26.10.): Harness `tester-army/e2e` (LLM-Replay-Cache), 11 Journeys, Gate-Seed mit 4 Rollen-Personas, `CAPABILITIES.md`-Matrix, Nightly-Workflow. Nicht gemergt; berührt auch ~25 UI-Dateien. In `main` ist Playwright nur für Screenshots in Benutzung. |
| Release | `release-drafter` → manuelles „Publish“ → `release.yml` baut **neu** aus dem Tag und pusht `latest`. Staging-Image (`staging-<sha>`) wird bei Push auf main + nightly gebaut. **Kein Test-Gate.** |
| Health | `/api/health` liefert nur `{status:'ok'}`: keine DB-Prüfung, keine Version, kein Migrationsstatus |

### 0.2 Kritische Funde (bestätigt durch Code-Review)

| # | Fund | Ort (Beispiele) |
| --- | --- | --- |
| C1 | **IDOR bei Update**: `update({ where:{id}, data:{ workspace:{connect:{id: ws}} } })` ohne Ownership-Check. Ein Manager aus Workspace A kann Glas/Garnitur/Zutat aus B überschreiben **und in A verschieben**. | `lib/api/controllers/glasses.ts:58`, `garnishes.ts:64`, `ingredients.ts:94` + Legacy-PUTs (Ingredient nimmt sogar `req.body.id`) |
| C2 | **IDOR Calculations**: `updateCalculation` löscht Items fremder Kalkulationen (Rolle USER genügt) | `calculations.ts:108-161` + Legacy |
| C3 | **Import-Overwrite**: `existingId` / `overwriteId` aus dem Client nicht gescoped. Fremde Cocktails werden gelöscht und im eigenen Workspace neu angelegt. | `cocktailsPorting.tsx:991`, `glasses.ts:243`, `garnishes.ts:246`, `ingredients.ts:428`, `calculations.ts:566` + Legacy |
| C4 | **SSRF**: `url.includes('conalco.de')` → `http://169.254.169.254/?conalco.de` wird durchgelassen, das Ergebnis kommt base64-kodiert zurück. `scraper/image` holt beliebige URLs. | `pages/api/scraper/ingredient.tsx:21`, `scraper/image.tsx:13` |
| C5 | **Stored/Reflected XSS über Bilder**: der Content-Type kommt aus der Data-URI bzw. vom Upstream (SVG/HTML auf App-Domain); Bilder sind ein unvalidierter `z.string()`, und es gibt kein `nosniff` | Image-Handler aller Entitäten, `scraper/image.tsx` |
| C6 | **Cookie-Logging**: bei jedem fehlgeschlagenen Login landen Session-Cookies im Log | `middleware/api/authenticationMiddleware.tsx:86` |
| H1 | Imports: try/catch **pro Item innerhalb** einer interaktiven Postgres-Tx. Nach dem ersten Fehler ist die Tx abgebrochen, der Commit wird zum Rollback, die Response meldet trotzdem Erfolg. | alle `*/import/json` |
| H2 | `signage.updateSignage`: `$transaction(async () => …)` ignoriert `tx` und schreibt über das globale `prisma` | `signage.ts:78`, Legacy `admin/signage.tsx:108` |
| H3 | Race: Queue-Item verbrauchen + Statistik anlegen ohne Tx, Join-Code `used + 1` (Read-Modify-Write), Unit-Conversion-Regeneration ohne Tx | `statistics.ts:115`, `join.ts:55`, `units.ts:104` |
| H4 | Rollen-Eskalation: ADMIN (oder API-Key mit `USERS_UPDATE`) kann zum OWNER befördern bzw. den letzten OWNER entfernen | `workspaceUsers.ts:23-56` |
| H5 | PDF-Export: Cocktailname unescaped in einer Chromium-Seite mit JS und Netzwerk; Anzahl der IDs unbegrenzt | `cocktailsPorting.tsx:300`, Legacy `export-pdf.tsx` |
| H6 | Ratings, Queue-PUT, Card-(Un)archive ohne Workspace-Scope; Fremd-IDs in Bodies (`glassId`, `ingredientId`, …) nie geprüft. Folge: Datenleck über Export/DTO. | `ratings.ts:12`, diverse |

Die vollständigen Fund-Tabellen beider Audits sind in Anhang A und B zusammengefasst.

---

## 1. Leitprinzipien

1. **Security zuerst und getrennt releasen.** Die kritischen Funde (C1–C6) kommen als eigener Patch-Release vor dem Rest, jeweils mit Regressionstest.
2. **Eine Implementierung pro Endpunkt.** Legacy wird zum dünnen Adapter auf die v1-Controller. Damit verschwinden ~96 Kopien samt ihrer Bugs.
3. **Sicherheit über Bausteine, nicht über Disziplin.** Zentrale Helfer (`scoped*`, `assertIdsInWorkspace`, `safeFetch`, `imageSchema`, Prisma-Error-Mapping, `withWorkspaceLock`), und Tests, die über **alle** OpenAPI-Operationen laufen, damit neue Endpunkte automatisch abgedeckt sind.
4. **Was getestet wurde, wird ausgeliefert.** Das Release-Image wird einmal gebaut, getestet und dann nur noch umgetaggt.
5. **Ratchet.** Jede Phase endet mit einem CI-Gate (z. B. `--max-warnings 0`, Coverage-Matrix), damit der erreichte Stand bleibt.
6. **Kleine PRs.** Pro Endpunktgruppe bzw. Thema ein PR mit Conventional-Commit-Titel und Tests im selben PR.

---

## 2. Phasenübersicht

| Phase | Inhalt | Ergebnis / Gate | Grobe Größe |
| --- | --- | --- | --- |
| **P0** | Security-Hotfixes C1–C6 + Regressionstests | Patch-Release 1.21.4 | 2–3 PRs |
| **P1** | Fundament: Helfer, Error-Mapping, Tx-Konventionen, Health/Ready | Bausteine + Doku `docs/BACKEND-CONVENTIONS.md` | 2 PRs |
| **P2** | Legacy-Konsolidierung (Legacy → v1-Adapter), v1 ↔ Legacy entflechten | 0 Prisma-Aufrufe unter `pages/api/workspaces/**` | 4–6 PRs |
| **P3** | Endpunkt-Review gruppenweise (Checkliste) inkl. Transaktionen | Review-Matrix vollständig ✅ | ~12 PRs |
| **P4** | Integrationstests ausbauen (Cross-Workspace-Suite, volle Auth-Matrix) | Coverage-Gate über OpenAPI | parallel zu P3 |
| **P5** | Warnings auf 0, `--max-warnings 0` | Lint-Gate | 3–4 PRs, parallel |
| **P6** | E2E-Suite (Playwright) gegen echte Instanz, Port von `feat/e2e` | Suite grün gegen lokale Docker-Instanz | 5–8 PRs |
| **P7** | Upgrade-/Migrationstest + Staging-Deploy + Release-Gate | Wöchentliches Release nur bei grünem Gate | 3 PRs |
| **P8** | Verstetigung: DoD, PR-Template, Doku, Nightly | dauerhaft | laufend |

Abhängigkeiten: P0 → P1 → (P2 ∥ P5) → P3/P4 → P6 → P7. P5 kann sofort parallel starten, und die E2E-Infrastruktur (P6-Grundgerüst) kann ab P1 parallel beginnen.

---

## 3. Phase 0: Security-Hotfixes (sofort)

Jede Korrektur bekommt einen Integrationstest „Workspace A greift auf Entität von B zu → 404, B unverändert“.

| Fix | Umsetzung |
| --- | --- |
| C1/C2 Update-IDOR | In `glasses/garnishes/ingredients/calculations/cocktails`-Controllern zuerst `findFirst({ where:{ id, workspaceId } })` → `ApiError(404)`; Update mit `where:{ id, workspaceId }` (bzw. vorher gescoped geprüft); `workspace: { connect }` aus Updates entfernen; Kind-Deletes gescoped. Legacy-PUTs (Glass, Garnish, Ingredient, Cocktail, Calculation, Cards, Queue-Item, Card-(Un)archive) **sofort** auf die Controller umleiten (Vorgriff auf P2). |
| C3 Import-Overwrite | `existingId`/`overwriteId` gegen den Workspace prüfen; sonst schlägt das Item fehl. Fremd-IDs bei „use existing“ ebenso prüfen. |
| C4 SSRF | Neues `lib/http/safeFetch.ts`: nur `https`, exakte Host-Allowlist pro Scraper (`conalco.de`, `www.conalco.de`, `metro.de` …), DNS-Auflösung mit Private-/Link-local-/Loopback-Block (Logik aus `lib/guest-menu/workspaceImage.server.ts` wiederverwenden), Redirects manuell und erneut prüfen, Timeout (10 s), max. Größe (5 MB). `scraper/image`: nur Raster-MIME (`png/jpeg/webp/gif`), `X-Content-Type-Options: nosniff`, Rate-Limit. Puppeteer-Seiten mit `try/finally` schließen. |
| C5 Bild-XSS | Gemeinsames `imageDataUriSchema` (Regex `^data:image/(png|jpeg|webp|gif);base64,` + Max-Größe) für alle Schemas inkl. Backup-Import; Auslieferung über `decodeImage()` mit MIME-Allowlist; `nosniff` + `Content-Security-Policy: default-src 'none'; sandbox` auf Bild-Responses. Bestehende Daten: einmaliges Prüfskript, das Nicht-Raster-Bilder meldet. |
| C6 | `console.log` mit Cookies entfernen; allgemein keine Header/Cookies loggen (Grep-Check in CI: `req.headers.cookie` in `console.*`). |
| H4 (vorgezogen, klein) | Nur ein OWNER darf OWNER vergeben oder entziehen; der letzte OWNER kann nicht entfernt oder herabgestuft werden; in einer Serializable-Tx. |
| H5 (vorgezogen, klein) | Cocktailnamen im PDF-HTML escapen, `cocktailIds.max(200)`, auf `renderHtmlToPdf`/`lockDownPage` umstellen (wie bei Guest-Menüs). |

**Ergebnis:** Patch-Release, Changelog-Eintrag „Security“. Gegebenenfalls ein GitHub Security Advisory, falls öffentliche Instanzen betroffen sind (`SECURITY.md`).

---

## 4. Phase 1: Fundament (Bausteine & Konventionen)

### 4.1 Zentrale Helfer (`lib/api/`)

| Helfer | Zweck |
| --- | --- |
| `findInWorkspaceOrThrow(model, id, workspaceId, tx?)` | Standard-Lookup → 404, ersetzt `findUnique({where:{id}})` |
| `assertIdsInWorkspace(tx, { glassIds, ingredientIds, unitIds, … }, workspaceId)` | Prüft alle Fremdschlüssel aus Request-Bodies in einem Rutsch → 400/404 |
| `mapPrismaError(e)` | `P2025→404`, `P2002→409`, `P2003→409`, sonst 500 ohne Details. Eingebaut in `withValidation` **und** `withHttpMethods`. |
| `withHttpMethods`-Fix | `return await handler()` (heute fängt das try/catch nichts ab) |
| `withWorkspaceLock(tx, workspaceId, scope)` | `SELECT pg_advisory_xact_lock(hashtext($1 \|\| $2))`, für Reihenfolgen (`order`/`priority`), Default-Flags, Unit-Regeneration, Übersetzungs-JSON |
| `runTx(fn, opts)` | Dünner Wrapper um `prisma.$transaction` mit Default-`timeout`/`maxWait`, optional `isolationLevel` und Retry bei `P2034`/Serialization-Failure (für Serializable) |
| `afterCommit` | Konvention: Side-Effects (Mail, Cache-Invalidierung, HTTP, Dateisystem) **nach** der Tx. `res.json` nie innerhalb des Tx-Callbacks. |
| `createLog(tx, …)` | Audit immer mit dem `tx`-Client der Änderung; für Master-Key-/Systemaufrufe nullable `userId` statt Fake-User (heute 500 bei auditierten Writes mit Master-Key) |
| `safeFetch` / `imageDataUriSchema` | aus P0 |

### 4.2 Transaktions-Konventionen (Doku `docs/BACKEND-CONVENTIONS.md`)

- **Wann eine Tx nötig ist:** mehr als ein Write, Read-then-Write mit Korrektheitsabhängigkeit (Unique-Prüfung, Zähler, `max(order)+1`, „löschen und neu anlegen“), Entity-Write plus Audit-Log, Entity-Write plus Übersetzung.
- **Wann keine nötig ist:** einzelner Write, reine Reads (Ausnahme Backup-Export → `RepeatableRead` für einen konsistenten Snapshot).
- **Zähler/Kontingente:** atomar per `updateMany({ where:{…, used: {lt: max}}, data:{ used:{increment:1} } })` und `count` prüfen, statt Read-Modify-Write.
- **Queue-Konsum:** `DELETE … WHERE id = (SELECT id … ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`.
- **Imports:** erst vollständig validieren (Dry-Run ist schon vorhanden), dann **alles oder nichts** in einer Tx mit `timeout`; kein try/catch pro Item innerhalb der Tx (alternativ ein Savepoint pro Item, falls Teilimporte gewollt sind; das wäre eine Produktentscheidung).
- **Lange Tx:** Parsing/Validierung vor die Tx ziehen; kein `Promise.all` auf dem `tx`-Client.
- **Lint-Unterstützung:** eigene ESLint-Regel bzw. ein `no-restricted-syntax`-Check gegen `prisma.` innerhalb von `$transaction(async (tx) => …)`-Callbacks und gegen `res.` innerhalb dieser Callbacks.

### 4.3 Health & Readiness (Voraussetzung für E2E/Release-Gate)

- `/api/health` bleibt leichtgewichtig (Docker-Healthcheck), liefert zusätzlich `version` und `commit` (Build-Arg `GIT_SHA`).
- Neu `/api/health/ready`: DB-Ping, `_prisma_migrations` ohne failed/pending (Vergleich mit den mitgelieferten Migrationsverzeichnissen), Chromium-Service erreichbar (optional, als `degraded`). Das E2E wartet darauf und prüft, dass `commit` dem Kandidaten entspricht.

### 4.4 Globale Security-Header

`next.config.mjs` → `headers()`: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors` (Signage/Guest-Menu-Ausnahmen beachten), Basis-CSP für `/api/*`. CSP für Seiten erst im Report-Only-Modus einführen und über E2E-Läufe beobachten.

---

## 5. Phase 2: Legacy-Konsolidierung

**Befund:** Das Frontend nutzt Legacy nicht mehr. Legacy existiert nur für externe API-Clients und enthält die meisten Bugs doppelt.

1. **v1 von Legacy entkoppeln:** `updateTranslation`, `regenerateUnitConversions` (zweimal vorhanden), Backup Export/Import und `workspaces/join` nach `lib/api/controllers/*` verschieben; `admin/*` und `demo/*` nutzen die Controller. `backupStructure.ts` aus `pages/api` nach `lib/backup` verschieben (heute eine Route ohne Handler).
2. **Legacy → Adapter:** jede Legacy-Datei wird `withDeprecation({ successor, sunset }, legacyAdapter(v1Handler))`. Wo sich das Antwortformat unterscheidet, wird ein kleiner Mapper ergänzt. Ein Contract-Test pro Gruppe stellt sicher, dass Legacy-Antworten kompatibel bleiben (Snapshot gegen den alten Stand vor der Umstellung).
3. **Sunset ankündigen:** `Sunset`-Header setzen (Vorschlag: 6 Monate), README/Changelog-Hinweis, Nutzung loggen (Zähler pro Legacy-Route), nach Ablauf entfernen.
4. **Ergebnis-Gate:** CI-Check, dass unter `pages/api/workspaces/**` kein `prisma` importiert wird.

Reihenfolge der Gruppen: zuerst die mit kritischen Funden (Glasses, Garnishes, Ingredients, Cocktails, Calculations, Cards, Queue, Ratings), dann der Rest.

---

## 6. Phase 3: Endpunkt-Review (gruppenweise, mit Transaktionen)

### 6.1 Checkliste pro Endpunkt

Für jede Operation (Quelle: OpenAPI-Registry `lib/openapi` + Nicht-v1-Routen) wird in `docs/API-REVIEW.md` abgehakt:

| # | Prüfpunkt |
| --- | --- |
| 1 | **AuthN**: korrekter Wrapper (Session / API-Key / Master / Public), bewusst dokumentiert |
| 2 | **AuthZ**: Rolle **und** API-Key-Scope passen zur Operation (Write ≠ Read-Scope) |
| 3 | **Tenant-Scope**: jede ID aus Pfad **und** Body ist gegen `workspaceId` geprüft |
| 4 | **Validierung**: zod für Body/Query; Längen-, Zahlen- und Array-Limits (`limit.max`, `amount.max`, `ids.max`, `rating 1–5`) |
| 5 | **Transaktion** gemäß Konvention 4.2; Audit-Log in der Tx; Side-Effects nach Commit |
| 6 | **Fehler**: Prisma-Errors gemappt, keine `error.message` / Stacks in Responses, 405 bei falscher Methode |
| 7 | **Limits**: Body-Size passend (Bilder vs. Import), Rate-Limit bei öffentlichen bzw. teuren Endpunkten |
| 8 | **Output**: keine fremden oder sensiblen Felder (z. B. Access-Code-Hashes, Tokens) |
| 9 | **Audit**: zustandsändernde Operationen erzeugen einen Audit-Eintrag (heute fehlt das bei Cards, Clones, Signage, Tags, Settings, Members, API-Keys, Join-Codes, Backup-Import) |
| 10 | **Test**: Integrationstest Happy-Path + Cross-Workspace + Rollen; E2E-Abdeckung in der Capability-Matrix eingetragen |

### 6.2 Gruppen und bekannte Punkte

| Gruppe | Bekannte Punkte (zusätzlich zur Checkliste) |
| --- | --- |
| Glasses / Garnishes / Ingredients | C1, C3; In-Use-Check vor dem Delete in die Tx (Ingredient: FK ist `Cascade`, im Race werden Rezeptzeilen still gelöscht → Lock oder FK auf `Restrict`); Clone ohne Audit |
| Cocktails | Step-/Ingredient-IDs aus dem Body müssen zum Cocktail gehören; Fremd-IDs für Glas/Eis/Garnitur/Einheit; PDF-Export (H5); JSON-Export ohne `COCKTAILS_READ`-Scope; Import nur MANAGER; Archive/Availability ohne Audit |
| Cocktail-Import (Porting) | H1 (alles oder nichts), C3, Tx-Timeout, Übersetzungen mit Lock mergen |
| Calculations (+ Groups, Import) | C2, C3; Import braucht einen Write-Scope; Group-Check-then-Write → `updateMany` mit Count; Overwrite-Audit mit echten Altdaten |
| Cards | Legacy-PUT/DELETE ohne Tx (Datenverlust möglich) → Controller; Audit ergänzen |
| Queue | Atomarer Konsum (`SKIP LOCKED`); `amount.max`; `createMany`; Cocktail-ID prüfen |
| Statistics (+ Advanced, Sets) | Queue-Konsum + Statistik in einer Tx; `limit.max`; Saved-Sets brauchen einen Write-Scope; Master-Key-User-FK |
| Ratings | Workspace-Scope über `cocktail.workspaceId`; Wertebereich |
| Units / Conversions / Ice / Actions / Translations | `regenerateUnitConversions` in Tx + Advisory-Lock; Entity + Übersetzung in einer Tx; `updateTranslation` per Lock oder jsonb-Merge |
| Tags | `max(order)+1` mit Lock; Default-Kategorien idempotent (Unique-Constraint) |
| Guest Menus (+ Templates, Export, QR, Public) | Audit in der Tx (heute außerhalb, Fehler werden verschluckt); Slug/Priority-Race (P2002→409, Lock); `isDefault` als partieller Unique-Index; Publish mit optimistischem Lock (`updatedAt`). Rendering ist schon gut gehärtet (Liquid `ownPropertyOnly`, DOMPurify, lockDown). |
| Signage (+ Key, Slides, Public) | H2; `order` mit Lock; Exclusive-Overlap-Check in der Tx; Public `includeInactive` nur mit Key; Rate-Limit |
| Workspace / Settings / Users / Leave | H4; Name-Validierung; `JSON.parse(req.body)` in Legacy |
| Join-Codes / Join / Join-Requests | Atomarer Zähler; Codes serverseitig erzeugen (≥ 8 zufällige Zeichen); P2002→409; Rate-Limit auf `join` |
| API-Keys / Auth-Middleware | Permissions aus der DB statt aus dem JWT (bzw. Ersteller noch ADMIN+?); Cache **nach** dem Delete invalidieren; Master-Key-Vergleich per Hash + `timingSafeEqual`; Rate-Limit bei Fehlversuchen |
| Backups | Export in `RepeatableRead`-Tx; Import: Methoden-Check, zod-Schema, Parsing vor der Tx, sequentielle Queries, `maxWait`, Slide-Order, Audit, realistisches Body-Limit |
| Audit-Logs | `limit.max` |
| Demo | `demo-login` nur mit signiertem Einmal-Token; `create-workspace` in Tx + Rate-Limit; `cleanup` nur per Secret; generische Fehlermeldungen; verwaiste Demo-User |
| Admin / Master-Key | Writes mit Master-Key ohne Fake-User; Workspace-Erzeugung über `createWorkspaceWithDefaults` |
| Scraper | C4, 405 statt 404, Puppeteer-Ressourcen |
| Public (Menus, Images), Health, Config | Rate-Limits, die heute nur in-memory und pro Prozess gelten, dokumentieren bzw. optional über einen geteilten Store; `chromium-status` ohne interne Details |
| `users/*`, `v1/me` | `withHttpMethods` (akzeptieren heute jede Methode), zod |
| Auth (`[...all]`, better-auth) | Konfig-Review: Cookie-Flags, Trusted Origins, Session-Dauer; OIDC-Gruppen-Mapping (`lib/auth.ts:173`) als `upsert` in Tx |

### 6.3 Datenbank-Ebene

- Fehlende Constraints als Migration ergänzen: partieller Unique-Index „ein Default-Guest-Menu pro Workspace“, Unique auf Default-Tag-Kategorien, ggf. `CHECK` für Ratings.
- `onDelete`-Verhalten prüfen (Ingredient → RecipeIngredient `Cascade` ist gefährlich).
- Migrationen müssen **vor** dem Ausrollen gegen reale Daten laufen. Das deckt der Upgrade-Test in Phase 7 ab.

---

## 7. Phase 4: Integrationstests ausbauen (API-Ebene, Vitest + Postgres)

1. **Cross-Workspace-Suite (generisch):** über alle OpenAPI-Operationen mit Pfad-IDs iterieren, Entität in Workspace B seeden, als A (Session **und** API-Key) aufrufen → 404 erwarten **und** prüfen, dass B unverändert ist (Snapshot vorher/nachher). Für Body-IDs eine deklarative Liste pro Operation (`foreignKeyFields`).
2. **Auth-Matrix vollständig** statt Stichprobe (heute erste 20/10/10/5 Operationen): Rolle × Scope × Operation, erwartete Codes aus den Schema-Metadaten.
3. **Fehlende Gruppen** (siehe Anhang B, Coverage): Garnishes, Ice, Cards, Calculations, Ratings, Actions, Units, Tags, Translations, Guest-Info, Guest-Menus, Signage, Statistics-Advanced, Audit-Logs, Settings, Join/Leave, `/me`, Admin, Demo, Public.
4. **Race-Tests** für die neuen Locks: parallele Requests (z. B. 20× Join mit Einmal-Code, 2× Queue-Konsum, 10× Slide anlegen) → Invarianten prüfen.
5. **Import-Atomarität:** ein ungültiges Item mitten im Import → nichts geschrieben, Response = Fehler.
6. **Coverage-Gate:** Test schlägt fehl, wenn eine OpenAPI-Operation weder in Integration noch in E2E referenziert ist (Ausnahmen explizit in einer Allowlist).

---

## 8. Phase 5: Warnings entfernen

| Kategorie | Anzahl | Vorgehen |
| --- | --- | --- |
| `react-hooks/refs` | 78 (76 in `CocktailRecipeForm.tsx`) | Gezielter Refactor des Formulars: Ref-Zugriffe während des Renders entfernen (Werte in State/`useMemo` bzw. Zugriff nur in Effekten/Handlern). Eigener PR mit Browser-E2E für das Cocktail-Formular **vorher** (Sicherheitsnetz). |
| `react-hooks/immutability` | 14 (13× `Page.pullToRefresh = …`) | Ersetzen durch einen Hook `usePullToRefresh(handler)` mit Registrierung über Context im Layout. Ein mechanischer PR. |
| `react-hooks/set-state-in-effect` | 55 | Datenladen in einen gemeinsamen Hook `useApiResource(url, deps)` (Laden, Abbruch, Fehler, Refresh) bzw. in Event-Handler oder abgeleiteten State verschieben. Schwerpunkte: `manage/statistics` (12), `calculations/[id]` (6). |
| `react-hooks/exhaustive-deps` | 43 | Einzeln prüfen; fast immer echte Stale-Closure-Bugs → Deps ergänzen bzw. `useCallback`; kein pauschales Disable. |
| `@next/next/no-img-element`, `alt-text`, `unused-vars` | 5 | Data-URI-Bilder: bewusstes `eslint-disable-next-line` mit Begründung oder `next/image unoptimized`; `alt` ergänzen. |

**Gate:** `eslint . --max-warnings 0` in `pnpm lint` (CI) und in `lint-staged`. Zusätzlich:
- **Runtime-Warnings:** Die E2E-Suite sammelt Browser-`console.error`/`warning` sowie `pageerror` und schlägt bei neuen fehl (Allowlist für bekannte Drittanbieter-Meldungen). Serverseitig werden die Container-Logs im E2E-Lauf nach `Warning:`/`Error` gescannt und als Artefakt angehängt.
- Debug-`console.log`/`console.debug` in API-Routen entfernen (z. B. Scraper); ESLint `no-console` mit Ausnahme von `warn`/`error` für `pages/api` und `lib`.
- Vitest-Läufe ebenfalls warning-frei halten (heute bereits sauber).

---

## 9. Phase 6: E2E-Testing gegen eine echte Instanz

### 9.1 Werkzeug-Entscheidung

**Empfehlung: Playwright Test** (bereits Dependency, in CI für Screenshots im Einsatz) statt `tester-army/e2e` aus `feat/e2e`.

| Kriterium | Playwright | tester-army/e2e (`feat/e2e`) |
| --- | --- | --- |
| Reife, Debugging | Trace-Viewer, Video, HTML-Report, Retries, Sharding | jung (0.21), kleines Ökosystem |
| API-Tests im selben Runner | `request`-Fixture (API-E2E gegen dieselbe Instanz) | nein |
| Gegen Remote-URL | `baseURL`, kein lokaler Webserver nötig | auf lokalen Server ausgelegt |
| Determinismus | rein deterministisch | Replay-Cache für LLM-Aktionen, „strict-cache“ |

**Übernehmen aus `feat/e2e`:** Journeys (Inhalt/Abläufe von bartender, bartender-modes/settings, home-shell, manage-*, edges, smoke), Persona-Konzept (OWNER/ADMIN/MANAGER/USER), `docs/CAPABILITIES.md` + `capabilitiesMatrix.test.ts` (Abdeckungsregeln), `KNOWN-ISSUES.md`, Teile von `docs/TESTING.md`, `capabilitiesGap.integration.test.ts`. Die ~25 UI-Änderungen des Branches (z. B. `AuthBoundary`, `withPagePermission`, Test-IDs) einzeln prüfen und nur übernehmen, was nötig ist. **Nicht übernehmen:** direkten DB-Seed (funktioniert gegen Remote-Staging nicht), `.pnpm-store` im Repo.

### 9.2 Zielumgebungen

| Umgebung | Zweck | Daten | Blockiert |
| --- | --- | --- | --- |
| **E1: Lokal / CI-Ephemer** (`docker-compose.e2e.yaml`: Postgres + App-Image + Chromium-Service + Mock-OIDC + Mailpit) | Entwicklung der Tests, PR-Smoke, Upgrade-Test | wird pro Lauf frisch erzeugt | PRs (Smoke), Release (Upgrade) |
| **E2: Staging** (persistente Instanz, `staging-<sha>`) | „Echte“ Instanz: Reverse-Proxy, TLS, echte ENV, gewachsene Daten | Tests legen eigene Workspaces `e2e-<runId>-…` an und räumen auf; echte Daten bleiben unberührt | Release |

Die Suite ist **umgebungsagnostisch**: nur `E2E_BASE_URL` + Credentials. Kein direkter DB-Zugriff aus den Tests; alles Setup läuft über die API.

### 9.3 Authentifizierung gegen eine echte Instanz

Staging hat nur OAuth/OIDC. Vorschlag in zwei Stufen:

1. **E2E-Login-Endpoint** `POST /api/auth/e2e-login` (neu):
   - nur aktiv, wenn `E2E_LOGIN_SECRET` gesetzt ist (≥ 32 Zeichen); sonst 404. **Hart deaktiviert**, wenn `DEPLOYMENT=production`.
   - Header-Secret mit `timingSafeEqual`; legt nur User mit `@e2e.invalid`-E-Mails an bzw. loggt sie ein; erzeugt eine better-auth-Session (wie `demo-login`, aber sicher).
   - Rate-limitiert, jeder Aufruf geloggt.
   - Ergebnis: Persona-Sessions als Playwright-`storageState` (Setup-Projekt).
2. **Echter Login-Flow einmal pro Lauf** in E1 über einen Mock-OIDC-Server (`navikt/mock-oauth2-server` als `CUSTOM_OIDC_*`): testet Callback, Session-Cookie, OIDC-Gruppen-Mapping und `EXTERNAL_WORKSPACE_MANAGEMENT`.

API-Tests nutzen zusätzlich per API erzeugte Workspace-API-Keys (testet Scopes) und den Master-Key (nur E1).

### 9.4 Struktur

```
e2e/
  playwright.config.ts        # projects: setup, api, chromium, mobile, upgrade-verify
  fixtures/                   # personas, workspace-per-test, apiClient (typisiert aus OpenAPI), consoleGuard
  seed/                       # API-basierter Seed (versioniert, idempotent): alle Entitätstypen inkl. Edge-Cases
  api/                        # API-E2E: Contract gegen openapi.json für jede Operation
  journeys/                   # Browser-Journeys (aus feat/e2e portiert + neu)
  upgrade/                    # Vorher/Nachher-Verifikation für Migrationen
  smoke/                      # @smoke-Tag, < 3 min
```

- **Isolation:** Jede Testdatei bzw. jeder Worker bekommt einen eigenen Workspace (per API, Name `e2e-<runId>-<worker>`). Damit sind parallele Worker möglich (anders als `workers: 1` in `feat/e2e`). Teardown löscht ihn; ein Nightly-Cleanup entfernt `e2e-*`-Workspaces älter als 24 h (Master-Key-Script).
- **Assertions:** nur auf selbst erzeugte Daten (Regel aus `feat/e2e` übernehmen).
- **Console-Guard-Fixture:** schlägt bei `pageerror`/`console.error` fehl (siehe Phase 5).
- **Flakiness:** `retries: 1` in CI, `trace: 'on-first-retry'`, Video bei Fehlern, `@quarantine`-Tag mit Ticketpflicht, `KNOWN-ISSUES.md`.

### 9.5 Inhalt der Suite (Ziel „einmal alles durchprobieren“)

**A. API-E2E (über die echte Instanz inkl. Proxy):** jede OpenAPI-Operation mindestens einmal mit gültigem Input, Response-Validierung gegen `openapi/openapi.json` (z. B. mit `@readme/openapi-parser` + Ajv bzw. den vorhandenen zod-Schemas), dazu Stichproben für 401/403/404/405/422. Coverage-Check: jede Operation hat einen API-E2E-Treffer.

**B. Browser-Journeys** (Rollen-bewusst, Desktop; Smoke zusätzlich Mobile):

| Bereich | Journeys |
| --- | --- |
| Shell | Login, Workspace-Liste, Workspace anlegen/joinen (2 Personas: Code erzeugen → beitreten → Anfrage akzeptieren), Sprache de/en, Theme, Settings |
| Katalog | Glas/Garnitur/Zutat/Eis/Einheiten/Aktionen CRUD inkl. Bild-Upload & Crop, Clone, Referenzen-Check, Löschschutz bei Nutzung |
| Cocktails | Rezept anlegen (Formular mit Steps/Ingredients/Garnituren), bearbeiten, archivieren, klonen, Bewertung, Verfügbarkeit, Guest-Info |
| Karten | Karte anlegen, Gruppen/Items, archivieren, Ansicht im Bartender-Modus |
| Bartender | Suche, Karte, Queue (hinzufügen, Fortschritt, entfernen, parallele Nutzer), Statistik-Buchung |
| Kalkulationen | Anlegen, Gruppen, Einkaufsliste, Export/Import JSON |
| Statistiken | Übersicht, Advanced, Sets, Vergleich, Logs |
| Guest-Menüs | Anlegen, Designer, Vorschau-Token, Publish → öffentliche URL ohne Login, Access-Code, QR, PDF/HTML/Table-Tent-Export (mit Chromium-Service) |
| Signage | Slides, Scheduling, Key, öffentliche Signage-Seite |
| Admin | Mitglieder/Rollen (inkl. Owner-Schutz), API-Keys (anlegen → mit Key API aufrufen → widerrufen → 401), Audit-Log, Backup **Export → neuer Workspace → Import → Inhalte gleich** (Roundtrip) |
| Import/Export | Cocktail-JSON-Export → Import in anderen Workspace; PDF-Export |
| Rollen | Jede Persona sieht/kann nur, was erlaubt ist (UI und API) |
| PWA/Offline (optional) | Service-Worker registriert, Offline-Hinweis |

**C. Upgrade-Verifikation** (siehe 10.2).

### 9.6 Lokale Nutzung

```bash
pnpm e2e:env:up          # docker compose -f docker-compose.e2e.yaml up (App aus lokalem Build oder Image-Tag)
pnpm e2e                 # volle Suite gegen E2E_BASE_URL (default http://localhost:3100)
pnpm e2e:smoke
pnpm e2e:ui              # Playwright UI-Mode
E2E_BASE_URL=https://staging… E2E_LOGIN_SECRET=… pnpm e2e   # gegen Staging
```

---

## 10. Phase 7: Release-Gate (wöchentliches Release an E2E koppeln)

### 10.1 Ziel-Pipeline

```
push main ─► build-staging (staging-<sha>) ─► deploy staging ─► e2e smoke @ staging
                                                          (nightly: e2e full @ staging)

weekly cron (z. B. Mo 06:00) / manuell ─► release-gate.yml
   1. Kandidat bestimmen: main@HEAD, nächste Version aus Release-Draft (release-drafter resolved_version)
   2. RC-Image bauen: version im package.json gesetzt (ohne Commit), GIT_SHA → :<version>-rc.<sha>
   3. Job "upgrade" (E1, ephemer)       ─┐
   4. Job "fresh-install" (E1, ephemer) ─┼─ parallel
   5. Job "staging" (E2): Deploy RC → /api/health/ready (commit == sha, keine pending migrations) → Full Suite
   6. alle grün ─► Draft-Release veröffentlichen (target_commitish = getesteter sha)
      rot ─► kein Release, Issue/Benachrichtigung mit Report-Link
release.yml (on: release published):
   - prüft, dass für target_commitish ein grünes Gate existiert (Check-Run / Artefakt)
   - **kein Rebuild**: retag :<version>-rc.<sha> → :<version>, :<major.minor>, :latest  (docker buildx imagetools create)
   - Commit der Release-Metadaten (package.json/CHANGELOG) wie bisher
```

Hinweise:
- Die App liest die Version zur Build-Zeit aus `package.json` (z. B. `pages/index.tsx`, Export-Metadaten). Deshalb wird das RC **bereits mit der Zielversion** gebaut, sonst zeigt ein umgetaggtes Image die alte Version an.
- Manuelles Veröffentlichen bleibt möglich, `release.yml` verweigert aber das Pushen von `latest` ohne grünes Gate (Override nur per `workflow_dispatch` mit Begründung).
- Ein GitHub-Environment `release` mit Required Reviewers ist optional als zusätzlicher Freigabeschritt.

### 10.2 Upgrade-/Migrationstest (Kern der Frage „klappt die Migration?“)

1. Ephemeres Postgres starten, **letztes veröffentlichtes Image** (`:<previous version>`) starten → Migrationen der alten Version laufen.
2. **Seed über die API der alten Version**: alle Entitätstypen inkl. Edge-Cases (Unicode, sehr lange Texte, Bilder, archivierte Elemente, Übersetzungen, Guest-Menüs, Signage, Statistiken, mehrere Workspaces und Rollen). Der Seed ist versioniert, damit er gegen ältere API-Stände läuft.
3. **Snapshot vorher**: Backup-Export pro Workspace + ausgewählte GET-Responses.
4. Alte App stoppen, **RC-Image auf derselben DB starten** (`prisma migrate deploy` beim Start) → `/api/health/ready` muss grün werden; Logs nach Migrationsfehlern scannen.
5. **Snapshot nachher** und normalisierter Diff gegen vorher. Erwartete Änderungen werden pro Migration in `e2e/upgrade/expected-diffs/<migration>.ts` deklariert.
6. **Volle E2E-Suite** auf der migrierten Instanz (funktionieren alle Features mit Bestandsdaten?).
7. Zusätzlich Job **fresh-install**: leere DB → RC → Suite (testet Erstinstallation und Defaults).

Ergänzende statische Checks im PR-Workflow:
- `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url … --exit-code` → Schema und Migrationen driften nicht auseinander.
- Bereits gemergte Migrationsdateien dürfen nicht verändert werden (Git-Diff-Check gegen `main`).
- Migrations-Lint: `DROP COLUMN/TABLE`, `NOT NULL` ohne Default, `ALTER TYPE`, Rename brauchen ein PR-Label `migration:destructive` + Beschreibung des Rollouts.
- Optional (später): **anonymisierter Produktionsdump** als zusätzliche Upgrade-Quelle in einem privaten Runner/Repo (Idee „local profile“ aus `feat/e2e`), weil echte Daten Fälle enthalten, die kein Seed abbildet.

### 10.3 Staging-Anforderungen

- Automatisches Deploy eines bestimmten Tags (heute unklar → siehe offene Fragen): z. B. ein Webhook bzw. SSH-Deploy-Job oder Watchtower mit festem Tag, den der Gate-Job setzt.
- `E2E_LOGIN_SECRET`, `DEPLOYMENT=staging`, Chromium-Service, SMTP auf Mailpit o. Ä. (Mails prüfbar).
- Regelmäßiges Zurücksetzen bzw. Cleanup der `e2e-*`-Workspaces; Backup vor jedem Deploy, damit Migrationsfehler auf Staging reparierbar bleiben.
- Optional: Staging-DB wöchentlich aus einem anonymisierten Prod-Dump erneuern (realistischere Migrationstests).

---

## 11. Phase 8: Verstetigung

- **Definition of Done** (PR-Template ergänzen): Checkliste aus 6.1 für neue oder geänderte Endpunkte, Capability-Matrix-Eintrag, keine neuen Warnings, Migration geprüft.
- **CI-Gates gesamt (PR):** Prettier, ESLint `--max-warnings 0`, i18n, tsc, Unit, Integration (inkl. Cross-Workspace-Suite), OpenAPI-Drift, Migration-Drift/-Lint, Build, Docker-Build, **E2E-Smoke gegen ephemeres Docker-Image**.
- **Nightly:** volle E2E auf Staging + Cleanup + Dependency-Audit (`pnpm audit --prod`).
- **Weekly:** Release-Gate (Phase 7).
- **Doku:** `docs/TESTING.md` (Ebenen, Befehle, Umgebungen), `docs/BACKEND-CONVENTIONS.md`, `docs/API-REVIEW.md`, `docs/CAPABILITIES.md`, `docs/KNOWN-ISSUES.md`, `docs/ENV.md` (neue Variablen `E2E_LOGIN_SECRET`, `GIT_SHA`).

---

## 12. Vorgeschlagene PR-Reihenfolge

| # | PR | Phase |
| --- | --- | --- |
| 1 | `fix(security): scope updates/imports to workspace (IDOR)` + Legacy-PUTs → Controller + Cross-WS-Tests | P0 |
| 2 | `fix(security): harden scraper (SSRF), image MIME validation, nosniff, drop cookie logging` | P0 |
| 3 | `fix(security): owner role guard, PDF export escaping & limits` → **Release 1.21.4** | P0 |
| 4 | `refactor(api): shared scoping/tx/error helpers, withHttpMethods await, prisma error mapping` | P1 |
| 5 | `feat(api): health version + readiness endpoint, security headers` | P1 |
| 6 | `chore(lint): pullToRefresh hook, misc warnings` (parallel) | P5 |
| 7 | `test(e2e): playwright scaffold, docker-compose.e2e, e2e-login, personas, smoke` (parallel) | P6 |
| 8–13 | `refactor(api): legacy <group> → v1 adapter` (je Gruppe) | P2 |
| 14–25 | `fix(api): review <group>` inkl. Transaktionen, Audit, Tests | P3/P4 |
| 26–28 | `refactor(ui): CocktailRecipeForm refs`, `set-state-in-effect`/`exhaustive-deps` → `--max-warnings 0` | P5 |
| 29–33 | `test(e2e): journeys <bereich>` (Port von `feat/e2e` + neu), API-Contract-E2E | P6 |
| 34 | `ci: upgrade test (previous release → rc)` + Migrations-Lint/-Drift | P7 |
| 35 | `ci: staging deploy + e2e`, `ci: release gate + promote instead of rebuild` | P7 |

---

## 13. Offene Entscheidungen

1. **Staging:** Wo und wie läuft Staging heute (Host, Deploy-Mechanismus, wer zieht `staging-latest`)? Darf die CI dort deployen und hat sie Netzwerkzugriff (öffentlich oder Self-hosted Runner)?
2. **Login auf Staging:** Ist der vorgeschlagene, per Secret geschützte E2E-Login-Endpoint akzeptabel, oder ein Test-User im echten OIDC-Provider?
3. **Werkzeug:** Playwright (Empfehlung) statt `tester-army/e2e`; `feat/e2e` wird als Inhaltsquelle portiert, nicht gemergt?
4. **Legacy-API:** Adapter + Sunset (z. B. 6 Monate), oder direkt entfernen (ggf. Major-Version)?
5. **Imports:** „Alles oder nichts“ (Empfehlung) oder Teilimport mit Savepoints pro Item?
6. **Release-Rhythmus:** fester Wochentag/Uhrzeit für das Gate, und sollen rote Gates automatisch ein Issue erzeugen?
7. **Produktionsdaten:** Dürfen anonymisierte Prod-Dumps für Upgrade-Tests verwendet werden (privat, nicht im Repo)?

---

## Anhang A: Transaktions-Funde (Kurzfassung)

| Ort | Problem | Sev |
| --- | --- | --- |
| `cocktailsPorting.tsx:662-1115`, `glasses/garnishes/ingredients/calculations` Import | try/catch pro Item in der Tx, Fake-Erfolg, kein Timeout, unscoped Overwrite | high |
| `glasses.ts:60`, `garnishes.ts:65`, `ingredients.ts:95`, `calculations.ts:114` | Tx vorhanden, aber nicht gescoped | high |
| `signage.ts:78`, Legacy `admin/signage.tsx:108` | Tx ignoriert `tx` | high |
| `statistics.ts:115`, Legacy `statistics/cocktails/add.ts:74` | Queue-Konsum + Statistik ohne Tx, Race | high |
| `workspaces/join.ts:55` | Zähler Read-Modify-Write | high |
| Legacy `cards/[cardId]/index.tsx` PUT/DELETE | ohne Tx, unscoped, Datenverlust möglich | high |
| `units.ts:51-191` + Legacy | Conversions + Regeneration ohne Tx, P2002-Races | high |
| `ingredients.ts:145`, `glasses.ts:88` | In-Use-Check außerhalb der Tx (Cascade!) | med/low |
| `guestMenus.ts:155-355` | Create/Duplicate ohne Tx, `isDefault`-Race, Audit außerhalb | med |
| `signage.ts:87-191`, `signageApiHelpers.ts:41` | `max(order)+1`-Race, Ensure-Race, Overlap-Check | med/low |
| `queue.ts:36-57` | Remove-Race, Add-Loop teilweise erfolgreich | med/low |
| `admin/translation.ts:8` (`updateTranslation`) | JSON-Blob Lost Update | med |
| `actions/ices/units` Controller + Legacy | Entity + Übersetzung ohne Tx | med |
| `apiKeys.ts:64` | Cache-Invalidierung vor dem Delete | med |
| Backup-Import/-Export | Parsing in der Tx, `Promise.all` auf `tx`, kein `maxWait`; Export ohne Snapshot | med/low |
| `demo/create-workspace.ts`, `v1/workspaces/index.ts`, `lib/demo/cleanup.ts`, `lib/auth.ts:173`, `tags.ts`, `calculations.ts:201`, `workspaceUsers.ts` | diverse fehlende Atomarität | med/low |
| Legacy-Clones, `ingredients/index.ts`, `join-requests/index.ts` | `res.json` innerhalb des Tx-Callbacks | med |
| Legacy `*/check` | sinnlose Read-Tx | low |

## Anhang B: Endpunkt-Funde (Kurzfassung, zusätzlich zu 0.2)

- **AuthZ/Scopes:** `cocktails/export/json` ohne Permission; Calculation-Import und Statistic-Sets nur mit Read-Scope; Cocktail-Import mit USER-Rolle; API-Key-Permissions aus dem JWT statt der DB; Master-Key als Fake-User (Audit-FK → 500); `demo-login` für beliebige User ohne E-Mail; `demo/create-workspace` und `demo/cleanup` offen und ohne Rate-Limit; Master-Key-Vergleich mit Längen-Leak.
- **Validierung:** `limit` ohne Maximum (Statistics, Audit-Logs), Queue-`amount`, Rating-Wertebereich, Export/Import-JSON der Katalog-Entitäten mit rohem `req.body`, alle Legacy-Routen ohne zod, `v1/workspaces` POST `name`.
- **Fehler/Methoden:** Prisma-Errors → 500; `withHttpMethods` fängt nichts; Backup-Import ohne Methoden-Check; Scraper 404 statt 405; `users/*` akzeptiert jede Methode; `backupStructure.ts` als leere Route.
- **CORS/Deprecation/Header:** uneinheitliches `withCors`; Legacy-Backups/Join/Workspaces ohne Deprecation; keine globalen Security-Header.
- **Limits:** Rate-Limit nur auf Public-Menus/-Images/Unlock (in-memory pro Prozess); fehlt bei Scraper, Join, Demo, Signage; Body-Limits uneinheitlich (1 MB bei Bild-PUT, 500 MB bei GET-Export).
- **Bereits gut:** Guest-Menu-Rendering (Liquid sicher konfiguriert, DOMPurify, PDF-Lockdown), Public-Image-Allowlist, Access-Codes mit bcrypt und Limits.
- **Test-Coverage:** siehe Phase 4. Abgedeckt sind nur Glasses, Ingredients (Basis), Cocktails (Basis), Queue/Stats (Basis), WorkspaceAdmin und eine Auth-Matrix-Stichprobe.
