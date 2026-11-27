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
- Wunschliste und Reservationsdialog zeigen den bearbeiteten Wunschtitel,
  die bearbeitete Wunschbeschreibung und den optionalen Geschenklink.
- Originaltitel und Originalbeschreibung sind im Admin und für den zugehörigen
  Wunschbesteller getrennt von ihren bearbeitbaren Fassungen sichtbar.
  Sie werden nicht an Erfüller ausgeliefert.
- Persönliche Nachrichten sind ausschliesslich für das Gärngschee-Team bestimmt.
  Das optionale Formularfeld und sein Hilfetext weisen ausdrücklich darauf hin.
  Weder API-Antworten an Erfüller noch die öffentliche Suche geben diese
  Nachrichten preis; dies gilt auch für die bisherigen Begründungsfelder
  `original_reason` und `current_reason`.
- Die Wunschnummer wird im Format `<Bestellnummer>-<Wunschnummer>` angezeigt
- Die Liste kann nach Kategorie und korrigierten Texten durchsucht werden
- Erfüller wählt genau einen Weihnachtswunsch aus

### F2: Reservierung per E-Mail bestätigen

- E-Mail-Adresse, Datenschutzzustimmung und verbindliche Übergabezusage erfassen
- Vorläufige Reservierung bis zur Token-Bestätigung halten
- Bestätigungslink ist zehn Minuten gültig und macht die Reservierung definitiv
- Sowohl die E-Mail mit dem Bestätigungslink als auch die anschliessende
  Bestätigung enthalten Wunschnummer, bearbeiteten Wunschtitel, bearbeitete
  Beschreibung und – sofern vorhanden – den Wunschlink in HTML und Klartext.
  Ohne Wunschlink entfällt dessen Darstellung; Originalwerte bleiben intern.
- `fulfiller_handover_date` ist ein frei formulierbarer Abgabetermin oder
  Abgabezeitraum, etwa „17.–19. Dezember 2026“. Bestehende Werte bleiben erhalten.
  Der Text wird unverändert im Reservationsdialog und in der Bestätigungsmail
  angezeigt. Die Start-/Enddaten der Erfüller-Aktion bleiben Datumswerte.
- `fulfiller_handover_location` wird als Textarea gepflegt. Mehrzeilige
  Adressen bleiben beim Speichern, im Reservationsdialog und in den
  Bestätigungs- und Erinnerungs-E-Mails (HTML und Klartext) erhalten.
  Bestehende Werte und Berechtigungen bleiben unverändert.
- Abgelaufene oder nicht bestätigte Vorreservierungen werden wieder verfügbar

### F3: Abgabeerinnerung für Erfüller

- Admins pflegen `fulfiller_reminder_dates` als Textarea mit einem Datum pro
  Zeile im Format `YYYY-MM-DD`. Ein leeres Feld deaktiviert die Erinnerungen.
- Der bestehende stündliche Batch versendet an den konfigurierten Tagen nach
  `Europe/Zurich` je Erfüller eine E-Mail mit allen noch nicht eingelieferten,
  bestätigten Zusagen der konfigurierten Aktion (`campaign_year`).
- Berücksichtigt werden nur freigegebene Wünsche definitiver Bestellungen
  mit `fulfillment_status = reserved` und ohne `received_at`.
- Die Nachricht enthält Wunschnummer, bearbeiteten Titel und Beschreibung,
  den konfigurierten Abgabezeitraum, die Abgabezeit, den Abgabeort und einen
  Hinweis zum rechtzeitigen Versand per Post mit Wunschnummer.
- Pro normalisierter E-Mail-Adresse und Schweizer Kalendertag wird höchstens
  eine erfolgreiche Zustellung gespeichert, auch bei parallelen Batchläufen.
- Fehlgeschlagene Zustellungen werden beim nächsten Batch am selben Tag erneut
  versucht; dabei werden die noch offenen Zusagen erneut geladen. Es gibt keinen
  nachträglichen Versand für vergangene Erinnerungstage.

### F4: Wunsch-Status

- Verfügbare Wünsche anzeigen
- Vorläufige und definitive Reservierungen klar anzeigen
- Statusänderungen nachvollziehbar speichern
- Offene Fulfiller-Listen aktualisieren nur die betroffenen Statuswerte

### F5: Erfüller administrativ entfernen

- Im Admin-Wunscheditor erscheint „Erfüller entfernen“ als Secondary-Button bei
  vorläufigen und bestätigten Zuordnungen ohne Geschenkeingang.
- Bei eingegangenen oder abgeschlossenen Geschenken wird der Button nicht angezeigt;
  das Backend verbietet die Freigabe ebenfalls.
- „Nein“, Escape und das Schliessen des Bestätigungsdialogs verändern nichts.
- „Ja“ entfernt die Zuordnung sofort und unabhängig vom Speichern der Bestellung.
  Nicht gespeicherte Textänderungen bleiben im Formular erhalten.
- Der Server prüft die erwartete Zuordnung unter einer Sperre gegen parallele
  Änderungen. Zuordnung, Reservierungsdaten und offene Bestätigungslinks werden
  aufgehoben, während Wunschtexte und Veröffentlichungsstatus unverändert bleiben.
- Die Benachrichtigung an die bisherige Erfüller-Adresse wird in derselben
  Transaktion in der E-Mail-Warteschlange gespeichert und vom Batch versendet.
- Der Wunsch wird wieder verfügbar. Die öffentlichen Sichtbarkeitsbedingungen
  (definitive Bestellung, freigegebener Wunsch und Aktionszeitraum) bleiben gültig.
- Bereits geöffnete öffentliche Listen laden neu verfügbare, zuvor fehlende
  Wünsche beim nächsten Verfügbarkeits-Update nach.

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
| POST | `/admin/orders/{orderId}/items/{itemId}/release-fulfiller` | Zuordnung entfernen und Benachrichtigung vormerken (nur Admin) |

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
