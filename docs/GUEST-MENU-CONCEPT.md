# Gästekarten & Karten-Designer – Spezifikation

Status: in Umsetzung. Diese Datei ist die verbindliche Referenz für die Implementierung.

## Leitprinzip

Inhalt einmal pflegen, überall ausspielen. Schichten:

1. Daten (bestehend): Cocktails, Zutaten, Tags, Preise, Bartender-Karten (`CocktailCard`).
2. Inhalt der Gästekarte (`GuestMenu`): eigenes Dokument, verknüpft live mit Bartender-Karten.
3. Informationen: welche Felder sichtbar sind, vererbt Ausgabe → Abschnitt → Cocktail.
4. Design & Ausgabe: Theme + Vorlage je Ausgabe (web, monitor, print).

## Entscheidungen

- Gästekarte ist ein eigenes Dokument (JSON, zod-validiert, `schemaVersion`), referenziert Bartender-Karten live.
- Mehrere Gästekarten pro Workspace, aktivierbar, zeitgesteuert (Zeitraum, Wochentage, Uhrzeitfenster), Priorität, Standardkarte.
- Mengenangaben nie öffentlich, außer explizites Opt-in (`fields.amounts`).
- Design: Vorlagen + Design-Tokens + eigenes CSS + Liquid-HTML-Vorlagen (Slots). Feste React-Shell (Suche/Filter/Navigation/Detail).
- Mehrsprachig von Anfang an.
- Alkoholgehalt, Allergene (14, LMIV Anhang II), Zusatzstoffe pflegbar & optional darstellbar.
- ABV: berechnet mit Verwässerung je Zubereitungsart, als „ca.“ markiert, am Cocktail manuell überschreibbar.
- Gäste-UI-Sprachen: de, en (Fallback en); Inhaltssprachen frei (ISO-Codes).

## Synchronisation

Quelle der Gästekarte (`sourceMode`): `NONE` | `FIXED_CARD` (sourceCardId) | `ACTIVE_CARD` (heute aktive Bartender-Karte, gleiche Logik wie Bartender-Ansicht inkl. `statisticDayStartTime` + Workspace-`timezone`).

Abschnitts-Quellen (`section.source.kind`):
- `cardAllGroups`: alle Gruppen der Quellkarte (expandiert zu je einem Abschnitt).
- `cardGroup`: eine Gruppe der Quellkarte (`groupId`, Gruppen-IDs sind stabil).
- `manual`: `cocktailIds[]`.
- `rule`: `tags[]`, `ingredientIds[]`, `logic: AND|OR`, `sort`.

Item-Overrides (`section.overrides[cocktailId]`): `hidden`, `highlight` (`recommendation|new|signature`), `description` (LocalizedText), `price`.
Preis-Präzedenz: Cocktailpreis → Gruppenpreis → Item-`specialPrice` → Override Gästekarte.
Archivierte Cocktails werden nie angezeigt. `CocktailRecipe.unavailableUntil > now` ⇒ „heute aus“ (ausgegraut, ans Abschnittsende).
Option „auf Anfrage“ (`search.includeOnRequest`): Suche findet auch nicht-archivierte Cocktails außerhalb der Karte, markiert als „auf Anfrage“.

## Informationsbausteine (`FieldConfig`)

Jeder Baustein: `off | list | detail | expandable` (nicht alle Modi für alle sinnvoll).
Bausteine: `price, ingredients, amounts, flavors (Tags), badges, image, description, history, glass, garnish, rating, alcohol, allergens, additives`.
Zusatzoptionen: `alcoholDisplay: badgeOnly|category|percent|percentAndGrams`, `allergenDisplay: icons|codes|footnotes`, `additiveDisplay: footnotes`.
Vererbung: `output.fields` → `section.fields` → `override.fields` (partiell, undefined = erbt).
NIE öffentlich: `notes`, Zutaten-Preise/-Links, Kalkulationen, Statistik, Nutzer, nicht-öffentliche Tags. Der Server-Resolver sendet nur Freigegebenes (Whitelist).

## Mehrere Gästekarten & Zeitsteuerung

Felder: `enabled, isDefault, priority, validFrom, validTo, weekdays[] (0=So..6=Sa), timeFrom, timeTo ("HH:mm"), inactiveBehavior: NOTICE_WITH_LINK | NOTICE_WITH_CONTENT | REDIRECT`.
`/m/{workspacePublicSlug}`: aktive+veröffentlichte Karten mit passendem Zeitplan → höchste Priorität (kleinste `priority`-Zahl); sonst `isDefault`; sonst „keine Karte verfügbar“.
`/m/{bar}/{menuSlug}`: gültig → Karte; sonst Hinweis (gilt ab / galt bis / gilt an Tagen/Uhrzeit / nicht verfügbar) + Link zur aktuellen Karte (bzw. Inhalt als Vorschau / Redirect gemäß `inactiveBehavior`). Unbekannt → 404 mit Link.
Zeitzone: Workspace-Setting `timezone` (Default `Europe/Berlin`), Bar-Tag via `statisticDayStartTime`.
Vorschau: `?preview={previewToken}` zeigt Entwurf, ignoriert Zeitplan.

## Mehrsprachigkeit

- `LocalizedText = Record<locale, string>` im Dokument.
- Tabellen `CocktailRecipeTranslation`, `IngredientTranslation`, `GarnishTranslation`, `GlassTranslation`.
- `TagDefinition.label`, `TagCategory.name` als LocalizedText-JSON.
- Workspace-Settings: `contentLocales` (JSON: `{ primary: "de", additional: ["en"] }`), `currency` (Default `EUR`), `timezone`.
- Fallback: gewünschte Sprache → Ausgangssprache → Rohwert.
- Gäste-Sprachwahl: `?lang=` → localStorage → Accept-Language → Ausgangssprache.
- Suche matcht aktuelle Sprache + Ausgangssprache.
- Preise via `Intl.NumberFormat(locale, { style: 'currency', currency })`.

## Gästeinformationen

- `Ingredient`: `abv`, `allergens Allergen[]`, `allergenSources AllergenSource[]`, `additives Additive[]`, `guestInfoComplete`, `hideOnGuestMenu`, `guestName`.
- `Garnish`: `allergens`, `allergenSources`, `additives`, `guestInfoComplete`.
- `AllergenSource`: die in Anhang II „namentlich“ genannten Getreide (bei `GLUTEN`) und Schalenfrüchte (bei `NUTS`); optional, nur zusammen mit dem Allergen gespeichert.
- `CocktailRecipe`: `abvOverride`, `extraAllergens`, `extraAdditives`, `unavailableUntil`.
- `WorkspaceCocktailRecipeStepAction.dilutionPercent` (Default per actionGroup: SHAKE 25, STIR 20, sonst 10).
- Ableitung (`lib/guest-info`): Allergene/Zusatzstoffe = Union (optionale/alternative als `optional`), Vollständigkeit = alle beteiligten `guestInfoComplete`. ABV: Mengen → ml über Unit-Conversions, + Verwässerung, Status `calculated|manual|unknown`. „alkoholfrei“ nur wenn alle ABV bekannt und ≤ 0,5 %. Kategorien: alkoholfrei ≤0,5 / leicht <10 / mittel ≤20 / stark >20.
- Bezeichnungen: Allergene heißen überall gleich – Bezeichnung nach LMIV Anhang II (`guestInfo:allergen.*`), keine umgangssprachlichen Kurzformen; Buchstaben-Codes A–R nach österr. Allergeninformationsverordnung. Angegebene Getreide/Schalenfrüchte stehen in Klammern dahinter („Glutenhaltiges Getreide (Weizen, Gerste)“, `lib/guest-info/format.ts`); in der Fußnoten-Legende die Gesamtmenge der Karte.
- „Ohne X“-Filter zeigt nur Cocktails mit vollständigen Angaben.

## Design / Vorlagen

- React-Shell (Sprache, Suche, Filter, Abschnittsnavigation, Detail-Sheet) – fix.
- Liquid-Slots (liquidjs): `menu_header, section_header, item, item_detail, footer`. Auch eingebaute Vorlagen sind Liquid + CSS (in `lib/guest-menu/templates/*`).
- Theme-Tokens → CSS-Variablen (`--gm-bg, --gm-surface, --gm-text, --gm-muted, --gm-accent, --gm-accent-contrast, --gm-font-heading, --gm-font-body, --gm-radius, --gm-density`).
- Eigenes CSS: postcss, gescoped auf `.gm-root`, `@import`/externe `url()` entfernt.
- Liquid-Ausgabe mit DOMPurify sanitisiert. Liquid-Kontext = nur Resolver-Output.
- Adaptive Shell: Container Queries; Filterkategorien nur bei ≥2 Werten, Chips mit Zählern, 0-Treffer-Chips deaktiviert; <10 Cocktails → nur Suche; Filter & Suche in URL; innerhalb Kategorie OR, zwischen Kategorien AND, „Ohne“ schließt aus.

## Ausgaben

- web: öffentliche Seite `/m/[...slug]` (SSR, außerhalb `/workspaces`).
- monitor: neuer Signage-Slide-Typ `GUEST_MENU`, virtuelle Auflösung 1920×1080 / 1080×1920, Auto-Fit + Paging, Polling 60 s mit ETag.
- print: PDF A4/A5/DL über bestehende Puppeteer-Pipeline mit eigenem CSS.

## Code-Orte

- `lib/guest-menu/schema.ts` – zod-Dokument + Typen
- `lib/guest-menu/schedule.ts` – Zeitplan & Auflösung (shared mit Signage/Bartender)
- `lib/guest-menu/resolve.ts` – Resolver → `PublicMenuDto` (einziger Privacy-Punkt)
- `lib/guest-menu/render/*` – Liquid-Engine, CSS-Scoping, Sanitizing
- `lib/guest-menu/templates/*` – eingebaute Vorlagen
- `lib/guest-info/*` – Allergen/ABV-Ableitung
- `components/guest-menu/shell/*` – öffentliche Shell
- `components/guest-menu/builder/*` – Builder
- `pages/m/[...slug].tsx`, `pages/api/public/menus/**`
- v1 Admin-API: `/api/v1/workspaces/{id}/guest-menus/**`, `/tags/definitions`, `/tags/categories`, `/translations/content`
- Verwaltung: `pages/workspaces/[workspaceId]/manage/guest-menus/*`, `manage/translations`, `manage/guest-info`
