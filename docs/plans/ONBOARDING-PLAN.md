# Plan: Onboarding, Vorlagen, Tutorials & Demo-Umbau

Stand: 2026-11-15 · Branch `feat/onboarding-templates`

Ziel: Neue Workspaces starten eingerichtet und mit Inhalt, es gibt ein wiederverwendbares Tutorial-System (auch für
neue Features bei Bestandsnutzern), und die Demo zeigt beim ersten Durchklicken einen guten Eindruck.

## Entscheidungen

| Thema | Entscheidung |
| --- | --- |
| Zeitpunkt der Anlage | Sofort nach Namenseingabe, danach Assistent (`/workspaces/[id]/setup`), fortsetzbar |
| Tour-Engine | Eigene Implementierung (Modals sind `<dialog>` im Top-Layer, Rest-DOM inert) |
| Hilfe-Einstieg | „Hilfe & Tutorials“: eigene Gruppe auf der Manage-Seite + Profil-Dropdown |
| Katalog-Werte | Preise leer; Allergene/ABV vorbefüllt, `guestInfoComplete = false` |
| Betriebsart | Nur Vorauswahl im Assistenten, nicht gespeichert |
| Startinhalte | Sammlungen = Vorlagen; zuerst „All Time Classics“, später weitere (Tiki, …) |
| Sprache | Erste Frage im Assistenten (DE/EN): UI-, Inhalts- und Vorlagensprache |
| Vorlagen/Defaults | Initiale Fassung als Dateien im Repo, danach ist die DB maßgeblich |
| Vorlagenpflege | Nur Master-Key-API (später eigene Admin-UI) |
| Demo | Eigene Instanz wie bisher, aber gleiches Image, Inhalte aus `DEMO`-Vorlage |

## 1. Vorlagen-System („Vorlagen sind Workspaces“)

- Eine Vorlage ist ein normaler Workspace plus Eintrag in `WorkspaceTemplate`. Arten:
  - `BASE`: Einheiten, Umrechnungen, Eis, Zubereitungsarten, Labels (`translations`-Setting), Tag-Kategorien,
    Region-Defaults. Wird bei **jeder** Anlage angewendet (ersetzt den Code in `createWorkspaceWithDefaults`).
  - `CATALOG`: Sammlungen, ganz oder als Auswahl anwendbar.
  - `DEMO`: komplette Beispiel-Bar für die Demo-Instanz.
- Mitgelieferte Vorlagen: `templates/<key>/manifest.json` + `backup.json` (Backup-Format) + `images/` (Bilder als
  Dateien, im Backup als `file:images/<name>` referenziert). Beim ersten Bedarf (Advisory-Lock, idempotent) in die DB
  übernommen, wenn der Key fehlt oder die Repo-Version höher ist. Mitgelieferte DB-Vorlagen haben keine Mitglieder
  (schreibgeschützt), ein Update ersetzt nur sie. Anpassen = klonen mit eigenem Key; Klone fasst kein Release an.
- Fallback: Fehlt `BASE` in der DB, wird die Repo-Datei direkt genutzt. Anlage darf nie fehlschlagen.
- Anwenden (`lib/templates/applyTemplate.ts`) auf der Backup-Pipeline:
  1. `readWorkspaceBackup(templateWorkspaceId)`
  2. Auswahl filtern + Abhängigkeiten ergänzen (Cocktail → Glas, Zutaten, Garnituren, Einheiten, Eis,
     Zubereitungen; Karte → Cocktails)
  3. Sprache umdrehen (Vorlage `de` → Ziel `en`: `name` aus der Übersetzung, `de` wird Übersetzungszeile)
  4. Duplikate per normalisiertem Namen (alle Sprachen) abgleichen → verknüpfen statt neu anlegen
  5. `executeBackupImport` in einer Transaktion; Optionen: `CATALOG` ohne Preise + Allergene unbestätigt,
     `DEMO` behält Veröffentlichungsstatus der Gästekarten
- Ein Anlageweg: `createWorkspace()` = leerer Workspace → `BASE` → optional `CATALOG`/`DEMO`. Gilt für UI,
  Admin-API, Demo und OIDC (behebt `lib/auth.ts:176`, dort fehlen heute die Defaults).
- Als Vorlage markierte Workspaces sind nicht löschbar (409 `TEMPLATE_IN_USE`) und zeigen ein Banner.
- Pflege-Workflow: im Workspace pflegen → `pnpm templates:pull <workspaceId> <key>` (Manifest, Backup, Bilder,
  Version +1) → Diff prüfen → committen.

## 2. Einrichtungsassistent (`/workspaces/[id]/setup`, ADMIN+)

1. Sprache & Region: UI-Sprache DE/EN, Inhaltssprache + weitere, Zeitzone, Währung, Tagesbeginn
2. Grunddaten: Name, Logo, Betriebsart (Bar / Restaurant & Hotel / Event & Catering / Privat → Vorauswahl)
3. Startinhalte: „Leer“ oder Sammlungen der gewählten Sprache; je Sammlung „Alles“ / „Nur Grundausstattung“ /
   „Auswählen …“, optional Beispielkarte
4. Team (optional; ausgeblendet bei extern verwalteten Workspaces): Join-Code, Link, QR
5. Fertig: Grundlagen-Tour anbieten

Jeder Schritt speichert sofort. `setupCompletedAt = null` → Banner „Einrichtung fortsetzen“ für ADMIN+.
Settings-Sections werden in Felder und Speichern-Hülle getrennt, damit Assistent und Einstellungen dieselben Felder
nutzen. Nach dem Anlegen auf `/` → Redirect in den Assistenten.

## 3. Tutorial-System

- Registry `lib/tours/definitions/*`: `id`, `version`, `category`, `minRole`, `announce.since`, Schritte
  `info` | `highlight` | `action` (`advanceOn`: click | route | App-Event), `route`, `target`, `optional`.
- Anker: `{...tourTarget('bar.search')}` → `data-tour`; Ziel-IDs als typisierte Union.
- Engine (`components/tour/`, `TourProvider` in `_app.tsx`): UI per Portal in den offenen `<dialog>` bzw. `body`,
  angezeigt als `popover="manual"`; Spotlight; Seitenwechsel per Route; fehlendes Ziel → Schritt überspringen;
  `useTourAction` für Vorbereitungen; Esc/Android-Zurück beenden zuerst die Tour; Bottom-Sheet auf Mobile; a11y;
  Deep-Link `?tour=<id>`; laufender Schritt in `sessionStorage`.
- Fortschritt pro Nutzer in `UserGuideProgress`.
- Anstoß: nach Assistent, beim ersten Besuch neuer Mitglieder, in der Demo. Feature-Touren nie automatisch.
- Erste Touren: `basics-bar` (alle), `basics-manage` (MANAGER+).

## 4. Ankündigungen & „Hilfe & Tutorials“

- Changelog-Modal: Abschnitt „Touren zu neuen Funktionen“ (`announce.since` > `lastSeenVersion`); im Workspace
  „Neu“-Badges an den Manage-Links.
- `/workspaces/[id]/manage/help`: Einrichtungs-Checkliste (live, plus Fortschrittskarte in der Bar-Ansicht;
  Punkte lassen sich workspaceweit „Als erledigt markieren“, wenn man sie bewusst nicht möchte, Touren ebenso),
  Touren mit Status, „Was ist neu“ (`user-changelog.json`), für ADMIN „Startinhalte hinzufügen“.

## 5. Demo (eigene Instanz)

- Bleibt: Wegwerf-User, Login-Token, TTL, Rate-Limit, Banner.
- Neu: Klon der Standard-`DEMO`-Vorlage in Besuchersprache; Generator für Statistik (14 Tage), Bewertungen,
  Warteschlange; Gästekarte unter `/m/{workspaceId}`; Grundlagen-Tour; optional „Einrichtung ausprobieren“.
- Demo-Schalter zur Laufzeit (Config-Endpoint statt `NEXT_PUBLIC_DEMO_MODE`) → ein Image; Aufräumen stündlich im
  App-Prozess (`instrumentation.ts`).
- Entfällt: Cron-Container, `scripts/cleanup-demo-workspaces.js`, `config/demo-workspace-config.json`,
  `DEMO_WORKSPACE_CONFIG_PATH`, `middleware/api/demoAuthenticationMiddleware.tsx`, Seeder im Demo-Handler,
  separater Demo-Image-Build.

## 6. Datenmodell & API

```prisma
model Workspace {
  // …
  /// null = Einrichtungsassistent nicht abgeschlossen
  setupCompletedAt DateTime?
}

enum GuideStatus { STARTED COMPLETED DISMISSED }

model UserGuideProgress {
  userId    String
  guideId   String      // "tour:basics-bar", "checklist:<workspaceId>"
  version   Int         @default(1)
  status    GuideStatus
  updatedAt DateTime    @updatedAt
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, guideId])
}

enum TemplateKind { BASE CATALOG DEMO }

model WorkspaceTemplate {
  workspaceId String       @id
  workspace   Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  key         String       @unique
  kind        TemplateKind
  name        Json         // LocalizedText
  description Json?
  locales     String[]
  source      String?
  builtIn     Boolean      @default(false)
  version     Int          @default(1)
  published   Boolean      @default(false)
  isDefault   Boolean      @default(false)
  sortOrder   Int          @default(0)
  updatedAt   DateTime     @updatedAt
}
```

Migration: `setupCompletedAt = now()` für bestehende Workspaces.

| Methode | Pfad | Berechtigung |
| --- | --- | --- |
| GET | `/api/v1/templates?kind=CATALOG&locale=` | angemeldet |
| GET | `/api/v1/templates/{key}/items?locale=` | angemeldet |
| POST | `/api/v1/workspaces/{id}/templates/{key}/apply` | MANAGER + `*_CREATE` |
| GET | `/api/v1/workspaces/{id}/onboarding` | USER |
| POST | `/api/v1/workspaces/{id}/onboarding/complete` | ADMIN |
| PUT | `/api/v1/workspaces/{id}/onboarding/checklist/{itemId}` `{ skipped }` → Setting `onboardingChecklistSkipped` | MANAGER + `WORKSPACE_UPDATE` |
| GET/PUT | `/api/v1/me/guides(/{guideId})` | Session |
| GET/POST | `/api/admin/templates` | Master-Key |
| PATCH/DELETE | `/api/admin/templates/{key}` | Master-Key |
| POST | `/api/admin/templates/{key}/clone` → Join-Code | Master-Key |
| POST | `/api/admin/templates/{key}/access` → Join-Code | Master-Key |

Admin-Endpunkte mit OpenAPI-Doku (für die spätere Admin-UI). Erster Beitretender eines mitgliederlosen Workspaces
wird OWNER (`lib/api/v1/join.ts:47`).

## 7. Qualität

- Unit: Manifest-Schema, Filter/Abhängigkeiten, Sprachumkehr, Duplikatabgleich, Checkliste, Tour-Registry.
- Integration: Vorlage anwenden (Rechte, fremder Workspace, Duplikate, fehlende Einheiten), Admin-API, identische
  Defaults für alle Anlagewege, idempotente/parallele Übernahme in die DB, Import jeder mitgelieferten Vorlage.
- CI: `scripts/check-tour-targets.mjs` (analog `i18n:check`).
- PR-Template: „Tour/Ankündigung: ja (id) / bewusst nein“.

## 8. Phasen

| Phase | Inhalt |
| --- | --- |
| 1 Vorlagen-Fundament | Migration, `lib/templates/*`, `templates/base/`, `createWorkspace()` für alle Wege, Master-Key-API, `templates:pull` |
| 2 Assistent & All Time Classics | Assistent, Auswahl-Dialog, Redirect, Fortsetzen-Banner, Inhalte (~40 Zutaten, 10 Gläser, 10 Garnituren, 20 Klassiker, de/en, eigene Texte) |
| 3 Touren & Hilfe | Engine, Registry, Fortschritt-API, CI-Check, `basics-bar`, `basics-manage`, Hilfe-Seite, Checkliste, Begrüßung |
| 4 Demo-Umbau | `DEMO`-Vorlage, Aktivitätsgenerator, Laufzeit-Flag, In-Prozess-Cleanup, Altteile entfernen, Doku |
| 5 Ausbau | Ankündigungen, weitere Touren/Sammlungen, „Aus Vorlagen hinzufügen“ in Empty States |
