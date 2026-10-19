# Registrations Capability Spec

## Overview

Anmeldungsverwaltung für Weihnachtswünsche.

## Features

### F1: Anmeldung erfassen

- Klient erfasst Anmeldung
- Erfassung mehrerer Kinder
- Altersgruppe pro Kind
- Zusätzliche Informationen

### F2: Anmeldung bearbeiten

- Klient kann eigene Anmeldung bearbeiten
- Kinder hinzufügen/entfernen
- Altersgruppen anpassen

### F3: Status verfolgen

- Anzeige des aktuellen Status
- Berechtigungsprüfung-Status
- Wartelisten-Status

### F4: QR-Code

- Automatische Erzeugung nach Qualifikation
- Persönlicher QR-Code pro Anmeldung

## Data Model

### Registration

```typescript
interface Registration {
  id: string;
  status: 'pending' | 'qualified' | 'waitlisted' | 'cancelled';
  eligibilityStatus: 'pending' | 'eligible' | 'not_eligible';
  qrCode: string | null;
  pickupConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
  children: Child[];
}
```

### Child

```typescript
interface Child {
  id: string;
  ageGroup: '0-2' | '3-6' | '7-12' | '13-17';
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/registrations` | List registrations |
| GET | `/api/registrations/{id}` | Get single registration |
| POST | `/api/registrations` | Create registration |
| PUT | `/api/registrations/{id}` | Update registration |
| DELETE | `/api/registrations/{id}` | Delete registration |

## Fachliche Regeln

- Eine Anmeldung kann mehrere Kinder enthalten
- Für jedes Kind wird genau eine Altersgruppe angegeben
- Altersgruppen sind fest vorgegeben
- Anmeldungen können jederzeit angepasst werden
- Anmeldung wird über Fairgate geprüft

## Implementation Status

| Component | Status |
|-----------|--------|
| Registration CRUD | ✗ Not implemented |
| Children management | ✗ Not implemented |
| Eligibility check (Fairgate) | ✗ Not implemented |
| QR code generation | ✗ Not implemented |
