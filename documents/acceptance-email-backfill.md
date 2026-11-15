# Annahmebestätigungen nachträglich versenden

Für die bereits definitiven Wunschzettel gibt es ein manuelles Backend-Script.
Es wird **nicht automatisch beim Deployment oder durch den Cron-Runner** gestartet.

## Vorbereitung

1. Datenbanksicherung und Deployment gemäss dem üblichen Betriebsablauf durchführen.
2. Die enthaltenen Phinx-Migrationen durch den Betreiber ausführen lassen,
   insbesondere `20261115134735_add_order_acceptance_email_sent_at.php`.
3. In der Admin-Konfiguration `pickup_date` und `pickup_location` ausfüllen.
4. Unter `/admin/email-test` die Annahmebestätigung mit leeren optionalen Abholdaten
   testen. Dadurch werden die konfigurierten Angaben verwendet.
5. Prüfen, dass der vorhandene Mail-Batch/Cron-Job eingerichtet ist.

## Vorschau

Im Verzeichnis `backend/` auf dem gewünschten Server:

```bash
php bin/backfill-order-acceptance.php --year=2026
```

Der Aufruf verwendet die Backend-Environment-Datei dieser Installation.
Vor dem Aufruf sicherstellen, dass die richtige Installation ausgewählt ist.
Die Vorschau meldet die Anzahl geeigneter Wunschzettel und eindeutiger Empfänger,
ohne Daten zu verändern. Das Jahr muss ausdrücklich angegeben werden.

Für den aktuellen Nachversand werden bis zu **179 Wunschzettel** erwartet.
Weicht die Zahl ab, zuerst den Datenstand prüfen. Das Script überspringt:

- andere Kampagnenjahre und andere Bestellstatus als `definitive`;
- bereits versandte oder vorgemerkte Annahmebestätigungen;
- Wunschzettel ohne Nummer, ohne Wünsche oder mit nicht genehmigten Wünschen.

Es ändert keine Bestell- oder Wunschstatus, um ungeeignete Datensätze passend zu machen.

## Versandaufträge anlegen

Nach Prüfung der Vorschau:

```bash
php bin/backfill-order-acceptance.php --year=2026 --send
```

`--send` legt nur die fehlenden Versandaufträge an. Der bestehende Mail-Batch
versendet sie beim nächsten Lauf. Bei aktivem Cron kann der Versand daher bereits
während des Script-Aufrufs beginnen.

Falls gewünscht, kann der Betreiber den Mail-Batch anschliessend manuell starten:

```bash
php bin/process-orders.php
```

**Achtung:** Dieser vorhandene Batch verarbeitet alle ausstehenden E-Mails,
nicht nur die gerade vorgemerkten Annahmebestätigungen.

Danach die Vorschau erneut ausführen und die Batch-/Mail-Logs kontrollieren.
Eine Vorschau mit null Treffern allein beweist noch keine Zustellung: Auch
ausstehende Versandaufträge werden in der Vorschau übersprungen. Erfolgreiche
Annahmebestätigungen sind an `orders.acceptance_email_sent_at` erkennbar.

## Wiederholung und Fehler

- Fehlendes Datum oder fehlender Ort: `--send` bricht vor dem Anlegen von Aufträgen ab.
- Datenbankfehler während eines Laufs: Bereits angelegte Aufträge bleiben erhalten.
  Nach Behebung denselben Aufruf wiederholen; vorhandene Aufträge werden übersprungen.
- SMTP-Fehler: Der Mail-Batch behält den Auftrag für einen erneuten Versuch.
- Bereits versandte Bestätigungen werden nicht erneut vorgemerkt. Bei einem
  Prozessabbruch nach SMTP-Annahme und vor Speicherung des Versandzeitpunkts ist
  wie bei der Abhol-E-Mail dennoch eine erneute Zustellung möglich.
