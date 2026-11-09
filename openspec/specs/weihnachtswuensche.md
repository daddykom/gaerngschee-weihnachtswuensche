---
created: 2026-10-23
updated: 2026-10-23
---

# Fachkonzept Gärngschee-Weihnachtswünsche

Dieses Dokument ist das verbindliche fachliche Gesamtkonzept für die
Weihnachtswünsche-Plattform. Die früheren Fachkonzepte wurden als historische
Quellen unter `openspec/specs/archive/` archiviert.

## 1. Zweck und Grundsätze

Die Plattform ermöglicht Familien mit knappen finanziellen Mitteln, Wünsche
für eine Weihnachtsaktion einzureichen. Wunscherfüller können einzelne,
freigegebene Wünsche anonymisiert auswählen, die Geschenke kaufen und bei
Gärngschee abgeben.

Verbindliche Begriffe:

- **Wunschbesteller:** Eine Person, die normalerweise eine Familie vertritt.
- **Order / Bestellung:** Die gesamte Einreichung eines Wunschbestellers.
- **OrderItem / Wunsch:** Ein einzelner Wunsch innerhalb einer Order.
- **Wunscherfüller:** Eine Person, die einzelne Wünsche übernimmt.
- **Administrator:** Prüft und verwaltet Orders, Wünsche und den Ablauf.

Weitere Grundsätze:

- Eine Order wird ausschließlich über die E-Mail-Adresse des
  Wunschbestellers identifiziert.
- Namen, Postadressen und Telefonnummern werden nicht als Stammdaten der
  Order erfasst.
- Die Kontaktdaten von Wunschbestellern und Wunscherfüllern werden nicht an
  die jeweils andere Seite weitergegeben.
- Ein Wunschbesteller kann eine Order mit mehreren einzelnen Wünschen
  erfassen.
- Ein OrderItem kann höchstens einem Wunscherfüller gleichzeitig zugeordnet
  sein.
- Ein Wunscherfüller kann mehrere OrderItems aus verschiedenen Orders
  übernehmen.
- Öffentliche Wunschtexte und vertrauliche/interne Informationen werden
  getrennt behandelt.
- Eine definitive Order kann vom Wunschbesteller nicht mehr verändert werden.

## 2. Kampagne

Die Weihnachtsaktion ist einem Kalenderjahr zugeordnet und wird durch zwei
Grenzen beschränkt:

- einen konfigurierbaren Start- und Endzeitpunkt;
- eine konfigurierbare maximale Anzahl von Wünschen bzw. OrderItems.

Orders und Wünsche verschiedener Aktionsjahre müssen getrennt auswertbar
sein.

## 3. Order und OrderItems

### 3.1 Order

Eine Order repräsentiert die Wünsche einer Familie.

Mindestens erforderliche Daten:

| Feld | Beschreibung |
|---|---|
| `id` | Interne Identifikation |
| `requester_email` | E-Mail-Adresse des Wunschbestellers |
| `campaign_year` | Aktionsjahr |
| `status` | Status der gesamten Order |
| `original_text` | Ursprünglicher Text der Order |
| `current_text` | Aktuell gültiger Text der Order |
| `admin_notes` | Interne Bemerkungen der Administration |
| `fairgate_status` | Ergebnis der Fairgate-Prüfung |
| `adults_count` | Im Order abgelegte Anzahl Erwachsene |
| `children_count` | Im Order abgelegte Anzahl Kinder |
| `fairgate_adults_count` | Von Fairgate gelieferte Anzahl Erwachsene, falls vorhanden |
| `fairgate_children_count` | Von Fairgate gelieferte Anzahl Kinder, falls vorhanden |
| `processing_year` | Verarbeitungsjahr für Aufbewahrung und Löschung |
| `released_at` | Letzte Freigabe durch den Wunschbesteller |
| `definitive_at` | Zeitpunkt der definitiven Freigabe |
| `created_at` | Erfassung |
| `updated_at` | Letzte Änderung |

Eine Order enthält mindestens ein OrderItem. Die E-Mail-Adresse ist die
einzige Identifikation des Wunschbestellers innerhalb der Order.

### 3.2 OrderItem

Jeder einzelne Wunsch wird als OrderItem gespeichert.

Mindestens erforderliche Daten:

| Feld | Beschreibung |
|---|---|
| `id` | Interne Identifikation |
| `order_id` | Zugehörige Order |
| `original_description` | Ursprüngliche Wunschbeschreibung |
| `current_description` | Aktuell gültige Wunschbeschreibung |
| `original_reason` | Ursprüngliche Begründung |
| `current_reason` | Aktuell gültige Begründung |
| `publication_status` | Status der Veröffentlichung/Freigabe |
| `fulfillment_status` | Status der Erfüllung |
| `admin_notes` | Interne Bemerkungen |
| `fulfiller_email` | E-Mail des zugeordneten Wunscherfüllers |
| `reserved_at` | Zeitpunkt der Übernahme |
| `due_at` | Abgabe-Endtermin |
| `received_at` | Zeitpunkt des Geschenkeingangs |

Die maximale Anzahl der OrderItems darf die Anzahl der Familienmitglieder
nicht überschreiten. Die Anzahl der Erwachsenen und Kinder wird aus Fairgate
übernommen:

```text
maximale OrderItems = adults_count + children_count
```

Die Anwendung muss verhindern, dass mehr Wünsche erfasst werden, als nach
dieser Regel zulässig sind. Für die maximale Aktionsgrenze zählen alle
erfassten OrderItems, auch wenn die Order noch nicht freigegeben ist.

Frühere Texte von Order und OrderItems müssen erhalten bleiben. Dafür werden
die ursprünglichen und die aktuell gültigen Texte getrennt gespeichert.

## 4. Wunschbesteller: Zugang und Bearbeitung

### 4.1 Erstzugang

- Der Wunschbesteller startet den Vorgang mit seiner E-Mail-Adresse.
- Für den Erstzugang wird ein zeitlich begrenzter, einmaliger Link versendet.
- Nach dem Öffnen des Links wird die E-Mail-Adresse zunächst bei Fairgate in
  der Liste `Klient*innen` gesucht.
- Wird der Wunschbesteller gefunden, werden die Anzahl der Erwachsenen und
  Kinder aus Fairgate übernommen. Dadurch kann die zulässige Anzahl der
  OrderItems bereits beim Erfassen begrenzt werden. Erst danach kann eine
  Order erstellt werden.
- Wird der Wunschbesteller nicht gefunden, erhält er ausschließlich den Link
  zur Anmeldung bei Fairgate. Es wird keine Order erstellt und es gibt keinen
  Zugang zur Anwendung. Ohne Fairgate-Eintrag kann er sich nicht anmelden.
- Beim ersten erfolgreichen Zugang muss der Wunschbesteller ein Passwort
  erfassen.
- Danach kann er sich mit E-Mail-Adresse und Passwort anmelden.

### 4.2 Bearbeitung

Der Wunschbesteller kann eine Order bearbeiten, solange sie nicht definitiv
ist. Dazu gehören insbesondere:

- Order-Text erfassen oder ändern;
- OrderItems hinzufügen, ändern oder entfernen;
- die vorhandenen Fairgate-basierten Grenzen einhalten;
- eine zurückgewiesene Order oder zurückgewiesene Wünsche korrigieren.

Nach jeder Änderung muss die Order erneut zur administrativen Prüfung
eingereicht werden.

## 5. Freigabe und administrative Prüfung

### 5.1 Einreichung durch den Wunschbesteller

Der Wunschbesteller meldet sich an und erfasst seine Wünsche. Sobald er seine
Bestellung einreicht, wird sie dem Administrator zur Prüfung vorgelegt. Die
Bestellung ist dadurch noch nicht öffentlich.

### 5.2 Fairgate als Voraussetzung

Eine Order kann nur für einen Wunschbesteller erstellt werden, der in Fairgate
gefunden wurde. Die Anzahl der Erwachsenen und Kinder wird aus Fairgate
übernommen und begrenzt die Anzahl der möglichen Wünsche. Wird die maximale
Anzahl überschritten, muss der Wunschbesteller einen Wunsch entfernen oder
korrigieren. Dafür gibt es keinen eigenen Order-Status.

Die Fairgate-Suche findet vor der Erstellung der Order statt. Deshalb kann
eine Order nicht auf einen Zustand "wartet auf Fairgate" gesetzt werden.

### 5.3 Prüfung durch Administratoren

Administratoren können:

- den Text der gesamten Order korrigieren;
- den Text einzelner OrderItems korrigieren;
- die im Order abgelegte Anzahl der Erwachsenen und Kinder korrigieren;
- einzelne Wünsche akzeptieren oder ablehnen;
- interne Bemerkungen zur Order oder zu einzelnen Wünschen erfassen.

Die bisherigen Texte bleiben erhalten. Korrekturen werden als aktuelle Texte
angezeigt und dürfen nicht die ursprüngliche Eingabe zerstören.

Bei der Prüfung entscheidet der Administrator für jeden einzelnen Wunsch, ob
er ihn akzeptiert oder zurückweist. Bei einer Ablehnung:

- wird der Wunschbesteller per E-Mail informiert;
- werden die Ablehnungsgründe bzw. Bemerkungen angezeigt;
- muss der Wunschbesteller die betroffenen Angaben überarbeiten;
- geht die Bestellung an den Wunschbesteller zurück;
- muss der Wunschbesteller den zurückgewiesenen Wunsch korrigieren;
- muss die Bestellung anschließend erneut eingereicht und geprüft werden.

Sind alle Wünsche akzeptiert und ist die Bestellung fachlich plausibel, kann
der Administrator die Bestellung veröffentlichen. Dazu stellt er sie auf
`definitive`. Erst ab diesem Zeitpunkt sind die Wünsche für Wunscherfüller
sichtbar und auswählbar. Danach ist die Bestellung für den Wunschbesteller
gesperrt.

## 6. Statusmodell

### 6.1 Order-Status

Die Order verwendet folgende Zustände. Die deutsche Bezeichnung entspricht
der Übersetzung in `frontend/public/i18n/de.json`:

| Technischer Wert | Deutsche Übersetzung | Situation |
| --- | --- | --- |
| `draft` | Entwurf | Der Wunschbesteller erstellt oder korrigiert seine Bestellung. |
| `released` | Freigegeben | Die Bestellung ist zur administrativen Prüfung eingereicht. |
| `in_review` | In Prüfung | Der Administrator prüft die Bestellung und die einzelnen Wünsche. |
| `changes_requested` | Änderungen verlangt | Mindestens ein Wunsch wurde zurückgewiesen; der Wunschbesteller muss korrigieren. |
| `definitive` | Definitiv | Alle Wünsche sind akzeptiert und die Bestellung ist veröffentlicht. Wunscherfüller können Wünsche auswählen. |
| `ready_for_pickup` | Bereit zur Abholung | Alle ausgewählten Wünsche sind eingetroffen; der Wunschbesteller erhält einen QR-Code. |
| `completed` | Abgeschlossen | Die Wünsche wurden mit dem QR-Code abgeholt. |

Der reguläre Ablauf ist:

```text
draft
  → released
  → in_review
  → definitive
  → ready_for_pickup
  → completed
```

Bei einer Korrektur läuft die Bestellung über:

```text
in_review
  → changes_requested
  → draft
  → released
  → in_review
```

Die Freigabe einzelner Wünsche und die Veröffentlichung der gesamten
Bestellung sind getrennte Entscheidungen. Die Bestellung darf erst auf
`definitive` gesetzt werden, wenn alle Wünsche akzeptiert und die fachlichen
Plausibilitätsregeln erfüllt sind.

## 7. Erfüllung durch Wunscherfüller

- Wunscherfüller sehen ausschließlich anonymisierte Wünsche aus definitiven
  Bestellungen, die noch nicht ausgewählt wurden.
- Sie können einzelne OrderItems auswählen.
- Die Auswahl muss transaktionssicher erfolgen, damit ein Wunsch nicht
  gleichzeitig mehrfach übernommen wird.
- Nach erfolgreicher Übernahme erhält der Wunscherfüller eine
  Bestätigungs-E-Mail.
- Die E-Mail enthält den Abgabe-Endtermin und die notwendigen Angaben zur
  Geschenkabgabe.
- Der Wunscherfüller bringt den ausgewählten Wunsch zur vorgesehenen
  Abgabestelle beziehungsweise zum vereinbarten Termin vorbei.
- Solange das Geschenk nicht eingetroffen ist, werden regelmäßig
  Erinnerungs-E-Mails verschickt.
- Eine Zuordnung kann nur durch einen Administrator storniert und das
  OrderItem wieder verfügbar gemacht werden.

Eine separate Tabelle für Wunschübernahmen ist zunächst nicht erforderlich;
die aktuelle Zuordnung wird am OrderItem gespeichert.

## 8. Geschenkeingang und Abholung

- Der Eingang jedes Geschenks wird direkt am OrderItem mit `received_at`
  dokumentiert.
- Eine Order ist vollständig, wenn alle zugehörigen definitiven OrderItems
  eingetroffen sind.
- Erst dann wird der Wunschbesteller per E-Mail informiert.
- Die E-Mail enthält einen QR-Code und einen Abholtermin.
- Der QR-Code identifiziert genau die Order bzw. Familie.
- Bei der Abholung können einzelne OrderItems geprüft und als abgegeben
  markiert werden.
- Eine teilweise Abgabe ist möglich.
- Eine bestätigte Abgabe kann durch berechtigte Mitarbeitende rückgängig
  gemacht werden.
- Nach vollständiger Abgabe ist die Order abgeschlossen.

## 9. E-Mail-Kommunikation

Die Anwendung versendet mindestens:

- Link für den Erstzugang;
- Bestätigung der Erfassung und Freigabe;
- Link zur Fairgate-Anmeldung, wenn kein Fairgate-Eintrag vorhanden ist;
- Information über administrative Korrekturen oder Ablehnungen;
- Bestätigung der definitiven Order;
- Bestätigung an Wunscherfüller mit Abgabe-Endtermin;
- Erinnerungen an Wunscherfüller;
- Information über die vollständige Lieferung;
- QR-Code und Abholtermin.

E-Mail-Vorlagen und relevante Fristen sollen administrativ konfigurierbar
sein. Nach vollständiger Abgabe werden keine weiteren Liefererinnerungen
versendet.

## 10. Datenschutz

- E-Mail-Adressen sind personenbezogene Daten und werden nicht öffentlich
  angezeigt.
- Öffentliche Wunschlisten enthalten keine E-Mail-Adressen,
  Zugangsdaten, internen Bemerkungen oder vertraulichen Nachrichten.
- Freitexte können freiwillig personenbezogene Angaben enthalten und müssen
  vor Veröffentlichung geprüft werden.
- Wunscherfüller und Wunschbesteller erhalten keine Kontaktdaten voneinander.
- Jede Order erhält ein Verarbeitungsjahr aus der Konfiguration.
- Ein regelmäßiger Batch löscht Daten nach drei Jahren automatisch.
- Eine Anonymisierung ist nicht vorgesehen, da als Wunschbesteller-
  Identifikation ausschließlich die E-Mail-Adresse gespeichert wird.

## 11. Noch zu entscheiden

Folgende Punkte werden über die Konfiguration festgelegt:

- Fristen für Erstzugang, Abgabe und Erinnerungs-E-Mails;
- Abholtermine;
- maximale Anzahl erfasster Wünsche;
- Verarbeitungsjahr.

Die Aufbewahrungsdauer beträgt drei Jahre und wird nicht anonymisiert.
