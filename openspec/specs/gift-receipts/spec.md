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

### Annahmebestätigung vor dem Geschenkeingang

- Beim Wechsel auf `definitive` werden alle Wünsche als angenommen bestätigt.
  Sowohl die Freigabeaktion als auch manuelles Setzen des Status setzen dafür
  ausschliesslich genehmigte Wünsche voraus.
- Die Nachricht enthält Abholdatum/-zeit und den mehrzeiligen Abholort aus der
  Konfiguration. Sie bittet darum, die Zeit zu reservieren und auf eine weitere
  E-Mail mit dem Abhol-QR-Code nach Eingang aller Geschenke zu warten. Sie enthält
  selbst noch keinen QR-Code.
- Statuswechsel und Versandauftrag (`order_acceptance`) werden gemeinsam mit
  einer Bestellsperre gespeichert. Danach wird der unmittelbare Versand versucht.
  Fehlende Abholdaten oder Versandfehler lassen den Auftrag für den Mail-Batch
  ausstehend. Bereits gerenderte Nachrichten werden unverändert wiederholt.
- `acceptance_email_sent_at` wird erst nach erfolgreichem Versand gesetzt.
  Wiederholtes Speichern, parallele Freigaben und weitere Statuswechsel erzeugen
  für bereits bestätigte Wunschzettel keine erneute Annahmebestätigung. Ein
  ausstehender Auftrag wird nicht mehr versandt, wenn die Bestellung nicht mehr
  definitiv ist. Ein SMTP-Abbruch nach Annahme der Nachricht, aber vor Speicherung
  des Versandzeitpunkts kann wie bei der QR-E-Mail zu erneuter Zustellung führen.
- Die Migration ergänzt nur den leeren Versandzeitpunkt. Bestehende definitive
  Wunschzettel werden weder durch die Migration noch durch blosses erneutes
  Speichern oder den regulären Batch automatisch nachträglich angeschrieben.
  Der explizite Nachversand erfolgt ausschliesslich über das unten beschriebene
  manuelle Batchscript.
- Unter `/admin/email-test` ist `order-confirmation-definitive` mit Jahr,
  Zettelnummer und optionalen Testwerten für Abholdatum und Abholort verfügbar.

### Nachversand bestehender Annahmebestätigungen

- `backend/bin/backfill-order-acceptance.php --year=2026` zeigt nur die Anzahl
  geeigneter Wunschzettel und eindeutiger Empfänger; die Vorschau schreibt nichts
  und versendet keine E-Mails. Das Kampagnenjahr muss ausdrücklich angegeben werden.
- Nur definitive, nummerierte Wunschzettel mit mindestens einem Wunsch und
  ausschliesslich genehmigten Wünschen werden berücksichtigt. Bereits versandte
  oder als `order_acceptance` vorgemerkte Bestätigungen werden übersprungen.
- Mit `--send` prüft das Script ausgefüllte Abholdaten und legt Versandaufträge
  für den vorhandenen Mail-Batch an. Es versendet selbst keine E-Mails und wird
  weder beim Deployment noch durch den gemeinsamen Cron-Runner automatisch aufgerufen.
- Jeder Auftrag wird unter derselben Bestellsperre wie Freigabe und Versand
  erneut geprüft. Wiederholungen, parallele Script-Aufrufe und zwischenzeitliche
  Statuswechsel erzeugen keine doppelten Aufträge. Ein abgebrochener Lauf kann
  erneut gestartet werden. Bestehende Nachrichten und Statuswerte bleiben erhalten.
- Betriebsanleitung: `documents/acceptance-email-backfill.md`.

### Abhol-E-Mail

- `pickup_date` und `pickup_location` werden in der Admin-Konfiguration als
  Strings gepflegt. Das Abholdatum ist Freitext ohne Datums-/Formatvalidierung;
  der Abholort wird als mehrzeilige Textarea bearbeitet. Beide Einträge starten
  leer und müssen vor dem produktiven Versand durch den Betreiber befüllt werden.
- Die Eingabedarstellung wird durch die Metadaten `frontend_config.input_type`
  beziehungsweise `inputType` in der Admin-API bestimmt (`text` oder `textarea`),
  nicht durch den Konfigurationsschlüssel. Der Standard für bestehende und neue
  Einträge ist `text`; die Migration setzt den Abholort auf `textarea`. Der Typ
  gilt für einzelne Werte und Listeneinträge, auch ohne Schreibberechtigung.
  Beim Speichern wird nur der Wert geändert; Typ, Rechte und Validierungsmuster
  bleiben erhalten. Die öffentliche Konfigurations-API bleibt unverändert.
- Die Abhol-E-Mail übernimmt beide Werte beim Erstellen der Nachricht aus der
  Konfiguration. Beim Admin-Testversand können die optionalen Parameter
  `pickupDate` (Text) und `pickupLocation` (Textarea) diese Werte nur für die
  Testnachricht überschreiben; leere Testfelder verwenden die Konfiguration.
  HTML maskiert eingegebenes Markup;
  Zeilenumbrüche bleiben in HTML und Klartext erhalten. Queue-Wiederholungen
  versenden den bereits gespeicherten Nachrichteninhalt unverändert.
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
