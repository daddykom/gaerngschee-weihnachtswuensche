# Wunsch-Erfüllung Capability Spec

## Overview

Verwaltung der Reservierung einzelner Weihnachtswünsche durch Erfüller.
Ein Wunsch wird zunächst reserviert, da der Erfüller ihn anschliessend noch
beschaffen, verpacken und zur Organisation bringen muss.

## Features

### F1: Wunsch auswählen

- Erfüller sieht verfügbare Weihnachtswünsche aus definitiven Bestellungen
- Die Wünsche werden nach Bestellung gruppiert angezeigt
- Anonymisierte, korrigierte Familien- und Wunschtexte werden angezeigt
- Die Wunschnummer wird im Format `<Bestellnummer>-<Wunschnummer>` angezeigt
- Die Liste kann nach Kategorie und korrigierten Texten durchsucht werden
- Erfüller wählt genau einen Weihnachtswunsch aus

### F2: Erfüllung bestätigen

- Reservierung des ausgewählten Wunsches ausdrücklich bestätigen
- Wunsch als reserviert markieren
- Erfüllung dem Erfüller zuordnen

### F3: Wunsch-Status

- Verfügbare Wünsche anzeigen
- Bereits reservierte Wünsche aus der Auswahl entfernen bzw. dem eigenen Erfüller zuordnen
- Statusänderungen nachvollziehbar speichern

## Data Model

### Donation

```typescript
interface ReservedWish {
  id: string;
  wishId: string;
  orderId: string;
  fulfillerId: string;
  status: 'reserved';
  createdAt: string;
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/fulfiller/orders` | Definitive Bestellungen mit verfügbaren Wünschen laden |
| POST | `/fulfiller/order-items/{itemId}/reserve` | Einen Wunsch reservieren |

## Fachliche Regeln

- Ein Wunsch darf nicht mehrfach reserviert werden
- Die Reservierung wird nur nach ausdrücklicher Bestätigung gespeichert
- Erfüller können nur verfügbare Wünsche auswählen
- Die Reservierung erfolgt atomar, damit parallele Reservierungen nicht denselben Wunsch übernehmen können

## Implementation Status

| Component | Status |
|-----------|--------|
| Wish selection | ✓ Implemented |
| Reservation confirmation | ✓ Implemented |
| Reservation recording | ✓ Implemented |
| Availability update | ✓ Implemented |
