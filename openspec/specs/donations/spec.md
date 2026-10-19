# Wunsch-Erfüllung Capability Spec

## Overview

Verwaltung der Erfüllung einzelner Weihnachtswünsche durch Erfüller.

## Features

### F1: Wunsch auswählen

- Erfüller sieht verfügbare Weihnachtswünsche
- Erfüller wählt genau einen Weihnachtswunsch aus

### F2: Erfüllung bestätigen

- Erfüllung des ausgewählten Wunsches bestätigen
- Wunsch als erfüllt markieren
- Erfüllung dem Erfüller zuordnen

### F3: Wunsch-Status

- Verfügbare Wünsche anzeigen
- Bereits erfüllte Wünsche aus der Auswahl entfernen
- Statusänderungen nachvollziehbar speichern

## Data Model

### Donation

```typescript
interface FulfilledWish {
  id: string;
  wishId: string;
  fulfillerId: string;
  status: 'fulfilled';
  createdAt: string;
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wishes` | List available wishes |
| POST | `/api/wishes/{wishId}/fulfill` | Fulfill one wish |
| GET | `/api/wishes/fulfilled` | List fulfilled wishes (staff only) |

## Fachliche Regeln

- Ein Wunsch darf nicht mehrfach erfüllt werden
- Die Erfüllung wird nur nach ausdrücklicher Bestätigung gespeichert
- Erfüller können nur verfügbare Wünsche auswählen

## Implementation Status

| Component | Status |
|-----------|--------|
| Wish selection | ✗ Not implemented |
| Fulfillment confirmation | ✗ Not implemented |
| Fulfillment recording | ✗ Not implemented |
| Availability update | ✗ Not implemented |
