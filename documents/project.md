# Project Overview

**Gärngschee-Weihnachtswünsche** - Open-source Webplattform für die Verwaltung und Erfüllung einzelner Weihnachtswünsche von Menschen mit knappen finanziellen Mitteln.

## Benutzerrollen

| Rolle | Beschreibung |
|-------|--------------|
| Besucher | Nicht angemeldete Benutzer |
| Klient | Personen/Familien mit knappen finanziellen Mitteln |
| Erfüller | Wählen einzelne Weihnachtswünsche aus und erfüllen sie |
| Mitarbeiter | Vereinsmitarbeiter, Zugriff auf administrative Funktionen |
| Administrator | Systemverwaltung |

## Kernfunktionen

- Verwaltung und Erfüllung einzelner Weihnachtswünsche
- Anmeldungen mit Kindern
- Berechtigungsprüfung (Fairgate)
- Warteliste
- Qualifikation & QR-Codes
- QR-basierte Abgabe
- E-Mail-Benachrichtigungen
- E-Mail-Vorlagenverwaltung

## Technologiestack

| Bereich | Technologie |
|---------|-------------|
| Frontend | Angular 21, NgRx, Angular Material, TypeScript, PWA |
| Backend | PHP 8, Slim 4, Phinx |
| Datenbank | MariaDB |
| Hosting | Cyon.ch |

## Vollständige Dokumentation

→ Siehe [openspec/specs/weihnachtswuensche.md](../openspec/specs/weihnachtswuensche.md) für das Fachkonzept.

→ Siehe [architecture.md](./architecture.md) für die Systemarchitektur.

→ Siehe [frontend-conventions.md](./frontend-conventions.md) für Angular-Entwicklungskonventionen.

→ Siehe [backend-conventions.md](./backend-conventions.md) für PHP-Entwicklungskonventionen.

→ Siehe [database-conventions.md](./database-conventions.md) für Datenbank-Migrationskonventionen.
