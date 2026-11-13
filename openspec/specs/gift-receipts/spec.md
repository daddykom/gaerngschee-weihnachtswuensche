# Geschenkeingang

## Umfang

Mitarbeitende (`user`) und Administratoren (`admin`) suchen Geschenke anhand
von `<Zettelnummer>-<Wunschnummer>` im konfigurierten Kampagnenjahr.
Alle Wünsche des zugehörigen Wunschzettels werden angezeigt; der gesuchte
Wunsch ist eindeutig hervorgehoben. Die Abhol-/Auslieferungsseite ist nicht
Bestandteil dieses Auftrags.

## Suchschnittstelle (implementiert)

- `GET /user/gift-receipts/{giftNumber}` erfordert eine Anmeldung als `user`
  oder `admin`. Andere Gruppen erhalten gemäss Zugriffskonvention HTTP 404,
  nicht angemeldete Anfragen HTTP 401.
- Die Nummer enthält zwei positive Ganzzahlen, jeweils höchstens 2147483647,
  getrennt durch einen Bindestrich. Ungültige Nummern ergeben HTTP 400 mit
  `INVALID_GIFT_NUMBER`.
- Das Jahr wird ausschliesslich aus `campaign_year` gelesen. Es kann nicht
  durch die Anfrage überschrieben werden. Kein Treffer ergibt HTTP 404 mit
  `GIFT_NOT_FOUND`.
- Die Antwort enthält `campaignYear`, `selectedItemId` sowie `order` mit
  `id`, `year`, `orderNumber`, `status` und allen `items` des Wunschzettels.
- Ein Item enthält `id`, `itemNumber`, `giftNumber` (bei fehlender Nummer
  `null`), `category`, `currentTitle`, `currentDescription`,
  `publicationStatus`, `fulfillmentStatus` und `receivedAt`.
- Keine E-Mail-Adressen, internen Notizen oder Token werden ausgegeben.
  Die Suche verändert weder Bestell-/Wunschstatus noch Versanddaten.

## Datenbasis für die Abholfreigabe

Die Phinx-Migration `20261113083756_add_order_pickup_fields.php` ergänzt an
`orders` einen optionalen, eindeutigen SHA-256-Hash `pickup_token_hash` und
den optionalen Versandzeitpunkt `pickup_notification_sent_at`.
Bestehende Orders behalten ihre Daten und Status; beide neuen Felder sind
anfangs `NULL`. Die Suchschnittstelle benötigt diese Felder nicht.

Der spätere QR-Code enthält die URL
`<FRONTEND_BASE_URL>/abholung/<zufälliger-Token>`, keine persönlichen Daten.
Die Auflösung dieser URL und die eigentliche Abholung werden hier nicht implementiert.

## QR-Code und Abhol-E-Mail

- Lokal erzeugtes PNG mit `endroid/qr-code` 6.1, hoher Fehlerkorrektur und
  weissem Hintergrund. Tokens werden zufällig mit 256 Bit erzeugt.
- Die Nachricht enthält das eingebettete Bild und einen sichtbaren Link
  auf `<PUBLIC_API_BASE_URL>/public/pickup-qr-code/<token>`.
  Dieser öffentliche, separat limitierte Bildabruf rendert dasselbe PNG,
  erfordert keinen Login und verändert keinen Zustand.
- Derselbe Bildlink steht in der Klartextversion. Der QR-Code selbst enthält
  weiterhin die Abhol-URL, nicht den Bildlink.
- Die Abhol-E-Mail ist unter `/admin/email-test` mit Jahr und Zettelnummer
  testbar. Testversand ordnet keinen Token einer echten Bestellung zu und
  ändert keine Statuswerte.
- Die Nachricht kann einschliesslich Bild in der vorhandenen Mail-Queue
  gespeichert und erneut versandt werden. Die letzte bestätigte Einlieferung
  löst die Abholbenachrichtigung aus.

## Suchseite (implementiert)

- `/user/gift-receipts` ist für `user` und `admin` zugänglich. Administratoren
  finden den Eintrag im Admin-Menü, Mitarbeitende im Konto-Menü auf Mobil
  und Desktop. Andere administrative Berechtigungen bleiben unverändert.
- Die Seite startet ohne Datenabruf. Erst „Suchen“ lädt Daten; ein Resolver
  für initiale Seitendaten ist deshalb nicht erforderlich.
- Signal Forms validiert das Format. Fehler erscheinen erst bei berührtem
  Feld; ungültiges Absenden fokussiert das Eingabefeld und scrollt es ins Bild.
- Formularinhalt und Suchzustand liegen im zuständigen NgRx-Store. Änderungen
  der Nummer entfernen alte Ergebnisse und brechen laufende Abfragen ab.
- Alle Wünsche sind mit Nummer, Titel, Beschreibung und Erfüllungsstatus
  sichtbar. Bereits eingegangene Wünsche zeigen ihren Eingangszeitpunkt.
  Der gesuchte Wunsch ist durch Farbe und „Gesuchter Wunsch“ gekennzeichnet.
- Suchfehler erscheinen über den globalen Notification-Store in der zentralen
  Informationszone. Die Seite bleibt für einen erneuten Versuch erreichbar.
- Einliefern ist nur für den gesuchten Wunsch möglich. Alle übrigen Wünsche
  bleiben sichtbar. Während der Speicherung sind Nummer und Suche gesperrt.

## Einlieferung und Abholfreigabe

- `POST /user/gift-receipts/{giftNumber}` erlaubt `user` und `admin`.
  Nur genehmigte Wünsche definitiver Bestellungen können erstmals eingeliefert
  werden. Das konfigurierte Kampagnenjahr ist serverseitig verbindlich.
- Einlieferung setzt `fulfillment_status = received` und `received_at`.
  Bereits eingelieferte Wünsche werden unverändert zurückgegeben.
- Nicht definitiv reservierte Geschenke (`available`, `pending_confirmation`)
  benötigen eine ausdrückliche Warnungsbestätigung (`confirmUnreserved: true`).
- Beim letzten fehlenden genehmigten Geschenk erscheint vor der Speicherung:
  „Mit diesem Geschenk sind alle Wünsche dieses Wunschzettels eingetroffen.
  Beim Bestätigen wird der QR-Code zur Abholung versandt.“
- Die Bestätigung übermittelt `confirmPickup: true`. Ohne erforderliche
  Bestätigung liefert das Backend HTTP 409 `RECEIPT_CONFIRMATION_REQUIRED`
  mit dem aktualisierten Suchergebnis unter `error.details.result`.
  Die Oberfläche zeigt diesen Stand und verlangt erneute Bestätigung.
- Eine Transaktion mit Bestell- und Wunsch-Sperren verbucht Eingang,
  `ready_for_pickup`, Token-Hash und den gerenderten Versandauftrag gemeinsam.
  Abbrechen löst keinen Schreibzugriff aus. Verfügbarkeit und Bestellstatus
  aktualisieren die bestehenden Event-Zähler.
- Danach wird die E-Mail unmittelbar versucht. Die Antwort unterscheidet
  `mailStatus: not_required`, `sent` und `pending` und enthält `alreadyReceived`.
  Ein SMTP-Fehler verliert weder Eingang noch Freigabe oder den bestehenden QR-Code.
- Der Batch verarbeitet `pickup_notification` über dieselbe Bestellsperre
  wie der unmittelbare Versand. Nach Erfolg wird `pickup_notification_sent_at`
  gespeichert und der Versandauftrag entfernt. Doppelklicks und parallele
  reguläre Anfragen erzeugen keine neue Freigabe oder einen neuen Token.
  Bei einem Prozessabbruch zwischen SMTP-Annahme und DB-Bestätigung ist wie
  bei jedem SMTP-Wiederholungsversand eine erneute Zustellung möglich.

## Noch offen

- Abschliessende Gesamtabnahme und Deployment; Migration
  `20261113083756_add_order_pickup_fields.php` muss in der jeweiligen Umgebung
  vor dem ersten Schreibzugriff ausgeführt sein.
