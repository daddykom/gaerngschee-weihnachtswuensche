# Bedienungsanleitung Gärngschee-Weihnachtswünsche

## Zweck der Anwendung

Die Anwendung unterstützt Gärngschee bei der Verwaltung von Weihnachtswünsche-
Bestellungen und deren Auslieferung. Je nach Benutzergruppe stehen
unterschiedliche Funktionen zur Verfügung.

Die Anwendung ist für Computer, Tablets und Mobiltelefone geeignet. Die
Bedienung erfolgt über die angezeigten Schaltflächen, Links und Formulare.

## Benutzergruppen

| Benutzergruppe | Aufgabe |
|---|---|
| Besucher | Öffentliche Informationen ansehen und eine Bestellung anfragen |
| Erfüller | Einzelne Weihnachtswünsche auswählen und erfüllen |
| Klient | Eine eigene Bestellung erfassen und bestätigen |
| Mitarbeitende | Bestellungen suchen und ausliefern |
| Administratoren | Anwendung, Benutzer und Konfiguration verwalten |

Mitarbeitende verwenden die Benutzergruppe `user`. Administratoren verwenden
die Benutzergruppe `admin`.

## Allgemeine Bedienung

### Startseite

Auf der Startseite werden das Aktionsjahr und der aktuelle Stand der Kampagne
angezeigt.

Unter **Weihnachtswünsche erfüllen** können verfügbare Wünsche ausgewählt und
einzeln erfüllt werden.

Unter **Weihnachtswünsche erhalten** kann während einer offenen Kampagne eine Anfrage
gestartet werden. Vor dem Kampagnenstart wird das Startdatum angezeigt. Nach
dem Kampagnenende wird angezeigt, dass die Aktion beendet ist.

Nicht angemeldete Benutzer sehen den Link **Anmelden**. Angemeldete Benutzer
sehen stattdessen **Abmelden**.

### An- und Abmelden

1. Auf der Startseite den Link **Anmelden** öffnen.
2. E-Mail-Adresse und Passwort eingeben.
3. **Anmelden** auswählen.
4. Nach erfolgreicher Anmeldung wird je nach Benutzergruppe die passende
   Seite geöffnet.

Administratoren können das Administrationsmenü über die Menüschaltfläche im
Kopfbereich öffnen. Dort befindet sich der Eintrag **Abmelden**.

Jeder Logout führt zurück auf die Startseite. Nach dem Logout werden die
geschützten Funktionen und das Administrationsmenü nicht mehr angezeigt.

### Sitzungsablauf

Die Anwendung überwacht die Sitzung. Wenn die Sitzung bald abläuft, erscheint
ein Dialog. Mit **Angemeldet bleiben** kann die Sitzung verlängert werden.
Mit **Abmelden** wird die Sitzung beendet.

Wenn die Sitzung bereits abgelaufen ist, muss die Anmeldung erneut durchgeführt
werden.

## Besucher und Erfüller

### Öffentliche Informationen ansehen

Die Startseite ist ohne Anmeldung erreichbar. Dort werden das Aktionsjahr, die
Informationen für Erfüller und die Möglichkeit für eine Bestellung angezeigt.

### Weihnachtswünsche erfüllen

1. Auf der Startseite die Übersicht der verfügbaren Weihnachtswünsche öffnen.
2. Einen einzelnen Weihnachtswunsch auswählen.
3. Die Erfüllung des Wunsches bestätigen.

Der ausgewählte Wunsch wird danach als erfüllt gekennzeichnet und steht anderen Erfüllern nicht mehr zur Auswahl.

### Eine Bestellung anfragen

1. Auf der Startseite **Weihnachtswünsche anfragen** auswählen.
2. Die E-Mail-Adresse eingeben.
3. **Weiter** auswählen.
4. Den persönlichen Link aus der E-Mail öffnen.

Aus Datenschutzgründen wird keine Auskunft darüber gegeben, ob die E-Mail-
gültig und kann nur einmal verwendet werden.

## Klienten

### Persönlichen Bestelllink verwenden

Klienten erhalten den Zugang zur Bestellung über einen persönlichen Link per
E-Mail. Der Link wird nach der Anfrage an die angegebene E-Mail-Adresse
versendet.

Beim Öffnen des Links wird die Anmeldung automatisch durchgeführt und die
Bestellseite geöffnet. Ein persönliches Passwort ist für diesen Zugang nicht
erforderlich.

Ist der Link ungültig oder abgelaufen, wird zur Startseite zurückgeführt. Dort
kann ein neuer Link angefordert werden.

### Fairgate-Prüfung

Wenn die E-Mail-Adresse in Fairgate gefunden wird, übernimmt die Anwendung die
Anzahl der Erwachsenen, die Anzahl der Kinder und die Anrede aus Fairgate.

Wenn kein Fairgate-Konto gefunden wird, erscheint ein Hinweis. In diesem Fall
können die Personenanzahlen manuell erfasst werden. Die Bestellung wird
zunächst provisorisch gespeichert und später erneut geprüft. Auf der
Bestellseite und auf der Bestellübersicht steht ein Fairgate-Link zur Verfügung,
über den die Anmeldung mit derselben E-Mail-Adresse geöffnet werden kann.

### Bestellung erfassen

Wenn keine Kinder angemeldet sind, können Weihnachtswünsche für Erwachsene ausgewählt
werden. Sobald Kinder angemeldet sind, können nur noch Weihnachtswünsche für Kinder
ausgewählt werden.

1. Die angezeigten Personenanzahlen prüfen.
2. Falls kein Fairgate-Konto gefunden wurde, die Anzahl Erwachsene und Kinder
   eingeben.
3. Für jede erwachsene Person die passende Kategorie auswählen.
4. Für jedes Kind die passende Alterskategorie auswählen.
5. **Weiter** auswählen.

Die Alterskategorie muss für jede angezeigte Person ausgewählt werden. Nicht
ausgefüllte Pflichtfelder werden beim Absenden markiert.

### Bestellung prüfen und speichern

Auf der Bestellübersicht werden die ausgewählten Kategorien und der erwartete
Status angezeigt. Wenn die Fairgate-Prüfung noch nicht erfolgreich war, wird
auch dort der Link zur Fairgate-Anmeldung angezeigt.

- **Provisorisch**: Die Berechtigung ist noch nicht definitiv bestätigt.
- **Definitiv**: Die Person wurde in Fairgate gefunden.

Mit **Zurück** kann die Bestellung nochmals bearbeitet werden. Mit
**Bestellen** wird die Bestellung gespeichert.

Nach dem Speichern erscheint eine Bestätigung. Bei einer provisorischen
Bestellung wird zusätzlich eine Bestätigungs-E-Mail mit dem Fairgate-Link
versendet. Die Sitzung wird beendet und die Anwendung kehrt zur Startseite
zurück.

## Mitarbeitende

### Anmeldung

1. Auf der Startseite **Anmelden** auswählen.
2. Die Zugangsdaten eingeben.
3. **Anmelden** auswählen.

Mitarbeitende werden nach der Anmeldung zur Seite **Auslieferung** geführt.

Wenn für das Konto ein Passwortwechsel erforderlich ist, wird zuerst die Seite
**Passwort ändern** angezeigt.

### Bestellung suchen

1. Die Seite **Auslieferung** öffnen.
2. Die E-Mail-Adresse des Klienten eingeben.
3. **Bestellung suchen** auswählen.
4. Die angezeigte Bestellung und die Personendaten prüfen.

Die Seite zeigt unter anderem den Bestellstatus, die Anzahl der Erwachsenen
und Kinder, die Kategorien sowie gegebenenfalls die aus Fairgate übernommenen
Kinder an.

### Bestellung ausliefern

Eine Bestellung kann ausgeliefert werden, wenn sie den Status **QR-Code
versandt** besitzt.

1. Die Bestellung suchen oder den persönlichen Auslieferungslink öffnen.
2. Die Identität des Klienten prüfen.
3. **Ausliefern** auswählen.
4. Bei der Sicherheitsabfrage bestätigen, dass der Ausweis geprüft wurde.

Bei einem persönlichen Auslieferungslink ist keine zusätzliche Bestätigung der
Identitätsprüfung erforderlich.

Nach erfolgreicher Auslieferung erhält die Bestellung den Status
**Ausgeliefert**.

### Auslieferung rückgängig machen

Wenn die Bestellung bereits als **Ausgeliefert** markiert ist, kann die
Auslieferung über **Rückgängig machen** zurückgesetzt werden.

1. Die Bestellung suchen.
2. **Rückgängig machen** auswählen.
3. Die Sicherheitsabfrage bestätigen.

Das Rückgängigmachen steht Mitarbeitenden und Administratoren zur Verfügung,
also den Benutzergruppen `user` und `admin`. Ein Klient kann über den
persönlichen Auslieferungslink nur die Auslieferung bestätigen, nicht aber eine
bereits erfolgte Auslieferung rückgängig machen.

### Eigenes Konto und Passwort

Mitarbeitende können ihre eigenen Benutzerdaten bearbeiten, insbesondere die
E-Mail-Adresse. Die Benutzergruppe und die Passwort-Reset-Pflicht können nur
Administratoren ändern.

Das Passwort kann über **Passwort ändern** geändert werden. Es muss mindestens
12 und höchstens 128 Zeichen lang sein. Leerzeichen und Sonderzeichen sind
erlaubt.

## Administratoren

Administratoren verfügen zusätzlich über das Administrationsmenü im
Kopfbereich.

### Admin-Übersicht

Die **Admin-Übersicht** zeigt die Bestellungen nach Status und Kategorie.

Die Spalten bedeuten:

- **Prov.**: Provisorische Bestellungen, noch nicht bei Fairgate vorhanden
- **P. x Tg**: Provisorische Bestellungen der letzten x Tage
- **Def.**: Definitive Bestellungen
- **Bereit**: Zur Auslieferung gekennzeichnet
- **QR**: QR-Code per E-Mail versandt
- **Gelief.**: Ausgeliefert beziehungsweise vom Bezüger abgeholt

Unter der Tabelle befindet sich eine Legende mit den ausführlichen
Erklärungen.

Die Schaltfläche **Bestellungen ausliefern** ist immer sichtbar, aber bis zum
Ende der Anmeldefrist deaktiviert. Sie wird erst am Tag nach dem
`campaign_end_date` des Verarbeitungsjahres aktiv. Vor dem Ausführen erscheint
eine Bestätigungsabfrage.

Mit **Drucken** kann eine Druckansicht der Übersicht geöffnet werden. Die
Auslieferungsaktionen und die Auslieferungsspalten werden in der Druckansicht
nicht ausgegeben.

### Benutzerverwaltung

Über **Benutzerverwaltung** können Administratoren Benutzerkonten verwalten.

#### Benutzer erstellen

1. **Benutzer erstellen** auswählen.
2. E-Mail-Adresse eingeben.
3. Benutzergruppe auswählen.
4. **Speichern** auswählen.

Das temporäre Passwort beziehungsweise der weitere Zugang wird per E-Mail
versendet, sofern dies angezeigt wird.

#### Benutzer bearbeiten

1. In der Benutzerliste **Bearbeiten** beim gewünschten Konto auswählen.
2. Die gewünschten Werte ändern.
3. **Speichern** auswählen.

Administratoren können E-Mail-Adresse, Benutzergruppe und die Option
**Passwort muss neu gesetzt werden** ändern.

#### Passwort-Reset versenden

In der Benutzerliste **Passwort senden** auswählen. Der Benutzer erhält einen
Link zum Zurücksetzen des Passworts.

#### Benutzer löschen

1. **Löschen** beim gewünschten Konto auswählen.
2. Die Sicherheitsabfrage bestätigen.

Das Konto wird unwiderruflich gelöscht.

### Konfiguration

Über **Konfiguration** können die für die jeweilige Benutzergruppe sichtbaren
Anwendungswerte eingesehen werden. Änderbare Werte sind als Eingabefelder
dargestellt; schreibgeschützte Werte können nicht bearbeitet werden.

1. Den gewünschten Konfigurationswert ändern.
2. Bei Listenwerten Werte hinzufügen oder entfernen.
3. **Konfiguration speichern** auswählen.

Mögliche Konfigurationswerte betreffen unter anderem:

- Aktionsjahr
- Start- und Enddatum der Kampagne
- Übersicht der verfügbaren Weihnachtswünsche
- Fairgate-Link
- Anzahl Tage für die Anzeige neuer provisorischer Bestellungen
- Fairgate-Testkontakt und Erinnerungsintervalle

Ungültige Werte oder fehlende Pflichtangaben werden beim Speichern markiert.

### Fairgate-Test

Die Seite **Fairgate-Test** prüft die Verbindung mit dem hinterlegten
Fairgate-Testkontakt.

1. **Fairgate-Abfrage starten** auswählen.
2. Warten, bis die Anfrage abgeschlossen ist.
3. Das angezeigte Ergebnis prüfen.

Die Funktion steht nur Administratoren zur Verfügung.

### Fairgate-Link in Bestellungen

Der Fairgate-Link wird in der Konfiguration unter **Fairgate-Registrierungslink**
verwaltet. Er wird Klienten angezeigt, wenn die E-Mail-Adresse noch nicht in
Fairgate gefunden wurde. Nach einer Änderung der Konfiguration werden die
öffentlichen Konfigurationsdaten automatisch neu geladen.

## Passwort vergessen

### Link anfordern

1. Auf der Anmeldeseite **Passwort vergessen?** auswählen.
2. E-Mail-Adresse eingeben.
3. **Link anfordern** auswählen.

Wenn ein Konto mit dieser E-Mail-Adresse existiert, wird ein Link zum
Zurücksetzen des Passworts versendet. Die Antwort bleibt aus
Sicherheitsgründen auch bei unbekannten E-Mail-Adressen neutral.

### Neues Passwort setzen

1. Den Link aus der E-Mail öffnen.
2. Neues Passwort eingeben.
3. Neues Passwort bestätigen.
4. **Passwort setzen** auswählen.

Das Passwort muss mindestens 12 und höchstens 128 Zeichen enthalten. Nach
erfolgreicher Änderung kann man sich mit dem neuen Passwort anmelden.

Ein abgelaufener oder bereits verwendeter Link kann nicht erneut verwendet
werden.

## Kampagnenstatus

Der Kampagnenstatus wird anhand der konfigurierten Start- und Enddaten und der
Zeitzone `Europe/Zurich` bestimmt.

- **Noch nicht gestartet**: Das Startdatum liegt in der Zukunft.
- **Offen**: Das aktuelle Datum liegt innerhalb des Kampagnenzeitraums.
- **Beendet**: Das Enddatum liegt in der Vergangenheit.

Während einer offenen Kampagne können Klienten neue Bestellungen starten. Die
Schaltfläche zum Ausliefern aller Bestellungen in der Admin-Übersicht ist in
dieser Zeit ausgeblendet.

## Fehler und Hinweise

- Bei einem ungültigen Formularfeld wird die passende Fehlermeldung direkt am
  Feld angezeigt.
- Bei Netzwerk- oder Serverfehlern wird eine allgemeine Fehlermeldung
  angezeigt. Die Eingabe kann später wiederholt werden.
- Geschützte Seiten sind nur für die dafür berechtigten Benutzergruppen
  erreichbar.
- Bei fehlender Berechtigung wird keine geschützte Seite geöffnet.
- Ein persönlicher Registrierungs-, Bestell- oder Passwort-Reset-Link kann nur
  innerhalb seiner Gültigkeitsdauer verwendet werden.

## Wichtigste Seiten

| Seite | Zweck |
|---|---|
| `/` | Öffentliche Startseite |
| `/start` | Bestellung per E-Mail anfordern |
| `/login` | Anmeldung für Mitarbeitende und Administratoren |
| `/client-login` | Persönlichen Client-Login-Link verarbeiten |
| `/order/edit` | Bestellung erfassen oder bearbeiten |
| `/order/summary` | Bestellung prüfen und speichern |
| `/delivery` | Bestellung suchen und ausliefern |
| `/admin/overview` | Übersicht der Bestellungen |
| `/admin/users` | Benutzerverwaltung |
| `/admin/configuration` | Anwendungskonfiguration |
| `/admin/fairgate-test` | Fairgate-Verbindung testen |

Die Anwendung navigiert normalerweise automatisch zur passenden Seite. Das
manuelle Eingeben geschützter URLs ist daher in der Regel nicht notwendig.
