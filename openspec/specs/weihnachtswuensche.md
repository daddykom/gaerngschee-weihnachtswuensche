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
  OrderItems bereits beim Erfassen begrenzt werden.
- Wird der Wunschbesteller nicht gefunden, muss er die Anzahl der Erwachsenen
  und Kinder selbst angeben. Die Order wird weiterhin regelmäßig gegen
  Fairgate geprüft.
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

Nach jeder Änderung muss die Order erneut zur Erfüllung freigegeben werden.

## 5. Freigabe und administrative Prüfung

### 5.1 Freigabe durch den Wunschbesteller

Wenn der Wunschbesteller seine Wünsche erfasst hat, kann er die gesamte Order
zur Erfüllung freigeben. Eine freigegebene Order wird nicht automatisch
öffentlich, sondern zunächst geprüft.

### 5.2 Fairgate-Prüfung

Eine Order wird in einem Batch so lange regelmäßig gegen Fairgate geprüft,
bis der Wunschbesteller dort gefunden wurde:

- Es wird mit der E-Mail-Adresse und der Gruppe bzw. Liste `Klient*innen`
  gesucht.
- Wird der Wunschbesteller gefunden, gilt die Order als Fairgate-gültig.
- Aus Fairgate werden mindestens die Anzahl der Erwachsenen und Kinder
  übernommen.
- Ohne gültigen Fairgate-Eintrag wird die Order administrativ nicht weiter
  verarbeitet.
- Der Wunschbesteller erhält Erinnerungs-E-Mails, solange die Anmeldung bei
  Fairgate fehlt.

Nach erfolgreicher Fairgate-Prüfung erfolgen für diesen Zweck keine weiteren
regelmäßigen Fairgate-Suchen. Wird bei der Prüfung festgestellt, dass bereits
mehr Wünsche erfasst sind als Familienmitglieder vorhanden sind, wird die
Order auf `family_size_exceeded` gesetzt. Der Wunschbesteller wird per E-Mail
informiert und muss mindestens einen Wunsch entfernen. Danach kann er die
Order erneut speichern und freigeben.

### 5.3 Prüfung durch Administratoren

Administratoren können:

- den Text der gesamten Order korrigieren;
- den Text einzelner OrderItems korrigieren;
- die im Order abgelegte Anzahl der Erwachsenen und Kinder korrigieren;
- einzelne Wünsche akzeptieren oder ablehnen;
- interne Bemerkungen zur Order oder zu einzelnen Wünschen erfassen.

Die bisherigen Texte bleiben erhalten. Korrekturen werden als aktuelle Texte
angezeigt und dürfen nicht die ursprüngliche Eingabe zerstören.

Bei einer Ablehnung:

- wird der Wunschbesteller per E-Mail informiert;
- werden die Ablehnungsgründe bzw. Bemerkungen angezeigt;
- muss der Wunschbesteller die betroffenen Angaben überarbeiten;
- muss die Order anschließend erneut freigegeben werden.

Sind alle OrderItems akzeptiert und die Order fachlich vollständig, kann der
Administrator die gesamte Order auf `definitive` stellen. Danach ist sie für
den Wunschbesteller gesperrt.

## 6. Statusmodell

### 6.1 Order-Status

Die Order benötigt mindestens folgende fachliche Zustände:

- `draft` – in Bearbeitung durch den Wunschbesteller;
- `waiting_for_fairgate` – gespeichert, aber der Wunschbesteller ist noch
  nicht bei Fairgate gefunden; dieser Zustand liegt vor der Freigabe;
- `released` – gespeichert und zur administrativen Prüfung freigegeben;
- `family_size_exceeded` – Fairgate liefert eine kleinere Familiengrösse als
  die Anzahl der erfassten Wünsche;
- `in_review` – Fairgate-gültig und in administrativer Prüfung;
- `changes_requested` – Änderungen durch den Wunschbesteller erforderlich;
- `definitive` – vollständig akzeptiert und gesperrt;
- `ready_for_pickup` – alle Geschenke sind eingetroffen;
- `completed` – Abholung abgeschlossen.

Beim Speichern der Order gilt:

- Ist der Wunschbesteller bei Fairgate gefunden, wird die Order auf
  `released` gesetzt.
- Ist er nicht gefunden, wird die Order auf `waiting_for_fairgate` gesetzt.
- Der Batch prüft eine Order nur so lange regelmäßig bei Fairgate, bis der
  Wunschbesteller dort gefunden wurde.

### 6.2 OrderItem-Status

Für einzelne Wünsche werden mindestens folgende Zustände benötigt:

- `draft`;
- `submitted`;
- `rejected`;
- `approved`;
- `reserved`;
- `received`;
- `completed`.

Die Veröffentlichung eines OrderItems und seine Erfüllung sind getrennte
Sachverhalte.

## 7. Erfüllung durch Wunscherfüller

- Wunscherfüller sehen ausschließlich anonymisierte, definitive und
  verfügbare Wünsche.
- Sie können einzelne OrderItems auswählen.
- Die Auswahl muss transaktionssicher erfolgen, damit ein Wunsch nicht
  gleichzeitig mehrfach übernommen wird.
- Nach erfolgreicher Übernahme erhält der Wunscherfüller eine
  Bestätigungs-E-Mail.
- Die E-Mail enthält den Abgabe-Endtermin und die notwendigen Angaben zur
  Geschenkabgabe.
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
- Information über fehlende Fairgate-Anmeldung;
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
