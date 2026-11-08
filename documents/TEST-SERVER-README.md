# Alles über den Testserver Weihnachtswünsche
## Ziel des Testservers
Der Testserver soll ermöglichen, eine Version der Weihnachtswünsche Applikation fachlich zu testen, bevor sie ins Produktive Umfeld gespielt wird.
## Unterschied zur Produktion
1. Der Zugang ist nicht öffentlich bekannt, sondern nur eingeweihte Personen kennen den Zugang.
2. Fairgate wird bei der Eingabe der E-Mail-Adresse synchron geprüft. Wartende
   Adressen werden zusätzlich im 12-Stunden-Batch geprüft.
## Ablauf Bezüger
1. Bezüger gibt die Email-Adresse ein.
   Bei einem Fairgate-Kontakt erhält er den persönlichen Zugangslink.
   Ohne Fairgate-Kontakt erhält er nur den Fairgate-Anmeldelink und keinen
   Zugangslink für die Weihnachtswünsche.
2. Die Bezüger setzen kein Passwort, sie können nur über Email und Zugangslink anmelden
3. Bezüger wird bei Fairgate gefunden: er kann gleich seine Wünsche erfassen.
4. Bezüger wird **nicht** bei Fairgate gefunden: Nach der Anmeldung bei Fairgate
   prüft der 12-Stunden-Batch die Adresse erneut. Bei einem Treffer erhält er
   eine E-Mail mit dem allgemeinen Startseiten-Link und muss seine E-Mail-Adresse
   dort erneut eingeben.
5. Weihnachtswünsche-Admin gibt die definitiven Bestellungen frei.
   Bezüger erhält eine Email mit dem Scan-Code
6. Bezüger holt die Weihnachtswünsche ab
## Ablauf User
1. User benötigen einen Zugangsaccount mit Passwort, der ihnen vom Admin vergeben wurde.
2. User haben nur Zugang zur Lieferseite
3. User rufen eine Bestellung auf
- über den Scancode
- über die Email-Adresse
4. User klickt auf den Button, dass die Lieferung erfolgt ist.
-  Bestätigt, dass er einen Ausweis gesehen hat, wenn mit der Email aufgerufen wurde
5. User kann eine Lieferung wieder rückgängig machen
## Ablauf Administrator
1. Admin benötigt einen Zugangsaccount mit Passwort und Admin-Rechten
2. Admin landet nach dem Anmelden auf der Übersichtsseite, wo ihm die Zahlen der Bestellungen angezeigt werden.
3. Admin kann die bestehenden definitiven Bestellungen ausliefern, dann erhalten alle diese Bezüger einen Scancode
4. Admin kann User und andere Admin Accounts erstellen
5. Admin kann auch ausliefern (siehe User)
6. Admin kann die Konfigurationen ändern
- Anmeldelink Fairgat
7. Fairgate-Test: es kann getestet werden, ob der Fairgate-Zugang aktuell funktioniert.
## Spezielle Testverfahren
### Fairgate - Fake-Modus
Damit alle Varianten einer Bestellung getestet werden kann, ist die Schnittstelle zu Fairgate im FakeModus. Der Fake-Modus ermöglicht, über die Email-Adresse die Reaktion des Systems zu beeinflussen.

### Email - Beeinflussung
Die Email-Server haben eine Eigenschaft, welche die meisten Benutzer nicht kennen.

Eine Email besteht aus einem Domain-Teil ( alles nach dem @) und einem lokalen Teil (von vorden bis @ **oder +**).

Das bedeutet, dass alles vom ersten + bis zum @ ignoriert wird.

**Und das ermöglicht uns, den Fake-Modus der Fairgate-Schnittstelle zu steuern!**

Steht nach dem + (vor dem @) irgendwo fair1, fair2, fair3, oder fair4, dann
meldet die Fairgate-Schnittstelle einen erfolgreichen Zugriff zurück. Andernfalls
wird die Adresse als wartend gespeichert und im Fairgate-Registrierungsbatch
erneut geprüft.

Das ermöglicht auch, mit empfang der selben Email-Adresse bei Weihnachtswünsche-Test viele verschiedene Bezüger erfassen zu können, denn es wird die ganze Email verwendet, inkl. + usw.
### Beispiele

| E-Mail-Adresse | Simuliertes Ergebnis |  
|---|---|  
| `person+fair1@example.com` | Kontakt gefunden, 2 Erwachsene und 3 Kinder |  
| `person+fair1-alice@example.com` | Dasselbe Profil wie `fair1`, aber eine weitere eindeutige Testadresse |  
| `person+fair2@example.com` | Kontakt gefunden, 1 Erwachsener und 2 Kinder |  
| `person+fair3@example.com` | Kontakt gefunden, 2 Erwachsene und 0 Kinder |  
| `person+fair4@example.com` | Kontakt gefunden, 2 Erwachsene und 7 Kinder |  
| `person+test@example.com` | Kein Kontakt gefunden |  
| `person@example.com` | Kein Kontakt gefunden |
