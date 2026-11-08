# Pickup Capability Spec

## Overview

Ausgabe der Weihnachtswünsche an Klienten.

## Features

### F1: QR-Code prüfen

- Scan/Validierung des QR-Codes
- Anzeige der zugehörigen Anmeldung

### F2: Anmeldung anzeigen

- Zeigt Klientendaten
- Zeigt Anzahl Kinder
- Zeigt bereits abgegebene Weihnachtswünsche

### F3: Abgabe bestätigen

- Vollständige Abgabe
- Teilweise Abgabe möglich
- Rückgängig-Machen durch berechtigte Mitarbeitende

## Data Model

### Pickup

```typescript
interface Pickup {
  id: string;
  registrationId: string;
  confirmedAt: string;
  confirmedBy: string;
  maspaeggliCount: number;
  notes: string | null;
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pickup/verify` | Verify QR code |
| POST | `/api/pickup/confirm` | Confirm pickup |
| POST | `/api/pickup/{id}/undo` | Undo pickup (staff only) |
| GET | `/api/pickup/history/{registrationId}` | Get pickup history |

## Fachliche Regeln

- Ein QR-Code identifiziert genau eine Anmeldung
- Eine Anmeldung kann mehrere Weihnachtswünsche enthalten
- Eine teilweise Abgabe ist möglich
- Bereits abgegebene Weihnachtswünsche werden gekennzeichnet
- Bestätigte Abgabe kann durch berechtigte Mitarbeitende rückgängig gemacht werden

## Implementation Status

| Component | Status |
|-----------|--------|
| QR verification | ✗ Not implemented |
| Pickup confirmation | ✗ Not implemented |
| Partial pickup | ✗ Not implemented |
| Undo pickup | ✗ Not implemented |
