# Plan: Bar-Geräte, Profile mit PIN, Stationen und eigene Queue

Stand: 2026-11-20 · Branch `feat/device-access` (setzt auf `feat/instance-api` auf) · Issue
[#622](https://github.com/jo-gross/Cocktail-Manager/issues/622)

Ziel: Eine Bar meldet ihre Tablets einmal mit einem Gerätecode an, statt auf jedem Tablet ein persönliches Konto
einzuloggen. Auf dem Gerät wählt sich das Personal per Profil und PIN auf, oder es arbeitet anonym als Gerät. Jedes
Gerät zeigt „seine“ Kartengruppen hervorgehoben oder ausschließlich. Die Queue zeigt, von wem oder welchem Gerät eine
Bestellung kommt, filtert auf die eigenen (Issue #622) und aktualisiert sich live. Self-Hosting hat das Feature immer.
Gehostet ist es Teil der Bar-Tarife, mit einer Höchstzahl an Geräten und gestaffeltem Zukauf.

Umsetzung: ein Branch und ein PR, vollständig und in einem Zug (kein vorgezogener Teil-PR).

## 1. Entscheidungen

| Thema | Entscheidung |
| --- | --- |
| Identität eines Geräts | Eigener Zugangstyp „Gerät“ mit eigenem Cookie, **kein** `User`-Konto und keine Mitgliedschaft (Abschnitt 4) |
| Rechte | Freigabe je API-Operation (`device: 'read' \| 'bar' \| 'manage'`); alles ohne Freigabe ist für Geräte gesperrt |
| Organisation | Ein Gerät gehört zu genau einer Bar (Workspace) |
| Profile | Personal ohne Konto (nur Bar-Rechte, zählt nicht als Mitglied) oder Profil eines Mitglieds (dessen Rolle, gedeckelt) |
| Höchstrolle auf Geräten | MANAGER; ADMIN- und OWNER-Bereiche nie im Gerätemodus |
| Bearbeiten auf dem Gerät | **Direkt dabei:** MANAGER-Profile von Mitgliedern pflegen Inhalte (Rezepte, Karten, Kalkulationen, Gästekarten) auf dem Gerät |
| Grundstufe neuer Geräte | `BAR` (anonym alles an der Bar) |
| Gerätecode | Einmalig, 15 Minuten; Option „mehrere Geräte“ bis 24 Stunden mit Höchstzahl |
| Gruppen pro Gerät | Über **Stationen**, die Kartengruppen im Karten-Editor zugeordnet werden; „Nur Station“ mit abschaltbarem „Alle anzeigen“ |
| Queue | Herkunft und Bearbeiter je Eintrag; „Erledigt“/„Ablehnen“ für genau einen Eintrag; Filter „Alle / Eigene zuerst / Nur eigene / Meine Station“ |
| Aktualisierung | **Live per Server-Sent Events** mit Postgres `LISTEN/NOTIFY`, Rückfall auf Abfrage alle 5 Sekunden mit ETag (Abschnitt 8.2) |
| Personen zuordnen | Bar-Einstellung, Standard **aus** (Datenschutz) |
| PIN | 4–8 Ziffern, Mindestlänge pro Bar einstellbar |
| Automatisches Sperren | Pro Gerät einstellbar, mit Standard der Bar (Vorgabe 5 Minuten) |
| Self-Hosting | Immer verfügbar, ohne Limits, ohne neue Pflicht-Variablen; ohne Geräte sieht alles aus wie bisher |
| Gehostet | Feature `devices` nur in Bar-Tarifen; Bar Pro mit 2 Geräten inklusive, Zukauf gestaffelt (Abschnitt 10.2) |

## 2. Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Gerät** | Ein Browser (meist Tablet), der mit einer Bar gekoppelt ist. Hat Name, Konfiguration und einen geheimen Geräteschlüssel im Cookie |
| **Gerätecode** | Kurzer Code (oder QR-Code) zum Koppeln eines Geräts |
| **Profil** | Eine Person, die sich auf Geräten aufschaltet: Name, Farbe, PIN. Eigenständig (Personal ohne Konto) oder mit einem Mitglied verknüpft |
| **Bediener** | Das gerade aufgeschaltete Profil eines Geräts; ohne Bediener arbeitet das Gerät anonym |
| **Station** | Arbeitsbereich der Bar (z. B. „Tresen“, „Tiki“, „Shots“). Kartengruppen gehören zu Stationen, Geräte zeigen ihre Stationen |

## 3. Ausgangslage (Stand `feat/instance-api`)

- **Anmeldung:**
  - Nur persönliche Konten über Google oder eigenen OIDC (better-auth 1.7.25).
  - Sitzung 7 Tage gleitend, Cookie-Cache 5 Minuten.
  - Es gibt keine anonyme oder Geräte-Sitzung.
- **Maschinen-Zugänge:**
  - Signage-Monitor: ein Schlüssel pro Bar in der URL, nur lesend.
  - API-Keys: handeln immer als die Person, die den Key erstellt hat.
- **Rollen:** OWNER > ADMIN > MANAGER > USER, live je Anfrage geprüft. API-Keys haben stattdessen 58 Einzelrechte.
- **Was schon USER sieht:**
  - Mitglieder mit E-Mail und letzter Öffnung
  - Audit-Log mit Namen
  - Bestellprotokoll mit Namen und E-Mail

  Ein Tablet mit USER-Rechten würde das alles zeigen.
- **Bartender-Ansicht** (`pages/workspaces/[workspaceId]/index.tsx`, 1.400 Zeilen):
  - Gruppen sind immer alle offen, der Zustand liegt nur im Speicher.
  - Ansichts-Einstellungen (`UserSetting`) gelten pro Person auf allen Geräten.
- **Queue** (`CocktailQueue`):
  - Sie speichert weder Person noch Gerät.
  - „Erledigt“ und „Ablehnen“ nehmen den ältesten Eintrag mit gleichem Cocktail und gleicher Notiz, egal von wem.
  - Sie wird jede Sekunde abgefragt (mit Anmeldung je Anfrage 3–4 Datenbankabfragen), auch ohne Bestellungen.
  - „Wird gemacht“ ist immer alphabetisch gruppiert.
- **Statistik:** `CocktailStatisticItem.userId` heißt „wer gebucht hat“ (Spalte „Hinzugefügt von“ in den Buchungs-Logs).
- **Gruppen-IDs:** Sie bleiben beim Bearbeiten einer Karte stabil, beim Klonen und beim Import entstehen neue.
- **Betrieb:**
  - Next.js `output: 'standalone'` (`node server.js` im Docker-Image), kein eigener Server.
  - `pg` ist als Abhängigkeit vorhanden.
  - Self-Hoster betreiben die App hinter eigenen Reverse-Proxys (nginx, Traefik, Caddy).

## 4. Architektur: Identität und Rechte

### 4.1 Warum kein Konto pro Gerät

Ein Gerät als `User` (wie die Demo-Nutzer ohne E-Mail) brächte zwar den ganzen Anmelde-Stapel mit. Aber:
- Es bekäme alles, was USER darf, inklusive der E-Mails der Mitglieder.
- Es zählte als Mitglied, in der Abrechnung und in der Mitgliederliste.
- Es wäre ständig „zuletzt aktiv“.
- Löschen würde Kalkulationen und API-Keys mitlöschen.
- Ein PIN-Wechsel innerhalb einer Sitzung würde Rollen und Einstellungen im Client-Cache behalten.

Deshalb wird „Gerät“ ein eigener Zugangstyp neben Sitzung, API-Key und Master-Key.

### 4.2 Gerätezugang

- **Cookie:** `cm-device` (httpOnly, `Secure` bei https, SameSite=Lax, Pfad `/`). Inhalt ist ein zufälliger 256-Bit-Schlüssel, in
  der Datenbank nur als SHA-256-Hash.
- **Laufzeit:**
  - Absolut höchstens 365 Tage, danach neu koppeln.
  - Verlängerung durch Nutzung, gedrosselt einmal pro Tag.
  - Kein Cookie-Cache: Widerruf wirkt sofort.
- **Vorrang:** Ist zusätzlich eine persönliche Sitzung da, gilt diese. Das Gerät bleibt gekoppelt und greift wieder,
  sobald sich die Person abmeldet.
- **Prüfung:** neuer Zweig in `withWorkspacePermission` nach Master-Key und API-Key:
  1. Gerät gültig und zur Bar passend?
  2. Operation für Geräte freigegeben?
  3. Wirksame Rolle (4.4) ausreichend?
  4. Plan-Status: `workspaceAccessError` mit `via: 'device'`.
- **Freigabe je Operation:**
  - Neues Feld `device?: 'read' | 'bar' | 'manage'` in der `RouteSpec`. Ohne das Feld lehnt die Operation Geräte ab.
  - Das ist eine Positivliste statt einer Sperrliste.
  - `withAuthentication` (alle `auth: 'user'`-Routen wie Workspace anlegen und Beitreten) akzeptiert Geräte **nie**.
- **Client:**
  - `proxy.ts` lässt `/workspaces/*` auch mit Geräte-Cookie durch.
  - `AuthBoundary` meldet ein Gerät nie ab, wenn `/api/users` scheitert, sondern lädt `GET /api/device`.
  - Der Kontext kennt einen **Prinzipal**: Person oder Gerät mit Bediener.
  - Beim Bedienerwechsel werden Rolle, Einstellungen und Tour-Fortschritt im Client neu geladen.

### 4.3 Bediener (Profil mit PIN)

- Das Gerät zeigt die aktiven Profile der Bar (nur Name und Farbe). Die Person tippt ihr Profil an und gibt die PIN ein.
- Das ergibt eine **Bediener-Sitzung**: Cookie `cm-operator` mit zufälligem Schlüssel, in der Datenbank als Hash,
  gebunden an genau dieses Gerät.
- Die Sitzung endet:
  - mit „Sperren“
  - nach Inaktivität
  - nach höchstens 12 Stunden
  - beim Widerruf von Gerät oder Profil
  - bei PIN-Änderung (`pinVersion`)
- **Inaktivitäts-Sperre:** Die Bar legt einen Standard fest (Vorgabe 5 Minuten, 1–60). Jedes Gerät kann ihn
  überschreiben oder „Standard der Bar“ verwenden.

### 4.4 Wirksame Rolle und Umfang

| Situation | Wirksam |
| --- | --- |
| Gerät ohne Bediener | Grundstufe des Geräts: `VIEW` (nur `device: 'read'`), `ORDER` (zusätzlich Queue hinzufügen), `BAR` (alle `device: 'bar'`-Operationen mit USER) |
| Profil ohne Konto | USER, nur `read`- und `bar`-Operationen |
| Profil eines Mitglieds | Rolle des Mitglieds (live), gedeckelt auf die Höchstrolle des Geräts (Standard MANAGER); `read`, `bar` und ab MANAGER `manage` |
| Mitglied entfernt | Profil wird unwirksam (live geprüft wie heute) |

**Umfang je Stufe:**

| Stufe | Operationen |
| --- | --- |
| `read` | Karten und Cocktails ansehen (mit Zutaten, Gläsern, Garnituren, Bildern), Suche, Einheiten, Arbeitszeit-Einstellungen, Übersetzungen, Gästekarten-Extras, Ankündigungen, Plan-Status |
| `bar` | Queue (hinzufügen, „wird gemacht“, erledigt, ablehnen), buchen, eigene Buchungen des Tages ansehen (ohne E-Mails) |
| `manage` | Inhalte pflegen wie ein MANAGER: Cocktails, Zutaten, Gläser, Garnituren, Einheiten, Eis, Zubereitungen, Tags, Karten (inklusive Stationen der Gruppen), Kalkulationen, Gästekarten (inklusive Veröffentlichen), Monitor-Inhalte, Stationen, Buchungen löschen |

**Nie auf Geräten** (persönliche Anmeldung nötig):
- alle Einstellungsseiten, Mitglieder, Beitrittscodes, API-Keys
- Geräte- und Profilverwaltung
- Backup, Import, Export, Gefahrenzone
- Signage-Schlüssel, Vorlagen anwenden, Abo

Auch alle Routen, die bisher nur `withAuthentication` nutzen, bleiben gesperrt.

**Zuordnung im Bearbeiten-Fall:**
- Änderungen über ein Mitgliederprofil laufen auf das Konto des Mitglieds (Audit, `updatedByUserId` bei
  Kalkulationen).
- Das Audit-Log vermerkt zusätzlich Gerät und Profil (neue optionale Spalten).

## 5. Koppeln mit Gerätecodes („Beitrittscodes für Geräte“)

- **Anlegen:**
  - Unter Einstellungen → _Geräte_ legt ein MANAGER ein Gerät an: Name, Stationen, Grundstufe, Höchstrolle, ob
    Bediener Pflicht sind, Sperrzeit.
  - Die Seite zeigt einen **Gerätecode** `K7Q2-M9XD` (Crockford-Base32, ca. 40 Bit, ohne verwechselbare Zeichen) und
    einen QR-Code auf `/geraet?code=…`.
- **Gültigkeit:**
  - Standard: 15 Minuten, einmalig.
  - Option „Mehrere Geräte“: bis 24 Stunden, höchstens N Kopplungen. Jede Kopplung erzeugt ein eigenes Gerät nach der
    Vorlage, mit laufender Nummer im Namen.
- **Speicherung:** nur als Hash, Anzeige genau einmal (wie ein API-Key).
- **Koppeln:**
  - Auf dem Tablet „Als Bar-Gerät anmelden“ auf der Startseite: Code eingeben oder QR scannen.
  - Das löst `POST /api/device/pair` aus (gleicher Ursprung).
  - Erfolg: Geräte-Cookie gesetzt, Weiterleitung in die Bartender-Ansicht.
  - 402, wenn das Geräte-Limit des Plans erreicht ist.
- **Missbrauchsschutz:**
  - Rate-Limit pro IP und globales Fehlerbudget pro Bar.
  - Verbrauch atomar (wie bei Beitrittscodes).
  - Fehlversuche verraten nicht, ob ein Code existiert.
- **Verwaltung:**
  - Liste mit Name, Stationen, zuletzt gesehen, Browser, gekoppelt von und am.
  - Aktionen: umbenennen, konfigurieren, **widerrufen** (sofort), „alle Geräte abmelden“.
- **Bequemer Weg:** Ein angemeldeter MANAGER kann auf dem Tablet „Dieses Gerät als Bar-Gerät einrichten“ wählen. Das
  koppelt das Gerät und meldet die persönliche Sitzung ab.

## 6. Profile und PIN

- **Profile ohne Konto** (Personal, Aushilfen): legt ein MANAGER an mit Name, Farbe, PIN und optional Stationen. Sie
  haben nur Bar-Rechte.
- **Profile von Mitgliedern:** Ein Mitglied legt unter _Mein Bar-Profil_ selbst seine PIN fest (pro Bar). Die Rolle
  kommt live aus der Mitgliedschaft.
- **PIN:**
  - 4–8 Ziffern, Mindestlänge pro Bar einstellbar (Vorgabe 4).
  - bcrypt wie der Gästekarten-PIN; `pinVersion` beendet alte Bediener-Sitzungen.
  - Nie im Log.
  - MANAGER können zurücksetzen, sehen PINs aber nie.
- **Fehlversuche:**
  - Fehlerzähler und Sperre **in der Datenbank** pro Profil und pro Gerät (nicht pro IP, denn alle Tablets einer Bar
    teilen sich eine IP).
  - 5 Fehlversuche ergeben 5 Minuten Sperre, danach steigend.
- **Auswahl:** Die Profilauswahl zeigt Namen und Farben, filterbar nach Station. Die PIN wird erst nach der Wahl des
  Profils abgefragt, PINs müssen also nicht eindeutig sein.

## 7. Stationen und Gruppen pro Gerät

**Problem:** Gruppen-IDs taugen nicht als Geräte-Einstellung. Karten wechseln oft (Tageskarten), und Klonen und Import
erzeugen neue IDs.

**Lösung:**
- Stationen werden einmal pro Bar angelegt.
- Im Karten-Editor bekommt jede Gruppe ihre Stationen (Mehrfachauswahl).
- Klonen und Backup übernehmen die Zuordnung.

Pro Gerät (zentral verwaltet, auf dem Gerät mit MANAGER-Bediener änderbar):

| Einstellung | Werte |
| --- | --- |
| Stationen | keine, eine oder mehrere |
| Gruppenanzeige | **Alle** (wie heute) · **Hervorheben**: Gruppen der Station oben, markiert und offen, andere zugeklappt · **Nur Station**: nur deren Gruppen, mit „Alle anzeigen“ (pro Gerät abschaltbar) |
| Queue-Filter | Standard des Geräts (Abschnitt 8) |
| Sprache, Design | pro Gerät statt pro Person |
| Bediener Pflicht | ja/nein (ohne Bediener nur ansehen) |
| Sperrzeit | Standard der Bar oder eigener Wert |

- **Persönliche Konten:** Sie bekommen dieselbe Wahl (Station, Anzeige, Filter) pro Bar, gespeichert im Browser. Das
  hilft auch Self-Hostern mit einem Konto pro Tablet.
- **Bestellansicht:** zeigt immer alle Gruppen. Die Gästekarten-Extras bleiben die letzte Gruppe.
- **Ohne Stationen** bleibt die Ansicht exakt wie heute.

## 8. Queue (Issue #622)

### 8.1 Herkunft, Bearbeiter, Filter

- **Neue Felder in `CocktailQueue`** (alle optional, beim Löschen `NULL`):
  - Herkunft: `createdByUserId`, `createdByProfileId`, `createdByDeviceId`, `stationId`
  - Bearbeiter: `inProgressByUserId`, `inProgressByProfileId`, `inProgressByDeviceId`, `inProgressAt`

  Der Server setzt sie aus dem Zugang, nie aus dem Request-Body. Die Station kommt aus dem Gerät bzw. der Wahl der
  Person.
- **Ausgabe:** Der Eintrag liefert zusätzlich `origin` und `inProgressBy` als `{ kind: 'user'|'profile'|'device', id,
  name, color }`, ohne E-Mail.
- **Einzelverbrauch:**
  - „Erledigt“ und „Ablehnen“ bekommen optional `queueItemId`, damit genau dieser Eintrag verbraucht wird. Sonst
    schließt ein Tablet mit „Nur eigene“ fremde Bestellungen ab.
  - Ohne `queueItemId` gilt das bisherige Verhalten (ältere Clients, API).
  - `STATISTIC_QUEUE_AMBIGUOUS` bleibt.
- **Filter:**
  - **Alle** (Standard, wie heute) · **Eigene zuerst** · **Nur eigene** · **Meine Station**.
  - „Eigen“ heißt: vom aktiven Bediener, sonst von diesem Gerät, bei persönlichen Konten von der Person.
  - Zusätzlich „Nach Herkunft gruppieren“ (das Issue).
- **Anzeige:** Jede Zeile zeigt Name und Farbe der Herkunft. „Wird gemacht“ zeigt, wer den Eintrag bearbeitet.
- **Korrekturen nebenbei:**
  - Sendestatus je Eintrag statt je Cocktail.
  - Den toten „chronologisch“-Zweig in „Wird gemacht“ entfernen.

### 8.2 Live-Aktualisierung (Server-Sent Events)

**Heute:**
- Jedes Gerät fragt die Queue jede Sekunde ab, mit 3–4 Datenbankabfragen pro Anfrage.
- 10 Tablets machen damit dauerhaft 30–40 Abfragen pro Sekunde, auch ohne Bestellungen.
- Neue Einträge erscheinen erst bis zu einer Sekunde später.

**Lösung:**
- **Endpunkt:** `GET /api/v1/workspaces/{id}/events` (`text/event-stream`), für Sitzung oder Gerät.
  - Der Browser hält eine Verbindung pro Tab mit dem eingebauten `EventSource` (keine neue Abhängigkeit).
  - Geschrieben wird weiter mit normalen Anfragen.
  - API-Keys nutzen den Stream nicht und fragen weiter ab.
- **Verteilung:**
  - Jede schreibende Queue-Transaktion ruft `pg_notify('cm_events', …)` mit Bar und Thema. Postgres stellt die
    Nachricht erst beim Commit zu, zurückgerollte Änderungen melden also nichts.
  - Jede App-Instanz hält eine eigene `LISTEN`-Verbindung (`pg`), mehrere Instanzen funktionieren damit ohne Redis.
  - Pro Änderung lädt der Server die Queue der Bar **einmal** und schickt sie an alle offenen Verbindungen dieser Bar.
    Der Inhalt ist für alle gleich, ohne E-Mails.
- **Stabilität:**
  - Heartbeat alle 25 Sekunden (Proxys trennen sonst; Cloudflare nach 100 Sekunden).
  - Header: `Cache-Control: no-cache, no-transform` und `X-Accel-Buffering: no` (nginx puffert sonst).
  - Kompression und Service Worker lassen den Stream in Ruhe (zu prüfen und zu testen).
- **Rechte:**
  - Prüfung beim Aufbau, danach alle 60 Sekunden.
  - Widerruf von Gerät oder Bediener schickt ein eigenes Ereignis und schließt die Verbindung sofort.
- **Rückfall:** Kommt keine Verbindung zustande, fragt der Client alle 5 Sekunden ab. Gründe: Proxy puffert, PgBouncer
  im Transaktionsmodus verhindert `LISTEN`, alter Browser. Die Abfrage-Antwort trägt ein ETag, unverändert ist sie 304
  ohne Inhalt.
- **Tab im Hintergrund:** Verbindung zu. Beim Zurückkommen sofort neu laden und neu verbinden.
- **Weitere Themen auf demselben Kanal:** Gerät widerrufen, Bediener gesperrt (andere Tabs), Ankündigungen,
  Plan-Status.

**Warum nicht WebSocket:**
- Das bräuchte einen eigenen Server neben dem Next-Standalone-Server.
- Jeder Reverse-Proxy der Self-Hoster bräuchte eine Upgrade-Konfiguration.
- Den Rückkanal braucht niemand.

SSE ist normales HTTP und läuft durch dieselben Proxys wie heute.

**Last:**
- Im Leerlauf keine Datenbankabfragen (nur Heartbeats).
- Pro Änderung eine Abfrage für alle Geräte der Bar.
- Eine offene Verbindung kostet im Node-Prozess wenige Kilobyte, 1.000 Tablets also einige Megabyte.
- Die Rechte-Nachprüfung kostet pro Gerät eine Abfrage pro Minute.

## 9. Statistik, Zuordnung und Datenschutz

- **`CocktailStatisticItem`** bekommt `profileId` und `deviceId` (optional, `NULL` beim Löschen). `userId` behält seine
  Bedeutung:
  - Konto: die Person
  - Profil eines Mitglieds: das Mitglied
  - Profil ohne Konto oder anonym: `NULL`
- **`AuditLog`** bekommt `profileId` und `deviceId` (optional) für Änderungen über Geräte.
- **Buchungs-Logs:** „Hinzugefügt von“ zeigt Person, Profil oder Gerät.
- **Datenschutz und Mitbestimmung:** Wer welchen Drink macht, ist Leistungs- und Verhaltenskontrolle von Beschäftigten.
  Das betrifft die DSGVO (Datenminimierung, Zweckbindung, Information der Beschäftigten) und bei Betriebsrat die
  Mitbestimmung (§ 87 Abs. 1 Nr. 6 BetrVG). Deshalb:
  - **„Personen zuordnen“:** Bar-Einstellung, Standard **aus**.
    - aus: Gespeichert wird nur das Gerät; Profile dienen nur der Berechtigung, und Queue-Herkunft zeigt nur das Gerät.
    - an: Das Profil wird gespeichert, mit Erklärungstext.
  - Personenbezogene Auswertungen nur für MANAGER und höher; im Gerätemodus keine.
  - Bediener-Sitzungen (wer war wann aufgeschaltet) werden 90 Tage aufbewahrt, dann gelöscht.
  - Hinweis für Betreiber in der Doku (kein Rechtsrat).

## 10. Pläne und Abrechnung

### 10.1 App

- **Schlüssel:** neues Feature `devices` und Limit `devices`; gezählt werden gekoppelte, nicht widerrufene Geräte.
- **Self-Hosting** (`ENTITLEMENTS_MODE=off`): Feature immer an, keine Limits, keine zusätzlichen Abfragen.
- **`managed`:**
  - Koppeln braucht das Feature und freien Platz (sonst 402 mit Limit-Dialog).
  - Fällt das Feature weg, zeigen Geräte „Für dieses Gerät ist ein Bar-Tarif nötig“. Sie bleiben gekoppelt und
    funktionieren wieder, sobald der Tarif zurück ist (wie API-Keys).
  - Über dem Limit nach einer Herabstufung laufen bestehende Geräte weiter, nur neue Kopplungen sind gesperrt
    (dieselbe Regel wie bei allen Limits).
  - `READ_ONLY` und `SUSPENDED` gelten auch für Geräte.
- **Profile:** zählen nicht als Mitglieder; technische Obergrenze 200 pro Bar.
- **Ältere Control Planes** senden weder `devices` noch das Feature. Gehostete Geräte bleiben dann aus, bis die Control
  Plane den neuen Katalog hat. Das ist der sichere Standard.

### 10.2 Control Plane (Repo `admin`) und Preise

**Preisstaffel** (netto, Bar Pro; jährlich 20 % günstiger wie Tarif und Sitzplätze):

| Geräte | Preis je Gerät und Monat | jährlich je Gerät |
| --- | --- | --- |
| 1–2 | inklusive | inklusive |
| 3–5 | 5,00 € | 48,00 € |
| 6–10 | 4,00 € | 38,40 € |
| ab 11 | 3,00 € | 28,80 € |

| Beispiel | Monatlich (Bar Pro 15 € + Geräte) |
| --- | --- |
| 2 Geräte | 15,00 € |
| 4 Geräte | 25,00 € |
| 8 Geräte | 42,00 € |
| 15 Geräte | 65,00 € |

**Begründung:**
- Kassensysteme verlangen je Gerät 35–40 € im Monat (orderbird 39,90 €, ready2order 35,90 €), wegen TSE und
  Fiskalisierung. Der Cocktail-Manager ergänzt die Kasse, er ersetzt sie nicht, und liegt deshalb klar darunter.
- Ein Gerät ersetzt mehrere persönliche Konten und kostet deshalb mehr als ein Sitzplatz (3 €).
- Die Staffel macht große Betriebe nicht unverhältnismäßig teuer. Ab etwa 15 Geräten ist Enterprise das Gespräch.

**Tarife:**
- Homebar Free und Plus: ohne Geräte.
- Enterprise und Partner: unbegrenzt.

**Umsetzung:**
- **Vertrag:** `limits.devices` (optional) und Feature `devices` in `instance-api.openapi.yaml`; die Instanz-API meldet
  `usage.devices`.
- **Preise:**
  - Neuer Preistyp `DEVICE` als **gestaffelter Stripe-Preis** (`billing_scheme: tiered`, `tiers_mode: graduated`) auf
    die Zusatzgeräte.
  - Lookup-Keys `bar_pro_device_month` und `bar_pro_device_year`.
  - Katalog und Datenbank kennen dafür Staffeln. Der Katalog-Abgleich vergleicht sie; eine Änderung erfordert einen neuen
    Lookup-Key.
- **Abo:** `Subscription.extraDevices` und `withDevices()` analog zu `withSeats()`. Kauf im Checkout und auf der
  Portal-Seite _Geräte_ (wie _Sitzplätze_), mit Vorschau über die Stripe-Rechnungsvorschau.
- **Anzeige:**
  - Portal-Tabelle „Limits und Nutzung“: neue Zeile Geräte.
  - Tarifvergleich: „2 Geräte inklusive, weitere ab 5 €“.
  - Backoffice: Plan-Editor, Nutzung an der Bar, Kennzahlen.
- **Fake-App:** Geräte-Nutzung und Feature.
- **Reihenfolge:** Control Plane vor dem App-Release ausrollen.

## 11. Oberfläche

- **Startseite:** „Als Bar-Gerät anmelden“ mit Code-Feld und QR-Hinweis.
- **Gerätemodus (Kopfzeile):**
  - Gerätename, Bediener-Chip (Farbe, Name) oder „Anonym“, Knopf „Sperren“.
  - Menü: Profil wechseln, Persönlich anmelden, Gerät entkoppeln (nur MANAGER-Bediener).
- **Profilauswahl:**
  - Große Kacheln und ein großes PIN-Tastenfeld.
  - Sperranzeige bei Fehlversuchen.
  - Sperrhinweis 30 Sekunden vor dem automatischen Sperren.
- **Bartender-Ansicht:** Stationen hervorgehoben oder gefiltert, Queue mit Filter-Chips, Herkunft je Zeile und
  Live-Aktualisierung.
- **Verwaltung im Gerätemodus:** Mit MANAGER-Bediener sind die Inhaltsseiten erreichbar (Abschnitt 4.4), alle anderen
  zeigen „Bitte persönlich anmelden“.
- **Verwaltung (persönlich):**
  - Einstellungen → _Geräte_ (Liste, Anlegen mit Code, Konfiguration, Widerruf), _Profile_, _Stationen_, Gerätestandards
    der Bar (Sperrzeit, PIN-Länge, Personen zuordnen)
  - Karten-Editor: Stationen je Gruppe
  - Profil-Menü: _Mein Bar-Profil_
- **Plan-Anzeige:** „x von y Geräten“, Limit-Dialog beim Koppeln.
- **Kiosk-Komfort:**
  - Bildschirm wach halten (`navigator.wakeLock`, abschaltbar).
  - Nach Inaktivität zurück zur aktiven Karte.
  - Installierbar (PWA vorhanden).
- **Im Gerätemodus aus:** „Abo verwalten“, Touren für Neuanlage.
- **Sprache und Touren:** alles de/en, Tour-Anker `bar.*` bleiben.

## 12. Sicherheit

| Risiko | Maßnahme |
| --- | --- |
| Tablet geht verloren | Sofortiger Widerruf (kein Cookie-Cache, Ereignis schließt offene Streams), absolute Laufzeit, Bediener-Sperre nach Inaktivität |
| Gerät sieht zu viel | Positivliste je Operation, keine E-Mails, kein Audit-Log, keine Einstellungen |
| PIN raten | Fehlerbudget pro Profil und Gerät in der Datenbank, steigende Sperre, bcrypt, Audit der Sperren |
| Gerätecode raten | ~40 Bit, 15 Minuten, einmalig, Hash, Rate-Limit pro IP und globales Budget |
| Rechteausweitung | Höchstrolle je Gerät (nie ADMIN/OWNER), `manage` nur für Mitgliederprofile, `withAuthentication` lehnt Geräte ab |
| Fremde Bar | Gerät an eine Bar gebunden, Tenant-Isolation-Tests mit Gerät und Bediener |
| CSRF | SameSite=Lax, Kopplung nur als POST vom gleichen Ursprung, CORS ohne Credentials |
| Stille Fallbacks | Der unsignierte Sitzungs-Fallback der Middleware gilt nicht für Geräte; Schlüssel nur als Hash |
| Offline-Daten | Geräte behalten den Offline-Cache ihrer Bar; Entkoppeln und Widerruf leeren ihn; Bediener-Daten nie offline |
| Stream-Missbrauch | Höchstens 5 offene Streams pro Gerät bzw. Sitzung, Rechte-Nachprüfung alle 60 Sekunden |
| Nachvollziehbarkeit | Audit für Koppeln, Widerruf, Konfiguration, Profil anlegen, PIN zurücksetzen, Sperren, Änderungen über Geräte |

## 13. Was sich nicht ändern darf

- **Ohne Geräte, Profile und Stationen** verhält sich die App exakt wie vorher: Ansichten, Antworten bestehender Routen,
  Fehlercodes. Die einzige Ausnahme: Die Queue aktualisiert sich live statt jede Sekunde, mit Rückfall auf Abfragen.
- **Queue-Regeln:**
  - atomarer Verbrauch mit `SKIP LOCKED` in derselben Transaktion wie die Buchung
  - Notiz-Normalisierung, 404 bei leerer Übereinstimmung, `STATISTIC_QUEUE_AMBIGUOUS`
  - Queue nie offline gecacht
- **Rechte:** Bestehende Rollen und API-Key-Rechte bleiben. Neue API-Key-Rechte gibt es nur für neue Operationen:
  `DEVICES_READ`, `DEVICES_UPDATE`, `PROFILES_READ`, `PROFILES_UPDATE`, `STATIONS_READ`, `STATIONS_UPDATE`.
- **Statistik:** „Hinzugefügt von“ heißt weiter „wer gebucht hat“; der Master-Key bucht weiter mit `NULL`.
- **Migrationen:** nur neue Tabellen und optionale Spalten; neue Enum-Werte per `ALTER TYPE … ADD VALUE`.
- **Backups:** Stationen und ihre Gruppenzuordnung kommen ins Backup (abwärtskompatibel). Geräte, Profile, PINs und
  Sitzungen nie.

## 14. Datenmodell (Entwurf)

```prisma
model BarStation {
  id          String  @id @default(cuid())
  workspaceId String  // Cascade
  name        String
  color       String?
  sortOrder   Int     @default(0)
}

model CocktailCardGroupStation {
  groupId   String // CocktailCardGroup, Cascade
  stationId String // BarStation, Cascade
  @@id([groupId, stationId])
}

model WorkspaceDevice {
  id                String            @id @default(cuid())
  workspaceId       String            // Cascade
  name              String
  tokenHash         String            @unique
  baseAccess        DeviceAccess      @default(BAR)     // VIEW | ORDER | BAR
  maxRole           Role              @default(MANAGER)
  requireOperator   Boolean           @default(false)
  groupMode         DeviceGroupMode   @default(ALL)     // ALL | HIGHLIGHT | ONLY
  allowShowAll      Boolean           @default(true)
  queueFilter       DeviceQueueFilter @default(ALL)     // ALL | MINE_FIRST | MINE_ONLY | STATION
  autoLockSeconds   Int?              // null = Standard der Bar
  language          String?
  theme             String?
  pairedAt          DateTime          @default(now())
  pairedByUserId    String?           // SetNull
  expiresAt         DateTime
  lastSeenAt        DateTime?
  userAgent         String?
  revokedAt         DateTime?
  failedPinAttempts Int               @default(0)
  pinLockedUntil    DateTime?
}

model DevicePairingCode {
  id          String    @id @default(cuid())
  workspaceId String    // Cascade
  codeHash    String    @unique
  template    Json      // Name, Stationen, Grundstufe, Höchstrolle, Anzeige, Sperrzeit
  maxUses     Int       @default(1)
  uses        Int       @default(0)
  expiresAt   DateTime
  createdById String?   // SetNull
  revokedAt   DateTime?
}

model WorkspaceProfile {
  id             String    @id @default(cuid())
  workspaceId    String    // Cascade
  displayName    String
  color          String
  pinHash        String
  pinVersion     Int       @default(1)
  linkedUserId   String?   // Mitglied, SetNull; @@unique([workspaceId, linkedUserId])
  archivedAt     DateTime?
  failedAttempts Int       @default(0)
  lockedUntil    DateTime?
  lastUsedAt     DateTime?
}

model DeviceOperatorSession {
  id             String    @id @default(cuid())
  deviceId       String    // Cascade
  profileId      String    // Cascade
  tokenHash      String    @unique
  pinVersion     Int
  startedAt      DateTime  @default(now())
  lastActivityAt DateTime  @default(now())
  endedAt        DateTime?
  endReason      String?   // LOCK | TIMEOUT | REVOKED | PIN_CHANGED | MAX_AGE
}

// Bestehende Modelle, nur optionale Spalten:
// CocktailQueue: createdByUserId, createdByProfileId, createdByDeviceId, stationId,
//                inProgressByUserId, inProgressByProfileId, inProgressByDeviceId, inProgressAt
// CocktailStatisticItem: profileId, deviceId
// AuditLog: profileId, deviceId
// WorkspaceSetting-Schlüssel: attributeProfiles, minPinLength, deviceAutoLockSeconds
```

## 15. API

**Verwaltung:**
- Wer darf was:
  - Sitzung mit MANAGER, sofern nicht anders angegeben.
  - API-Keys mit den neuen Rechten aus Abschnitt 13.
  - Geräte nie, außer Stationen mit `manage`.
- Operationen:
  - `GET/POST /workspaces/{id}/stations`, `PATCH/DELETE …/stations/{stationId}`
  - Karten: `stationIds` je Gruppe im bestehenden Karten-Body. Optional; fehlt es, bleibt die Zuordnung.
  - `GET /workspaces/{id}/devices`, `PATCH/DELETE …/devices/{deviceId}`, `POST …/devices/revoke-all`
  - `GET/POST /workspaces/{id}/devices/pairing-codes`, `DELETE …/pairing-codes/{codeId}`. Der Code steht im Klartext
    nur in der POST-Antwort.
  - `GET/POST /workspaces/{id}/profiles`, `PATCH/DELETE …/profiles/{profileId}`, `POST …/profiles/{profileId}/reset-pin`
  - `PUT /workspaces/{id}/profiles/me` (Sitzung, jede Rolle): eigenes Profil und PIN
  - Gerätestandards der Bar als neue `WorkspaceSetting`-Schlüssel (ADMIN wie die übrigen Einstellungen)

**Gerät** (handgeschrieben, eigene Tests):
- `POST /api/device/pair`: öffentlich, Rate-Limit, setzt `cm-device`
- `GET /api/device`: Gerät, Bar, Konfiguration, Stationen, Bediener, Plan-Status
- `POST /api/device/unpair`
- `GET /api/device/profiles`: Name, Farbe, Sperrstatus
- `POST /api/device/operator` mit Profil-ID und PIN, setzt `cm-operator`; `DELETE /api/device/operator` sperrt

**Echtzeit:** `GET /api/v1/workspaces/{id}/events` (Sitzung oder Gerät, `text/event-stream`).

**Bestehende Routen:**
- Sie bekommen `device: 'read' | 'bar' | 'manage'` nach Abschnitt 4.4.
- Die Queue-Ausgabe erhält `origin` und `inProgressBy`.
- „Erledigt“ und „Ablehnen“ akzeptieren `queueItemId`.
- `GET /queue` antwortet mit ETag und 304.

**OpenAPI:** neues Sicherheitsschema „Gerät“ und je Operation der Vermerk `device`.

## 16. Tests

- **Auth-Matrix:** Gerät und Bediener als neue Aufrufer.
  - Jede Operation ohne `device` lehnt ab.
  - `bar` lehnt `VIEW` ab.
  - `manage` lehnt Profile ohne Konto und USER-Mitglieder ab.
  - Gerät einer anderen Bar wird abgelehnt.
  - `withAuthentication`-Routen lehnen Geräte ab.
- **Tenant-Isolation:** Gerät und Bediener als Aufrufer; der Fingerabdruck der fremden Bar bleibt unverändert.
- **Integration:**
  - Koppeln: einmalig, abgelaufen, mehrfach, Limit, fehlendes Feature
  - Widerruf wirkt sofort
  - PIN: falsch, Sperre, Zurücksetzen beendet Sitzungen
  - Sperrzeit: Standard der Bar und Gerätewert
  - Höchstrolle, entferntes Mitglied
  - Queue mit Herkunft und Einzelverbrauch, auch mit gleichzeitigen Geräten; alte Clients ohne `queueItemId`
  - Statistik und Audit mit „Personen zuordnen“ an und aus
  - Stationen in Karten, Klonen und Backup
  - `off` gegen `managed`
- **Echtzeit:**
  - `NOTIFY` erst nach Commit
  - Fan-out über zwei Prozesse
  - Heartbeat
  - Schließen bei Widerruf
  - Rückfall auf Abfrage mit ETag/304
  - Antwort bei Kompression und hinter einem puffernden Proxy (nginx-Test-Setup)
- **Unverändert-Test:** Antworten bestehender Routen ohne Geräte und Stationen gleich wie vorher.
- **Komponenten:** Profilauswahl, PIN-Feld, Sperren, Gruppenanzeige, Queue-Filter, Gerätemodus-Kopfzeile.
- **E2E im Browser:**
  1. Gerät koppeln, anonym bestellen
  2. Profil aufschalten, als „wird gemacht“ übernehmen, erledigen
  3. Zweites Gerät mit anderer Station: sieht nur seine Gruppen, mit „Nur eigene“ nur seine Queue, und Änderungen
     erscheinen ohne Neuladen
  4. MANAGER-Bediener bearbeitet eine Karte auf dem Gerät
  5. Gerät widerrufen: nächste Anfrage und offener Stream abgemeldet
- **Control Plane:** Katalog mit Staffeln, Snapshot mit `devices`, Zukauf, Portal-Seite, Fake-App.

## 17. Umsetzung

Ein Branch, ein PR (`feat/device-access`, zuerst gegen `feat/instance-api`, nach dessen Merge gegen `main`). Ein
Commit je Stufe, jede Stufe für sich lauffähig. Subagenten setzen um, jede Stufe wird geprüft, bevor die nächste darauf
aufbaut. Die Migrationen aller Stufen werden vor dem Merge zu einer zusammengefasst, solange nichts ausgerollt ist.

| Stufe | Inhalt | Abhängig von | Parallel zu |
| --- | --- | --- | --- |
| 1 | Queue: Herkunft und Bearbeiter (zunächst Personen), Einzelverbrauch, Filter, Gruppierung, Live-Aktualisierung per SSE mit Rückfall | – | 2, 6 |
| 2 | Stationen: Modell, Verwaltung, Zuordnung im Karten-Editor, Klonen und Backup, Gruppenanzeige für persönliche Konten | – | 1, 6 |
| 3 | Geräte: Modell, Gerätecodes, Gerätezugang in der Middleware, Positivliste (`read`/`bar`), Gerätemodus der Oberfläche, Verwaltung, Gerätestandards der Bar | 1, 2 | 6 |
| 4 | Profile und Bediener: PIN, Sitzungen, Sperren, Höchstrolle, `manage`-Umfang mit Verwaltungsseiten, Zuordnung in Queue, Statistik und Audit, Datenschutz-Einstellung | 3 | 6 |
| 5 | Plan-Anbindung in der App (Feature und Limit `devices`) | 3, A2 | 6 |
| 6 | Control Plane: Vertrag, Katalog mit Staffelpreis, Zukauf `DEVICE`, Portal-Seite, Backoffice, Fake-App | – | 1–5 |
| 7 | E2E mit echter App und Control Plane, Doku (App-Doku, Benutzerdoku, Betreiberhinweis Datenschutz), Migrationen zusammenfassen | alle | – |

## 18. Noch offen

- **Preise:** Die Staffel in 10.2 ist ein Vorschlag. Vor dem ersten Live-Abgleich mit Stripe lässt sie sich frei
  ändern, danach nur über neue Lookup-Keys.
