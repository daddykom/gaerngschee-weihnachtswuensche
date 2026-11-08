# Waitlist Capability Spec

## Overview

Verwaltung von Anmeldungen bei ungenügender Weihnachtswünsche-Verfügbarkeit.

## Features

### F1: Warteliste führen

- Automatische Aufnahme bei ungenügender Verfügbarkeit
- Anzeige des Wartelistenstatus

### F2: Nachträgliche Qualifikation

- Anmeldungen können qualifiziert werden sobald Weihnachtswünsche verfügbar
- Automatische Benachrichtigung

## Data Model

### WaitlistEntry

```typescript
interface WaitlistEntry {
  registrationId: string;
  registeredAt: string;
  position: number;
  qualifiedAt: string | null;
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/waitlist` | List waitlisted registrations |
| POST | `/api/waitlist/{id}/qualify` | Qualify from waitlist |
| GET | `/api/waitlist/available-count` | Get available Weihnachtswünsche count |

## Fachliche Regeln

- Neue Anmeldungen können automatisch auf die Warteliste gesetzt werden
- Wartelisten-Anmeldungen können nachträglich qualifiziert werden

## Implementation Status

| Component | Status |
|-----------|--------|
| Waitlist management | ✗ Not implemented |
| Auto placement | ✗ Not implemented |
| Qualification flow | ✗ Not implemented |
