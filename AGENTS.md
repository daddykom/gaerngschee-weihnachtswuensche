# AGENTS.md

Project information for AI assistants. This file is an **index** - see linked documents for details.

## Project Overview

**Gärngschee-Weihnachtswünsche** - Open-source Webplattform für die Verwaltung von Spenden und die Verteilung von Weihnachtswünsche an Menschen mit knappen finanziellen Mitteln.

→ See: [openspec/specs/weihnachtswuensche.md](./openspec/specs/weihnachtswuensche.md)

## Documentation Structure

```text
gaerngschee/
├── AGENTS.md                    # This file (index)
├── documents/                   # Human-readable documentation
│   ├── project.md              # Project overview
│   ├── architecture.md         # System architecture
│   ├── frontend-conventions.md # Angular patterns (View/Container)
│   ├── ui-design.md            # UI- und Layout-System
│   ├── backend-conventions.md  # PHP patterns
│   └── database-conventions.md # Database migrations
└── openspec/
    └── specs/                   # Capability specifications
```

## Quick Links

### For Humans

- [openspec/specs/weihnachtswuensche.md](./openspec/specs/weihnachtswuensche.md) - Fachkonzept
- [documents/project.md](./documents/project.md) - Project overview
- [documents/architecture.md](./documents/architecture.md) - System architecture
- [documents/directory-structure.md](./documents/directory-structure.md) - Aktuelle Verzeichnisstruktur
- [documents/ui-design.md](./documents/ui-design.md) - Verbindliches UI- und Layout-System

### For AI Assistants

- [openspec/specs/authentication/spec.md](./openspec/specs/authentication/spec.md) - User authentication & roles
- [openspec/specs/registrations/spec.md](./openspec/specs/registrations/spec.md) - Anmeldungen
- [openspec/specs/donations/spec.md](./openspec/specs/donations/spec.md) - Erfüllung einzelner Weihnachtswünsche
- [openspec/specs/platform/spec.md](./openspec/specs/platform/spec.md) - PWA, i18n, a11y
- [documents/frontend-conventions.md](./documents/frontend-conventions.md) - Angular-Konventionen
- [documents/ui-design.md](./documents/ui-design.md) - UI- und Layout-Regeln

## View/Container Pattern

Angular components follow the View/Container pattern:

| Pattern | Description |
|---------|-------------|
| **ViewComponent** | Pure presentation, `@Input()`/`@Output()` only, no services |
| **ContainerComponent** | Manages state, injects Store/services, dispatches actions |

See: [documents/frontend-conventions.md](./documents/frontend-conventions.md#viewcontainer-pattern)

### Store- und Formulararchitektur

- Der Inhalt eines Angular-Formulars wird immer vollständig im zuständigen
  NgRx-Store gehalten und von dort in das Formular übertragen.
- Der reaktive Datenfluss ist immer: Control-Änderung → Store-Action →
  Reducer → Store → Selector → Formular-Darstellung.
- Eine Formularänderung verwendet genau eine gemeinsame Update-Action mit
  `Partial<Form>`. Das Partial enthält ausschließlich die geänderten Felder.
- Der Reducer übernimmt Formularänderungen immutable mit
  `form: { ...state.form, ...partialForm }`.
- NgRx-Actions bezeichnen immer eingetretene Ereignisse und keine Befehle.
- Asynchrone Zustände werden als discriminated union mit expliziten Zuständen
  wie `initial`, `loading`, `loaded` und `error` modelliert. Parallele Boolean-
  Flags für denselben Ladeprozess sind zu vermeiden.
- Ein separater Draft-Zustand außerhalb der eigentlichen Formularstruktur ist
  nicht zulässig.
- Feldbezogene Validierungsfehler werden nur für `touched` Controls angezeigt.
  Initial unberührte Controls zeigen keine Fehlermeldung. Ungültiges Absenden
  markiert die betroffenen Controls als `touched`, damit ihre Fehler angezeigt
  werden.

### Initiales Laden und Resolver

- Initiales Laden von Seitendaten erfolgt über einen Route-Resolver.
- Der Resolver dispatcht das Ladeereignis, wartet auf den passenden geladenen
  oder fehlerhaften Store-Zustand und gibt danach die Navigation frei.
- Bei verschachtelten Routen liegt der Resolver auf der gemeinsamen Parent-
  Route, wenn die Child-Routen denselben Datenkontext verwenden. Die Navigation
  zwischen diesen Child-Routen darf dadurch keinen erneuten Ladevorgang
  auslösen.
- Der Cursor wird ausschließlich während der Wartezeit innerhalb des
  Resolvers als `progress` dargestellt. Vor der Freigabe bei `loaded` oder
  `error` wird er zurückgesetzt. Allgemeine Router-Navigationen setzen den
  Progress-Cursor nicht.

### Fehleranzeige bei initialem Laden

- Fehler beim initialen Laden werden nicht durch eine dauerhaft blockierte
  Navigation verborgen.
- Nach einem Ladefehler wird die Navigation freigegeben und der Fehler über
  den globalen Notification-Store in der zentralen Informationszone
  angezeigt.
- Die betroffene Route bleibt für die Fehleranzeige erhalten und kann bei
  Bedarf einen erneuten Ladeversuch anbieten.

## UI Design

Das Frontend verwendet ein verbindliches, Mobile-First UI- und Layout-System.

Vor Änderungen an Page-Templates, Formularen oder Layout-Styles MUSS [documents/ui-design.md](./documents/ui-design.md) gelesen und befolgt werden.

Grundprinzipien:

- Angular Material stellt die UI-Controls bereit.
- Das Gärngschee-Layout-System bestimmt Anordnung, Breite und Abstände.
- Der Parent bestimmt den verfügbaren Raum und die Anordnung seiner Children.
- Components beanspruchen grundsätzlich die gesamte vom Parent bereitgestellte Breite.
- Components bestimmen ihr internes, aber nicht ihr externes Layout.
- Mobile ist das Standardlayout; breitere Layouts sind progressive Erweiterungen.
- Reines Layout wird grundsätzlich über die vorhandenen globalen `gl-*` Layout-Primitives umgesetzt, nicht über Angular Components.
- Vor neuem komponentenspezifischem Layout-CSS müssen die bestehenden Layout-Primitives geprüft und verwendet werden.
- Das semantische Farbsystem mit Farbrollen und Hex-Werten ist in [documents/ui-design.md#farbsystem](./documents/ui-design.md#farbsystem) verbindlich dokumentiert.
- Seitenweite Informationen, Warnungen, Erfolgs- und Fehlermeldungen werden über den globalen Store gespeist und in der zentralen Informationszone dargestellt.
 - Feldbezogene Validierungsfehler werden ausschliesslich über die bestehende `ControlErrorComponent` dargestellt.
 - Beschriftungen von Formularfeldern werden über `mat-label` innerhalb des zugehörigen `mat-form-field` dargestellt; separate Labels ausserhalb des Material-Formularfelds werden nicht verwendet.
 - Feldbezogene `app-control-error`-Komponenten stehen als letztes Element im zugehörigen `mat-form-field` und werden mit `matError` als Material-Fehlerbereich markiert. Formularübergreifende Fehler werden beim fachlich zugehörigen Feld angezeigt.

Als Leitlinie gilt:

> **Das Child kennt seinen Inhalt. Der Parent kennt den Raum.**

## Backend-Struktur

Das Backend verwendet eine fachlich organisierte Struktur unter `backend/src/`:

```text
src/
├── Auth/
│   ├── Actions/
│   ├── Data/
│   └── Services/
├── Configuration/
│   ├── Actions/
│   └── Data/
├── Fairgate/
│   ├── Actions/
│   └── Services/
├── Registration/
│   ├── Actions/
│   └── Services/
├── Users/
│   ├── Actions/
│   └── Data/
├── Shared/
│   ├── Database/
│   ├── Http/
│   └── Mail/
├── Middleware/
├── PublicApi/
├── Routes/
└── Application.php
```

- Routes registrieren HTTP-Methode, Pfad, Action und Middleware. Sie enthalten keine Fachlogik.
- Actions verarbeiten einzelne Anwendungsfälle und geben PSR-7-Responses zurück.
- Services enthalten fachliche oder externe Integrationen und liegen im zuständigen Modul.
- Datenbankzugriff liegt im zuständigen `Data/`-Verzeichnis; gemeinsame Datenbank-Infrastruktur liegt unter `Shared/Database/`.
- Wiederverwendbare HTTP- und Mail-Helfer liegen unter `Shared/`.
- Namespace und Verzeichnis müssen der PSR-4-Struktur entsprechen.
- Die Admin-Fairgate-Testroute `/admin/fairgate/test` wird in `Routes/AdminRoutes.php` registriert und verwendet `Fairgate/Actions/FairgateTestAction`.
- Die früheren Sammelpfade `App\Services` und `App\Data` werden nicht mehr verwendet.
- Fairgate-, Mail-, Datenbank- und JWT-Konfiguration werden aus der jeweiligen Environment-Datei geladen. `backend/.env` ist ausschließlich für die lokale Developer-Datenbank bestimmt. `backend/.env.integration` wird ausschließlich von der Integrationsumgebung verwendet. Pre-Production- und Production-`.env`-Dateien werden auf den jeweiligen Servern bereitgestellt und existieren nicht im Repository.
- `APP_ENV` akzeptiert `test` oder `prod`. `FSA_MODE` steuert den Fairgate-Zugriff mit `fake` oder `real`; fehlt der Wert, wird aus `APP_ENV` abgeleitet. Die `FairgateContactProviderFactory` verwendet diesen Modus für alle Fairgate-Zugriffe, einschliesslich `GET /admin/fairgate/test`.
- Die E-Mail-Adresse der Admin-Fairgate-Testroute wird aus dem Konfigurationsschlüssel `fairgate_test_email` der Tabelle `frontend_config` gelesen. Seeds für Development, Pre-Production, Integration und Production legen `isabelle.joss@gaerngschee.ch` an.

### Datenbankumgebungen und Seeds

- Phinx-Migrationen sind für `development`, `test` und `production` registriert. `test` ist die technische Phinx-Umgebung der Integrationstests; Pre-Production verwendet wegen `APP_ENV=prod` die technische Phinx-Umgebung `production`.
- Die lokale `backend/.env` gehört zur Developer-Datenbank. Basisdaten werden durch Migrationen angelegt.
- `backend/.env.integration` gehört ausschließlich zur Integrationsdatenbank und verwendet `db/seeds/integration/`. Integration-Seeds dürfen zusätzliche Test-Fixtures wie den Testbenutzer enthalten.
- Pre-Production und Production verwenden auf dem Server eine nicht versionierte `.env`. Basisdaten werden durch Migrationen angelegt; Integrationstest-Fixtures liegen unter `db/seeds/integration/`.
- Es werden keine Pre-Production- oder Production-`.env`-Dateien im Repository angelegt oder mit produktiven Zugangsdaten befüllt.
- Die Migration für die Basisdaten legt den Initial-Admin mit `required_password_reset = false` an. Die Erstinstallation muss das Initialpasswort anschliessend manuell ändern.
- Strukturelle Änderungen und notwendige Basisdaten werden als Phinx-Migration umgesetzt. Seeds dienen ausschliesslich zusätzlichen Test-Fixtures.

## Backend-Tests

Backend-Tests folgen ebenfalls der fachlichen Struktur:

```text
tests/
├── Auth/
├── Fairgate/
├── Registration/
├── Shared/
├── Users/
├── Middleware/
├── Routes/
└── Support/
```

Gemeinsames SQLite-Testsetup und Test-Doubles liegen unter `tests/Support/` und werden über `tests/bootstrap.php` geladen. Fachlogik soll direkt auf Action- oder Service-Ebene getestet werden; Route-Tests prüfen primär Registrierung und Middleware-Verhalten.

### Frontend- und Backend-Änderungen

Nach Änderungen unter `frontend/` oder `backend/` müssen die Playwright-E2E-Tests ausgeführt werden:

```bash
cd frontend && npm run test:e2e:cli
```

Zusätzlich sollen die für den geänderten Bereich relevanten Unit- bzw. Integrationstests ausgeführt werden. Die E2E-Tests benötigen den Frontend- und Backend-Entwicklungsserver sowie die erforderlichen Testdaten.

### Testauswahl nach jeder Änderung

Nach jeder Code- oder Konfigurationsänderung muss vor der Verifikation bewusst geprüft werden, welche Testebenen vom geänderten Verhalten betroffen sind. Die Prüfung und die daraus abgeleiteten Massnahmen müssen in der Arbeitszusammenfassung genannt werden.

Die Testebenen werden nach diesen Kriterien ausgewählt:

- **Jest** für isolierte Frontend-Logik, Reducer, Effects, Services und Komponentenverhalten ohne echtes Backend.
- **Playwright-E2E** für einen einzelnen Frontend-Routenfluss, Navigation, sichtbares UI-Verhalten und browserbezogene Akzeptanzkriterien mit Mock-API.
- **PHPUnit** für Backend-Actions, Services, Repositories, Middleware und fachliche Regeln in isolierter Testumgebung.
- **Integrationstests** für Datenflüsse über mehrere Schichten, echte HTTP-Kommunikation zwischen Frontend und Backend, MariaDB, Migrationen, Seeds oder Test-Ersatzdienste wie Fake-Fairgate und Mailpit.

Für jede Änderung sind diese Schritte einzuhalten:

1. Den betroffenen Produktionsfluss und die passende(n) Testebene(n) identifizieren.
2. Prüfen, ob ein bestehender Test angepasst werden muss oder ein neuer Test fehlt.
3. Vor der Umsetzung oder spätestens vor Abschluss konkrete Testmassnahmen vorschlagen.
4. Die relevanten Tests ausführen und Ergebnisse sowie nicht ausgeführte Tests mit Begründung dokumentieren.
5. Bei Änderungen an `frontend/` oder `backend/` zusätzlich `cd frontend && npm run test:e2e:cli` ausführen, sofern die erforderlichen Entwicklungsserver und Testdaten verfügbar sind.

### Abhängige Tests bei gemeinsamen Änderungen

Bei Änderungen an gemeinsam verwendeten Services, Fakes, Test-Doubles, Fixtures, Seeds, Konfigurationen oder API-Verträgen MUSS zuerst im gesamten Repository nach allen Verwendungen und abhängigen Testdaten gesucht werden. Es reicht nicht, nur den direkt zugehörigen Test auszuführen.

Alle durch die Änderung betroffenen Tests müssen aktualisiert und ausgeführt werden. Dazu gehören insbesondere Unit-, Integrations- und E2E-Tests, die den geänderten Datenvertrag oder das geänderte Verhalten indirekt verwenden. Bei Änderungen an einem Fake müssen sowohl die direkten Fake-Tests als auch alle Tests mit seinen simulierten Antworten geprüft werden.

Veraltete Erwartungen, Marker, E-Mail-Adressen oder Seed-Daten dürfen nicht bestehen bleiben. Die Arbeitszusammenfassung muss die geprüften Abhängigkeiten, die ausgeführten Testebenen und nicht verfügbare Testläufe dokumentieren.

Eine Testart darf nicht allein deshalb ausgelassen werden, weil eine andere Testart grün ist. Wenn eine Testebene nicht relevant ist, muss dies kurz begründet werden. Wenn ein Test einen bestehenden Fehler aufdeckt, darf der Produktionscode nicht ungefragt geändert werden; der Fehler ist zu melden und eine Korrektur muss abgestimmt werden.

## Fairgate-Datenstruktur

Die Fairgate-Abfrage liefert die erweiterten Kontaktdaten in folgender Struktur:

```json
{
  "email": "jane@doe.ch",
  "fairgate": {
    "success": true,
    "message": "Data retrieved successfully",
    "data": {
      "contactType": "single_person",
      "contactId": 1,
      "salutation": "Informal",
      "first_name": "Jane",
      "last_name": "Doe",
      "gender": "Female",
      "correspondence_lang": "de",
      "wohnt_im_gleichen_haushalt": "Ja",
      "name_und_vorname_kind1": "Baby Doe",
      "name_und_vorname_kind2": "Jonny Doe",
      "name_und_vorname_kind3": "",
      "geburtsdatum_kind1": "2019-03-28T00:00:00Z",
      "geburtsdatum_kind2": null,
      "gultig_bis": "2026-12-31T00:00:00Z"
    }
  }
}
```

Die Kinderfelder reichen von `name_und_vorname_kind1` bis `name_und_vorname_kind10` und von `geburtsdatum_kind1` bis `geburtsdatum_kind10`. Nicht vorhandene Kinder können als leerer String oder `null` geliefert werden.

Für die Weiterverarbeitung gelten folgende Regeln:

- Die Kinderanzahl entspricht der Anzahl nicht leerer `name_und_vorname_kindN`-Felder.
- `wohnt_im_gleichen_haushalt = "Ja"` ergibt zwei Erwachsene.
- Jeder andere Wert ergibt einen Erwachsenen.
- Die Anrede wird aus `correspondence_lang`, `gender` und `salutation` abgeleitet.
- Das Frontend erhält mindestens `fairgateUserExists`, `childrenCount`, `adultsCount` und `salutation`.

## Registrierungslink und Client-Login

- `POST /public/start` legt noch keinen Benutzer an.
- Die Route erstellt einen einmaligen Registrierungstoken und versendet einen Link an die angegebene E-Mail-Adresse.
- Registrierungstoken werden in der separaten Tabelle `registration_tokens` gespeichert, nur gehasht abgelegt und sind zehn Minuten gültig.
- `POST /auth/registration-login` konsumiert den Token.
- Erst beim erfolgreichen Token-Login wird ein neuer Benutzer mit der Gruppe `wunschbesteller` angelegt, falls noch keiner existiert.
- Bestehende `admin`- und `user`-Konten werden nicht in Client-Konten umgewandelt; die Antwort bleibt aus Sicherheitsgründen neutral.
- Nach dem Token-Login werden JWT, Client-Gruppe und die berechneten Fairgate-Werte an das Frontend geliefert.
- Das Frontend verarbeitet den Link unter `/client-login` und navigiert nach erfolgreichem Login zu `/order`.

### Bestellstatus

- Bestellungen werden pro Kunde und Kalenderjahr gespeichert.
- Die fachlichen Statuswerte lauten `draft`, `waiting_for_fairgate`, `released`,
  `family_size_exceeded`, `in_review`, `changes_requested`, `definitive`,
  `ready_for_pickup` und `completed`.
- `fairgateUserExists = true` ergibt beim Speichern den Status `released`.
- Jeder andere Fairgate-Status ergibt beim Speichern den Status
  `waiting_for_fairgate`.
- Sichtbare Übersetzungen dürfen diese technischen Werte lokalisieren.

## Arbeitsweise & Verhaltensregeln

### 1. Eigenständige Änderungen vermeiden

Du darfst Fehler oder Probleme im Code melden, aber DU SOLLST SIE NICHT EIGENMÄCHTIG KORRIGIEREN.

Immer erst fragen, bevor du:

- Tippfehler oder Syntaxfehler behebst
- Code umstellst oder restrukturierst
- Variablen oder Funktionen umbenennst
- Imports oder Dependencies änderst

**Beispiel:**

Du siehst einen Tippfehler in einer Variable. Frage nicht einfach "Fixed the typo", sondern:

> "Ich sehe einen Tippfehler in `userNme` → sollte das `userName` sein? Soll ich das korrigieren?"

---

### 2. Bestehende Tools verwenden

Für Konfiguration und Code-Generierung SOLLST DU IMMER die offiziellen Tools nutzen.

Konkrete Regeln:

- Nx: `nx generate`, `nx migrate`, `nx add` verwenden
- Angular: `ng generate`, `ng add`, `ng update` verwenden
- Niemals manuell Dateien ändern, wenn ein CLI-Tool existiert

### 2b. DB-Migrationen

Für alle Datenbank-Migrationen SOLL zwingend [Phinx](https://phinx.org/) verwendet werden. Niemals manuell SQL schreiben oder die DB-Struktur direkt ändern.

Wenn ein Agent eine Migration ausführt, darf ausschließlich die Developer-Datenbank (`development`) betroffen sein. Die Pre-Production- und Produktionsdatenbanken dürfen durch Agenten weder migriert noch zurückgerollt oder anderweitig strukturell verändert werden.

Siehe: [database-conventions.md](./documents/database-conventions.md)

**Beispiele:**

| Task | FALSCH | RICHTIG |
|------|--------|---------|
| Neue Component | Dateien manuell erstellen | `nx generate component` |
| Library hinzufügen | `package.json` manuell editieren | `nx add @nrwl/angular` |
| Migration | Manuelle File-Änderungen | `nx migrate` |

---

### 3. User-Änderungen respektieren

Wenn der User Code ändert, den du geschrieben hast, SOLLST DU DIESEN CODE NIE automatisch zurücksetzen oder überschreiben.

Bei Konflikten:

- NIEMALS automatisch "zurücksetzen" oder "wiederherstellen"
- IMMER erst nachfragen

**Beispiel:**

Du bemerkst, dass dein generierter Code geändert wurde. Frage:

> "Ich sehe, dass mein Code geändert wurde. Möchtest du, dass ich meine ursprüngliche Version wiederherstelle, oder soll ich mit deiner Version weiterarbeiten?"

---

### 3a. Keine Commits durch Agenten

Agenten dürfen niemals selbstständig Git-Commits erstellen oder bestehende Commits ändern. Dazu gehören insbesondere `git commit`, `git commit --amend`, Rebases, Merges und Pushes. Änderungen bleiben im Arbeitsverzeichnis; das Committen übernimmt ausschliesslich der Benutzer.

---

### 4. Bei Unsicherheit fragen

Wenn du dir nicht sicher bist, was der User will:

- FRAGE. Stelle Clarifying Questions.
- Nummeriere mehrere Rückfragen eindeutig, damit der User jede Frage separat beantworten kann.
- NICHT: Annahmen treffen und handeln
- NICHT: Mehrere Optionen gleichzeitig implementieren

## API-Konventionen

### Fehlerantworten

API-Fehler werden als JSON mit einem standardisierten Fehlerobjekt zurückgegeben:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

Wenn sinnvoll, wird zusätzlich der passende HTTP-Statuscode gesetzt.

### Login

Der Login verwendet `POST /auth/login` mit `email` und `password`.

- Die Zugangsdaten werden gegen einen Benutzer in der Datenbank geprüft.
- Das Passwort wird mit dem gespeicherten Hash verifiziert.
- Nur Benutzer mit der Gruppe `admin` oder `user` dürfen sich anmelden.
- Bei ungültigen Zugangsdaten oder nicht erlaubter Gruppe wird der Fehlercode `INVALID_CREDENTIALS` verwendet.
- Bei erfolgreichem Login werden `user_id` und `group` in die Session geschrieben.
- Die erfolgreiche Antwort enthält weiterhin ein JWT und die Benutzergruppe.

## Key Principles

- Open Source
- Mobile First / Accessibility First
- Privacy-friendly
- Low operating costs
- API-first between Frontend and Backend
- Clear separation of layers
- Lean Documentation - less, but correct and redundancy-free
- Reactive Frontend - NgRx with RxJS for async operations
- Functional Style - map/reduce/filter for data transformations

## E2E-Teststruktur

Playwright-E2E-Specs testen jeweils nur eine Route:

- `overview.spec.ts` testet `/admin/overview`.
- `login.spec.ts` testet `/login`.
- `start.spec.ts` testet `/start`.
- Tests für `/` liegen in einer separaten `root.spec.ts`.

Eine Spec DARF grundsätzlich keine Tests für mehrere unterschiedliche Routen enthalten. Authentifizierungs- und Redirect-Lifecycle-Tests dürfen die dafür notwendigen Zielrouten durchlaufen. Der Login-Lifecycle in `login.spec.ts` darf deshalb `/login` und den geschützten Übergang zu `/admin/overview` testen.

Lokalisierte Texte dürfen in Playwright-E2E-Assertions nicht als konkrete
Übersetzung hardcodiert werden. Für Textprüfungen sind semantische Locators
und der gemeinsame Helper `expectTranslatedText` unter
`frontend/e2e/support/assertions.ts` zu verwenden. Der Helper prüft, dass
sichtbarer Text vorhanden ist und nicht als Übersetzungsschlüssel gerendert
wird. Konkrete Übersetzungstexte dürfen nur geprüft werden, wenn sie selbst
das fachliche Testziel sind, beispielsweise bei statischen rechtlichen
Inhalten. Fachliche Testdaten, technische Werte und Locators für notwendige
Benutzerinteraktionen sind von dieser Regel nicht betroffen.

## Entwicklungsphilosophie

Bei Architektur- und Implementierungsentscheidungen gelten folgende Grundsätze:

- **Einfachheit vor Cleverness:** Bevorzuge die einfachste Lösung, die das aktuelle Problem vollständig löst.
- **Lean:** Führe keine Abstraktionen, Schichten, Dependencies oder Framework-Mechanismen ein, solange sie keinen konkreten Nutzen haben.
- **Keine hypothetische Zukunft implementieren:** Code soll gut erweiterbar sein, aber Anforderungen, die noch nicht existieren, werden nicht vorweggenommen.
- **Kleine, klar abgegrenzte Einheiten:** Funktionen, Components, Effects und Services sollen eine klar erkennbare Verantwortung haben.
- **Expliziter Datenfluss:** Bevorzuge nachvollziehbare, explizite Abläufe gegenüber versteckten Seiteneffekten und implizitem Verhalten.
- **Funktional und deklarativ:** Bevorzuge Pure Functions, immutable Daten und `map`/`filter`/`reduce` gegenüber imperativer Mutation, sofern dies den Code einfacher macht.
- **Composition over Complexity:** Komplexeres Verhalten soll möglichst durch die Kombination kleiner, einfacher Bausteine entstehen.
- **Resilienz:** Änderungen und Fehler in einem Teil des Systems sollen möglichst wenig Auswirkungen auf andere Teile haben. Klare Grenzen und geringe Kopplung sind wichtiger als maximale Wiederverwendung.
- **Testbarkeit ist Teil des Designs:** Fachlogik soll möglichst unabhängig von UI, Datenbank, Netzwerk und Framework-Infrastruktur testbar sein.
- **Keine Abstraktion um der Abstraktion willen:** Wiederverwendung erst abstrahieren, wenn tatsächlich gemeinsame Funktionalität vorhanden ist.
- **Bestehendes respektieren:** Bei Änderungen zuerst die vorhandene Architektur und deren Absicht verstehen. Keine ungefragten Refactorings oder Modernisierungen.
- **Lesbarkeit vor Kürze:** Wenige Zeilen Code sind kein Ziel. Der Ablauf und die Absicht des Codes sollen leicht verständlich sein.
- **Kommentare erklären das Warum:** Kommentare sollen Entscheidungen und nicht offensichtliche Gründe dokumentieren, nicht den Code paraphrasieren.

Als Leitlinie gilt:

> **Design for change, but do not implement the future in advance.**

## Coding Rules

### 4a. Prettier-Formatierung

- Nach jeder Änderung an formatierbaren Frontend-Dateien muss Prettier auf den
  geänderten Dateien ausgeführt werden.
- Vor dem Abschluss ist die Formatierung mit `npx prettier --check .` im
  Verzeichnis `frontend/` zu prüfen.
- Die projektspezifische Konfiguration in `frontend/.prettierrc` ist verbindlich.

### 5. Immer Signal Forms verwenden

Alle Formulare in Angular MÜSSEN mit Angular Signal Forms (`form`, `FieldTree`, `FormField`) erstellt werden. Reactive Forms (`FormGroup`, `FormControl`, `FormArray`, `FormBuilder`) sind nicht erlaubt. Template-driven Forms sowie `ngModel` sind ebenfalls nicht erlaubt.

Für neue Formulare und Änderungen an bestehenden Formularen ist die offizielle Angular-Signal-Forms-API zu verwenden. Bestehende Reactive-Forms-Strukturen müssen bei fachlichen Änderungen in Signal Forms überführt werden.

### 6. Globale Funktionen und Styles verwenden

Wiederverwendbare Funktionen, Services und Styles SOLLEN in globale beziehungsweise gemeinsame Dateien ausgelagert werden, nicht in Komponenten dupliziert werden.

Für Layout und UI gelten zusätzlich die verbindlichen Regeln aus [documents/ui-design.md](./documents/ui-design.md).

Reine Layout-Regeln werden über die globalen `gl-*` Layout-Primitives umgesetzt. Komponentenspezifisches SCSS ist auf internes Layout und spezifische Darstellung der jeweiligen Komponente zu beschränken.

### 7. Immer Material-Template-Vorlagen prüfen

Bevor eigene Styles geschrieben werden, SOLL geprüft werden, ob Material-Components bereits Default-Styles mitbringen. Eigenes CSS ist nur zu schreiben, wenn Material keinen Default bietet.

Beispiele:

- ✅ `mat-form-field` hat keinen 100%-Width-Default → die vom UI-System vorgesehene volle Parent-Breite ist sicherzustellen
- ❌ `mat-form-field appearance="outline"` bringt fertige Border-Styles mit → kein eigenes Border-CSS nötig
- ❌ Focus/Error-States von Material → keine eigenen Colors nötig

### 8. Eigene Verzeichnisse für Components

Jede Component SOLL in ein eigenes Verzeichnis mit gleichnamigen Files:

```text
components/
├── component-name/
│   ├── component-name.ts
│   ├── component-name.html
│   └── component-name.scss
```

### 9. SCSS statt CSS

Alle Component-Styles SOLLEN als SCSS (`.scss`) statt CSS (`.css`) geschrieben werden.

### 10. Wiederverwendbare UI-Components

Wiederverwendbare UI-Patterns mit eigenständiger Bedeutung, Verhalten oder stabiler wiederverwendbarer HTML-Struktur SOLLEN als gemeinsame Components umgesetzt werden.

Reines Layout wird nicht als Angular Component umgesetzt. Dafür sind die globalen `gl-*` Layout-Primitives gemäss [documents/ui-design.md](./documents/ui-design.md) zu verwenden.

Gemeinsame UI-Components SOLLEN im Verzeichnis `shared/components/` erstellt werden:

```text
shared/components/
├── info-box/
│   ├── info-box.ts
│   ├── info-box.html
│   └── info-box.scss
├── loading-spinner/
│   └── ...
└── empty-state/
    └── ...
```

Beispiele für wiederverwendbare UI-Components:

- `InfoBoxComponent` mit Varianten: `info`, `warning`, `error`, `success`
- `ControlErrorComponent`
- Loading Spinner
- Empty State

Fehlermeldungen von Formularfeldern MÜSSEN immer über `frontend/src/app/shared/components/control-error/control-error.ts` beziehungsweise `ControlErrorComponent` dargestellt werden. Bei Signal Forms ist der jeweilige `FieldState` über `[control]` zu übergeben und der passende Übersetzungspfad über `translationPrefix` zu setzen. Inline-Fehlermeldungen für Formularfelder in Page-Templates sind nicht erlaubt.

### 11. Signals für reaktive Daten verwenden

Inputs SOLLEN als `input()` Signal definiert werden.
Berechnete Werte SOLLEN als `computed()` definiert werden.
Constructor Injection SOLL durch `inject()` ersetzt werden.

```typescript
// FALSCH
@Input() variant: string = 'info';
constructor(private router: Router) {}
get defaultIcon(): string { ... }

// RICHTIG
variant = input<'info' | 'warning' | 'error' | 'success'>('info');
private router = inject(Router);
defaultIcon = computed(() => { ... });
```

### 11a. English Source Code

- Source-code identifiers, including types, variables, functions, classes and comments, are written in English.
- User-facing text remains localized through the translation system.
- External contract values, database fields and established domain values may retain their required spelling.

### 12. UI-Struktur

Für Page-Struktur, responsive Layouts, Formulare, Abstände, Sections, Cards, Actions und die Verwendung gemeinsamer UI-Komponenten gilt ausschliesslich [documents/ui-design.md](./documents/ui-design.md).

Keine Page-spezifische Standardstruktur wie `.page-container`, `.page-header`, `.standard-card` oder `.auth-form` wird vorgegeben.

Neue Page-Templates SOLLEN aus semantischem HTML, Angular Material, vorhandenen gemeinsamen UI-Components und den globalen `gl-*` Layout-Primitives zusammengesetzt werden.
