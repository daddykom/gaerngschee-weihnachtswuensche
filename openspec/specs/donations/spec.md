# Wunsch-Erfüllung Capability Spec

## Overview

Verwaltung der Reservierung einzelner Weihnachtswünsche durch Erfüller.
Die öffentliche Wunschliste benötigt kein Konto. Eine Reservierung wird per
E-Mail bestätigt und bleibt bis zur Bestätigung zehn Minuten vorläufig.

## Features

### F1: Wunsch auswählen

- Erfüller sieht öffentliche Wünsche aus definitiven Bestellungen ohne Login
- Die Wünsche werden nach Bestellung gruppiert angezeigt
- Anonymisierte, korrigierte Familien- und Wunschtexte werden angezeigt
- Die Wunschnummer wird im Format `<Bestellnummer>-<Wunschnummer>` angezeigt
- Die Liste kann nach Kategorie und korrigierten Texten durchsucht werden
- Erfüller wählt genau einen Weihnachtswunsch aus

### F2: Reservierung per E-Mail bestätigen

- E-Mail-Adresse, Datenschutzzustimmung und verbindliche Übergabezusage erfassen
- Vorläufige Reservierung bis zur Token-Bestätigung halten
- Bestätigungslink ist zehn Minuten gültig und macht die Reservierung definitiv
- Abgelaufene oder nicht bestätigte Vorreservierungen werden wieder verfügbar

### F3: Wunsch-Status

- Verfügbare Wünsche anzeigen
- Vorläufige und definitive Reservierungen klar anzeigen
- Statusänderungen nachvollziehbar speichern
- Offene Fulfiller-Listen aktualisieren nur die betroffenen Statuswerte

## Data Model

### Donation

```typescript
interface ReservedWish {
  id: string;
  wishId: string;
  orderId: string;
  fulfillerEmail: string;
  status: 'pending_confirmation' | 'reserved';
  createdAt: string;
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/public/fulfiller/orders` | Öffentliche definitive Bestellungen laden |
| GET | `/public/fulfiller/wish-statuses` | Nur Wunschstatus aktualisieren |
| POST | `/public/fulfiller-reservation-start` | Vorläufige Reservierung anfordern |
| POST | `/auth/fulfiller-reservation-confirm` | Reservierung über E-Mail-Token bestätigen |

## Fachliche Regeln

- Ein Wunsch darf nicht mehrfach reserviert werden
- Die E-Mail-Adresse und Datenschutzzustimmung werden vor dem Versand erfasst
- Eine definitive Reservierung entsteht erst durch den Bestätigungslink
- Erfüller können nur verfügbare Wünsche auswählen
- Die Reservierung erfolgt atomar, damit parallele Reservierungen nicht denselben Wunsch übernehmen können

## Implementation Status

| Component | Status |
|-----------|--------|
| Wish selection | ✓ Implemented |
| Reservation confirmation | ✓ Implemented |
| Reservation recording | ✓ Implemented |
| Availability update | ✓ Implemented |
