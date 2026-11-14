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

### Rückmeldung und Textprüfung auf dem Wunschzettel

- Bei bestehenden Wunschzetteln zeigt `/bestellung` den ursprünglichen
  Order-Text schreibgeschützt und getrennt von der aktuellen Fassung.
  Die aktuelle Fassung bleibt gemäss Bestellstatus bearbeitbar; der
  ursprüngliche Text ist kein Formularwert und wird nicht mitgeändert.
- Für neue Wunschzettel und Bestandsdaten ohne Originaltext wird kein
  leerer Originaltext-Bereich angezeigt.
- Bei `changes_requested` hat ein Prüfhinweis in der zentralen
  Informationszone Vorrang vor dem Fairgate-Hinweis. Die allgemeine
  Rückmeldung (`adminNotes`) wird dort als Text mit erhaltenen
  Zeilenumbrüchen ausgegeben, niemals als HTML.
- Fehlt eine allgemeine Rückmeldung, erscheint nur der Prüfauftrag.
  Ein Entwurf mit gespeicherter allgemeiner Rückmeldung zeigt den Hinweis
  beim erneuten Laden weiterhin. Nach erneutem Einreichen sowie in
  späteren Statuswerten wird keine alte Rückmeldung als aktueller
  Prüfauftrag angezeigt.

### Kampagnenkapazität

- `maximum_orders_per_year` und `maximum_order_items_per_year` begrenzen nur
  Neuanlagen. Gezählt werden alle Bestellungen und Wünsche des Kampagnenjahres,
  Entwürfe eingeschlossen.
- Sobald ein Limit erreicht ist, liefern `POST /public/start` und
  `POST /client/order` für neue Bestellungen den Fehler
  `CAMPAIGN_CAPACITY_REACHED` (HTTP 403). Der Anmeldelink auf der Startseite
  wird durch einen Kapazitätshinweis ersetzt.
- Bestehende Bestellungen bleiben jederzeit editierbar und dürfen Wünsche für
  noch wunschlose Familienmitglieder erfassen, auch wenn das globale Limit
  dadurch überschritten wird.
- Der berechnete Status wird über `GET /public/configuration` als
  `campaign_availability_status` ausgeliefert (`open`, `not_started`, `ended`,
  `capacity_reached`).
- Der Erfüllerzugriff (`fulfiller_availability_status`) wird ausschliesslich
  über das Erfüller-Datumsfenster gesteuert, nicht über Kapazität.

## Implementation Status

| Component | Status |
|-----------|--------|
| Registration CRUD | ✗ Not implemented |
| Children management | ✗ Not implemented |
| Eligibility check (Fairgate) | ✗ Not implemented |
| QR code generation | ✗ Not implemented |
