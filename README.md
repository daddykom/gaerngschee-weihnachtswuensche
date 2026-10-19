# Gärngschee-Weihnachtswünsche

Open-Source-Webplattform für die Verwaltung und Erfüllung einzelner Weihnachtswünsche von Menschen mit knappen finanziellen Mitteln.

## Über das Projekt

Die Gärngschee-Weihnachtswünsche-Plattform ermöglicht es Erfüllern, einzelne Weihnachtswünsche auszuwählen und zu erfüllen, und Klienten, sich für Weihnachtswünsche zu registrieren. Die Anwendung verwaltet Wünsche, Anmeldungen und die Zuordnung erfüllter Wünsche.

## Benutzerrollen

### Besucher
Nicht angemeldete Benutzer können öffentliche Informationen ansehen, verfügbare Weihnachtswünsche entdecken und sich für Weihnachtswünsche anmelden.

### Klient
Personen oder Familien mit knappen finanziellen Mitteln. Klienten können ihre Anmeldung bearbeiten, den Status verfolgen, Benachrichtigungen empfangen und erhalten einen QR-Code für die Abholung.

### Erfüller
Personen, welche einzelne Weihnachtswünsche auswählen und erfüllen. Erfüller wählen einen konkreten Wunsch aus und bestätigen dessen Erfüllung.

### Mitarbeiter
Mitarbeiter des Vereins Gärngschee mit Zugriff auf alle administrativen Funktionen: Anmeldungen verwalten, Warteliste führen, QR-Codes prüfen, Abgaben bestätigen und E-Mail-Vorlagen konfigurieren.

### Administrator
Verwaltung der Anwendung: Stammdaten, Systemkonfiguration und Benutzerverwaltung.

## Kernfunktionen

### Wünsche erfüllen
- Übersicht der verfügbaren Weihnachtswünsche
- Auswahl eines einzelnen Wunsches
- Bestätigung der Erfüllung durch den Erfüller

### Anmeldung
- Erfassung und Bearbeitung von Anmeldungen
- Erfassung mehrerer Kinder pro Anmeldung
- Altersgruppen-Zuordnung pro Kind
- Zusätzliche Informationen

### Berechtigungsprüfung
- Übernahme der Berechtigungsinformationen aus Fairgate
- Anzeige des Prüfungsstatus

### Warteliste
- Automatische Aufnahme bei ungenügender Verfügbarkeit
- Nachträgliche Qualifikation bei Verfügbarkeit

### Qualifikation
- Automatische Zusage bei genügend Weihnachtswünsche
- Versand der Informations-E-Mail mit QR-Code

### Abgabe
- QR-Code-Prüfung
- Anzeige der Anmeldung
- Bestätigung der Abgabe (auch teilweise)
- Rückgängig-Machen durch berechtigte Mitarbeitende

### Benachrichtigungen
- Bestätigungs-E-Mail nach Anmeldung
- Information für Wartelisten-Klienten
- Informations-E-Mail mit QR-Code nach Qualifikation
- Konfigurierbare Erinnerungs-E-Mails

### E-Mail-Verwaltung
- Verwaltung aller E-Mail-Vorlagen
- Bearbeitung von Betreff und Inhalt
- Platzhalter-Unterstützung
- Konfiguration der Erinnerungsintervalle

## Technologiestack

### Frontend
- Angular 21
- NgRx (Store, Effects)
- Angular Material
- TypeScript
- Progressive Web App (PWA)
- Nx Build-System

### Backend
- PHP 8
- Slim Framework 4
- Phinx (Database Migrations)

### Datenbank
- MariaDB

### Integrationen
- Payrexx (Zahlungsabwicklung)
- Fairgate (Berechtigungsprüfung)

## Entwicklung

### Voraussetzungen
- Docker
- Node.js
- PHP 8
- Composer

### Setup

```bash
# Docker-Umgebung starten
docker-compose up -d

# Datenbank migrieren
cd frontend && npm run db:migrate

# Dependencies installieren
cd frontend && npm install
cd backend && composer install
```

Die Konfiguration wird aus `backend/.env` geladen. Eine vollständige Vorlage
steht in [`backend/.env.example`](./backend/.env.example); produktive
Installationen sind in der [Deployment-Dokumentation](./documents/deployment.md)
beschrieben.

### Fairgate-Testdaten

Die lokale Docker-Umgebung läuft mit `APP_ENV=test` und verwendet deshalb den
Fairgate-Fake. Bei einer E-Mail-Adresse mit `+` wird der Teil nach dem Plus im
lokalen Teil der Adresse als Testmarker ausgewertet. Die Prüfung ist unabhängig
von Gross-/Kleinschreibung und der Marker darf von weiterem Text umgeben sein.

Beispiele:

| E-Mail-Adresse | Simuliertes Ergebnis |
|---|---|
| `person+fair1@example.com` | Kontakt gefunden, 2 Erwachsene und 3 Kinder |
| `person+fair1-alice@example.com` | Dasselbe Profil wie `fair1`, aber eine weitere eindeutige Testadresse |
| `person+fair2@example.com` | Kontakt gefunden, 1 Erwachsener und 2 Kinder |
| `person+fair3@example.com` | Kontakt gefunden, 2 Erwachsene und 0 Kinder |
| `person+fair4@example.com` | Kontakt gefunden, 2 Erwachsene und 7 Kinder |
| `person+test@example.com` | Kein Kontakt gefunden |
| `person@example.com` | Kein Kontakt gefunden |

Für einen Test muss `fair1`, `fair2`, `fair3` oder `fair4` nach dem `+` im
lokalen Teil der Adresse vorkommen. Weitere Zeichen sind erlaubt, zum Beispiel
`person+fair1-alice@example.com` oder
`person+fair1-kunde-123@example.com`. Damit können mit einer einzigen
Empfänger-Domain unzählige eindeutige Testkunden simuliert werden. Die Domain
kann frei gewählt werden. Der Mailserver ignoriert bei der Zustellung alles ab
dem `+` und liefert alle diese Varianten an dasselbe Postfach. Die Anwendung
wertet den Teil ab dem `+` hingegen aus und verwendet ihn zur Auswahl des
simulierten Fairgate-Profils. In der Produktionsumgebung wird mit `APP_ENV=prod`
der echte Fairgate-Service verwendet. Details stehen in den
[Backend-Konventionen](./documents/backend-conventions.md#testumgebung-und-fairgate-fake).

### Verfügbare Scripts

#### Frontend (frontend/package.json)
```bash
npm start              # Entwicklungserver starten
npm run build          # Produktions-Build
npm run test           # Unit Tests
npm run e2e            # End-to-End Tests
npm run lint           # Linting
npm run db:start       # Docker Datenbank starten
npm run db:stop        # Docker Datenbank stoppen
npm run db:migrate     # Migrationen ausführen
npm run db:setup       # Datenbank initialisieren
npm run db:reset       # Datenbank zurücksetzen
```

#### Backend (backend/composer.json)
```bash
composer install       # Dependencies installieren
composer update        # Dependencies aktualisieren
vendor/bin/phinx       # Phinx CLI für Migrationen
```

### Tests
```bash
# Unit Tests (Frontend)
npm test

# Unit Tests (Backend)
cd backend && vendor/bin/phpunit

# End-to-End Tests
npm run e2e
```

## Architekturprinzipien

- **Mobile First** – Optimiert für mobile Geräte
- **Accessibility First** – Barrierefreiheit als Priorität
- **Privacy-friendly** – Datenschutzfreundlich
- **Open Source** – Frei verfügbar und transparent
- **API-first** – Klare Trennung zwischen Frontend und Backend
- **Low operating costs** – Minimale Betriebskosten
- **Clear separation** – Frontend, Backend und Datenbank sind unabhängig

## Projektstruktur

```
├── frontend/               # Angular SPA
│   ├── src/
│   │   ├── app/           # Angular Application Code
│   │   └── environments/  # Environment-Konfiguration
│   ├── project.json       # Nx Konfiguration
│   └── package.json       # Node.js Dependencies
├── backend/               # PHP Slim API
│   ├── src/              # PHP Application Code
│   └── composer.json      # PHP Dependencies
├── db/                   # Datenbank
│   ├── migrations/       # Phinx Migrationen
│   └── seeds/            # Integrationstest-Fixtures
├── docker-compose.yml    # Docker Konfiguration
└── openspec/            # OpenSpec Spezifikationen
```

## Lizenz

MIT
