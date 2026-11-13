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
Der Token wird erst in der QR-/E-Mail-Etappe erzeugt. Die Auflösung dieser
URL und die eigentliche Abholung werden hier nicht implementiert.

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
- Die Seite ist in dieser Etappe ausschliesslich lesend: kein Einliefern,
  keine Abholfreigabe und kein Versand.

## Folgende Etappen (noch nicht implementiert)

- QR-Code und Abhol-E-Mail einschliesslich `/admin/email-test`.
- Einlieferung setzt `fulfillment_status = received` und `received_at`.
  Nicht reservierte Geschenke lösen eine Warnung aus.
- Beim letzten fehlenden Geschenk erscheint vor der Speicherung:
  „Mit diesem Geschenk sind alle Wünsche dieses Wunschzettels eingetroffen.
  Beim Bestätigen wird der QR-Code zur Abholung versandt.“
- Bestätigung verbucht den Eingang, setzt `ready_for_pickup` und veranlasst
  den Versand. Abbrechen verändert nichts. Parallele Anfragen und erneutes
  Absenden dürfen keine doppelte Freigabe oder Benachrichtigung erzeugen.
