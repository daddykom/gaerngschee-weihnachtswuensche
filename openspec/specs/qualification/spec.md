# Qualification Capability Spec

## Overview

Qualifizierte Klienten erhalten eine Zusage.

## Features

### F1: Qualifikation

- Anmeldung qualifizieren wenn Weihnachtswünsche verfügbar
- Automatische Statusänderung

### F2: Zusage versenden

- Informations-E-Mail mit QR-Code
- Automatischer Versand nach Qualifikation

### F3: QR-Code erzeugen

- Eindeutiger QR-Code pro Anmeldung
- Enthält Anmeldungs-ID

## Data Model

### Qualification

```typescript
interface Qualification {
  registrationId: string;
  qualifiedAt: string;
  qrCodeGenerated: boolean;
  emailSentAt: string | null;
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/qualifications/{registrationId}` | Qualify registration |
| GET | `/api/qualifications/{registrationId}/qr` | Get QR code |

## Fachliche Regeln

- Eine Anmeldung kann erst qualifiziert werden wenn genügend Weihnachtswünsche verfügbar sind
- Nach Qualifikation erhält der Klient automatisch eine Informations-E-Mail mit QR-Code

## Implementation Status

| Component | Status |
|-----------|--------|
| Qualification logic | ✗ Not implemented |
| QR code generation | ✗ Not implemented |
| Email notification | ✗ Not implemented |
