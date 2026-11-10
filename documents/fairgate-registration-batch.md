# Fairgate-Registrierungsbatch

## Ablauf

Beim Absenden der Startseite prüft das Backend die E-Mail-Adresse im Real-Modus
gegen den lokalen Fairgate-Kontaktbestand; im Fake-Modus wird sie direkt anhand
des E-Mail-Markers ausgewertet.

- Wird der Kontakt gefunden, wird wie bisher ein einmaliger Client-
  Registrierungstoken versendet.
- Wird der Kontakt nicht gefunden, wird kein Token erzeugt. Die normalisierte
  E-Mail-Adresse wird als wartende Fairgate-Anfrage gespeichert und die
  konfigurierten Fairgate-Registrierungslink versendet.

Wartende Anfragen werden durch
`backend/bin/process-fairgate-registrations.php` geprüft. Eine Anfrage ist
frühestens zwölf Stunden nach ihrer letzten Prüfung wieder fällig. Bei einem
Fairgate-Treffer wird eine E-Mail mit dem allgemeinen `/start`-Link versendet;
auch dabei wird kein Token erzeugt. Die Person gibt ihre E-Mail-Adresse auf der
Startseite erneut ein und erhält dann den normalen persönlichen Link.

## Betrieb

Der Batch benötigt dieselbe `backend/.env` wie das Backend. Im Regelbetrieb
wird er über den gemeinsamen Runner nach der Kontaktsynchronisation und vor
dem Bestellungsbatch ausgeführt:

```bash
cd backend
php bin/process-all-batches.php
```

Für eine gezielte manuelle Ausführung bleibt der Einzelaufruf möglich:

```bash
php bin/process-fairgate-registrations.php
```

Für eine produktive Installation wird eine Ausführung alle zwölf Stunden
empfohlen. Ein Fehler bei einer einzelnen Fairgate-Anfrage wird protokolliert;
andere fällige Anfragen werden trotzdem weiterverarbeitet. Bei Fehlern beendet
der Prozess den Lauf mit Exit-Code `1`, damit die Prozessüberwachung dies
erkennen kann.

Schlägt die vorgelagerte Kontaktsynchronisation fehl, überspringt der Runner
die Registrierungsprüfung. Im Fake-Modus wird nur die Kontaktsynchronisation
übersprungen; die dynamische E-Mail-Auswertung bleibt aktiv.

Der frühere Order-Batch fragt Fairgate nicht mehr ab. `process-orders.php`
verarbeitet nur noch die bestehende E-Mail-Queue und die Token-Bereinigung;
`process-all-batches.php` verbindet die Kontaktsynchronisation und beide
Aufgaben für den Cronbetrieb.
