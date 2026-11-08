# Weihnachtswünsche Capability Spec

## Overview

Hauptspezifikation für die Gärngschee-Weihnachtswünsche-Plattform.

## Benutzerrollen

| Rolle | Beschreibung | Key Features |
|-------|-------------|--------------|
| Besucher | Nicht angemeldete Benutzer | Öffentliche Infos, verfügbare Wünsche, Anmeldung |
| Klient | Personen/Familien mit knappen Mitteln | Anmeldung, Bearbeitung, Status, QR-Code |
| Erfüller | Erfüllen einzelne Weihnachtswünsche | Wunsch auswählen, Erfüllung bestätigen |
| Mitarbeiter | Vereinsmitarbeiter | Anmeldungen, Warteliste, QR-Codes, E-Mails |
| Administrator | Systemverwaltung | Stammdaten, Konfiguration, Benutzer |

## Kernfunktionen

### 1. Wünsche erfüllen

- Verfügbare Weihnachtswünsche anzeigen
- Einen einzelnen Wunsch auswählen
- Erfüllung des ausgewählten Wunsches bestätigen

→ Siehe: [../donations/spec.md](../donations/spec.md)

### 2. Anmeldung

- Erfassung und Bearbeitung
- Mehrere Kinder pro Anmeldung
- Altersgruppen pro Kind
- Zusätzliche Informationen

→ Siehe: [../registrations/spec.md](../registrations/spec.md)

### 3. Berechtigungsprüfung

- Übernahme aus Fairgate
- Status-Anzeige

→ Siehe: [../eligibility/spec.md](../eligibility/spec.md)

### 4. Warteliste

- Automatische Aufnahme bei ungenügender Verfügbarkeit
- Nachträgliche Qualifikation

→ Siehe: [../waitlist/spec.md](../waitlist/spec.md)

### 5. Qualifikation

- Zusage bei Verfügbarkeit
- QR-Code-Erzeugung
- Informations-E-Mail

→ Siehe: [../qualification/spec.md](../qualification/spec.md)

### 6. Abgabe

- QR-Code-Prüfung
- Anmeldung anzeigen
- Bestätigung (auch teilweise)
- Rückgängig-Machen

→ Siehe: [../pickup/spec.md](../pickup/spec.md)

### 7. Benachrichtigungen

- Bestätigungs-E-Mail nach Anmeldung
- Wartelisten-Information
- QR-Code-Mail nach Qualifikation
- Erinnerungs-E-Mails

→ Siehe: [../notifications/spec.md](../notifications/spec.md)

### 8. E-Mail-Verwaltung

- Vorlagen bearbeiten
- Platzhalter
- Erinnerungsintervalle

→ Siehe: [../email-templates/spec.md](../email-templates/spec.md)

## Implementation Status

| Component | Status |
|-----------|--------|
| Donations | ✗ Not implemented |
| Registrations | ✗ Not implemented |
| Eligibility | ✗ Not implemented |
| Waitlist | ✗ Not implemented |
| Qualification | ✗ Not implemented |
| Pickup | ✗ Not implemented |
| Notifications | ✗ Not implemented |
| Email Templates | ✗ Not implemented |
