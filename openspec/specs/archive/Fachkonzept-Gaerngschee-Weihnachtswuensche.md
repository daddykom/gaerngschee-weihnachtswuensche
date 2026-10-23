# Fachkonzept Gärngschee-Weihnachtswünsche

## Zweck dieses Dokuments

Dieses Dokument beschreibt das vereinfachte Datenmodell und die Formulare der neuen Weihnachtswünsche-WebApp. Grundlage sind die bisherigen Excel-Listen zur Einreichung und Erfüllung von Wünschen sowie die besprochenen fachlichen Entscheidungen.

Die Umsetzung erfolgt mit derselben Infrastruktur wie Gärngschee-Mässpäggli. Technische Details der bestehenden Infrastruktur werden hier nicht erneut festgelegt.

---

# 1. Grundsätze

- Wunschbesteller und Wunscherfüller geben als Kontaktdatum ausschliesslich ihre E-Mail-Adresse an. Namen, Postadressen und Telefonnummern werden nicht als Stammdaten erfasst.
- Die beiden Seiten erhalten keine Kontaktdaten voneinander.
- Ein Wunschbesteller kann mehrere Wünsche einreichen.
- Ein Wunsch kann höchstens einem Wunscherfüller gleichzeitig zugeordnet sein.
- Ein Wunscherfüller kann mehrere Wünsche übernehmen.
- Wünsche werden erst nach administrativer Freigabe veröffentlicht.
- Öffentliche Texte und vertrauliche Nachrichten werden getrennt gespeichert.
- Der Eingang eines Geschenks wird direkt beim Wunsch dokumentiert.
- Es gibt keine separate Tabelle für Wunschübernahmen.
- Die Weihnachtsaktionen verschiedener Jahre müssen unterscheidbar sein.

**Datenschutzhinweis:** Die E-Mail-Adresse ist ein personenbezogenes Datum. Die Anwendung ist gegenüber anderen Teilnehmenden anonym, nicht gegenüber dem Betreiber. Auch Freitexte können freiwillig personenbezogene Angaben enthalten und müssen vor Veröffentlichung geprüft werden.

---

# 2. Datenbanktabellen

## 2.1 `wish_requesters` – Wunschbesteller

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | BIGINT PK | Interne ID |
| `email` | VARCHAR(254) | E-Mail-Adresse |
| `campaign_year` | SMALLINT | Jahr der Weihnachtsaktion |
| `life_situation` | TEXT | Zur Veröffentlichung vorgesehene Lebenssituation |
| `private_message` | TEXT NULL | Vertrauliche Nachricht an Gärngschee |
| `press_contact_consent` | BOOLEAN | Einwilligung zur Kontaktaufnahme durch Bajour |
| `status` | VARCHAR(30) | Status der Einreichung |
| `internal_notes` | TEXT NULL | Interne Bemerkungen |
| `created_at` | DATETIME | Erfassung |
| `updated_at` | DATETIME | Letzte Änderung |

### Fachliche Regeln

- Ein Wunschbesteller kann mehrere Wünsche einreichen.
- Die Lebenssituation wird pro Einreichung nur einmal erfasst.
- Die vertrauliche Nachricht wird nicht veröffentlicht.
- Die E-Mail-Adresse wird nicht öffentlich angezeigt.
- Eine Einreichung kann geprüft, freigegeben oder abgelehnt werden.
- Die Zuordnung zum Aktionsjahr erfolgt auf Ebene der Einreichung.

## 2.2 `wishes` – Wünsche

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | BIGINT PK | Interne ID |
| `requester_id` | BIGINT FK | Zugehöriger Wunschbesteller |
| `fulfiller_id` | BIGINT FK NULL | Aktuell zugeordneter Wunscherfüller |
| `wish_number` | VARCHAR(20) | Öffentliche Wunschnummer, z. B. `1.2` |
| `description` | TEXT | Wunschbeschreibung |
| `reason` | TEXT | Begründung des Wunsches |
| `publication_status` | VARCHAR(30) | Veröffentlichungsstatus |
| `fulfillment_status` | VARCHAR(30) | Erfüllungsstatus |
| `internal_notes` | TEXT NULL | Interne Bemerkungen |
| `reserved_at` | DATETIME NULL | Zeitpunkt der Übernahme |
| `confirmed_at` | DATETIME NULL | Bestätigung der Übernahme |
| `received_at` | DATETIME NULL | Eingang des Geschenks |
| `created_at` | DATETIME | Erfassung |
| `updated_at` | DATETIME | Letzte Änderung |

### Fachliche Regeln

- Jeder Wunsch gehört genau einem Wunschbesteller.
- Ein Wunsch kann einzeln freigegeben oder abgelehnt werden, unabhängig von anderen Wünschen derselben Einreichung.
- Ein Wunsch darf höchstens einen aktuell zugeordneten Wunscherfüller haben.
- Bei einer stornierten Übernahme kann die Zuordnung aufgehoben und der Wunsch erneut freigegeben werden.
- Eine Historie früherer Übernahmen wird im ersten Schritt nicht benötigt.
- Der Geschenkeingang wird durch Setzen von `received_at` dokumentiert. Ein zusätzliches Datenobjekt ist dafür nicht nötig.
- Die öffentliche Wunschnummer ist eine Zeichenkette und wird innerhalb einer Weihnachtsaktion eindeutig vergeben.
- Der Veröffentlichungsstatus und der Erfüllungsstatus sind unabhängig voneinander.

### Vorgesehene Statuswerte

**Veröffentlichung (`publication_status`):** `submitted`, `approved`, `rejected`.

**Erfüllung (`fulfillment_status`):** `available`, `reserved`, `confirmed`, `received`, `completed`.

Die konkreten Übergänge werden in der Umsetzung festgelegt. Die Werte sind ein Vorschlag, keine aus den Excel-Dateien belegte bestehende Statusdefinition.

## 2.3 `wish_fulfillers` – Wunscherfüller

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | BIGINT PK | Interne ID |
| `email` | VARCHAR(254) | E-Mail-Adresse |
| `created_at` | DATETIME | Erste Erfassung |

### Fachliche Regeln

- Als Kontaktdatum wird ausschliesslich die E-Mail-Adresse erfasst.
- Ein Wunscherfüller kann mehrere Wünsche übernehmen.
- Die E-Mail-Adresse wird nicht an Wunschbesteller weitergegeben.

## 2.4 Beziehungen

- `wish_requesters` 1:n `wishes`
- `wish_fulfillers` 1:n `wishes` (auf Wunschseite optional)
- Die Übernahme wird ausschliesslich in `wishes` gespeichert; `wish_assignments` entfällt.

---

# 3. Formulare

Die folgenden Tabellen beschreiben **nur Labels und Feldnamen**, ohne HTML oder technische UI-Vorgaben.

## 3.1 Wünsche einreichen – Angaben zur Einreichung

| Label | Feldname |
|---|---|
| E-Mail-Adresse | `email` |
| Beschreibe kurz deine Lebenssituation | `life_situation` |
| Vertrauliche Nachricht an Gärngschee (optional) | `private_message` |
| Darf Bajour dich für einen Artikel kontaktieren? | `press_contact_consent` |

## 3.2 Wünsche einreichen – Wunsch (wiederholbar)

| Label | Feldname |
|---|---|
| Was wünschst du dir? | `description` |
| Warum wünschst du dir das? | `reason` |

### Fachliche Regeln

- Bei einer Einreichung können mehrere Wünsche erfasst werden.
- Die Angaben zur Lebenssituation und die vertrauliche Nachricht werden nicht für jeden Wunsch erneut abgefragt.
- Die zur Veröffentlichung vorgesehenen Texte werden vor Veröffentlichung administrativ geprüft.
- Nach der Einreichung wird eine Bestätigung per E-Mail verschickt.

## 3.3 Wunsch übernehmen

| Label | Feldname |
|---|---|
| Wunschnummer | `wish_number` |
| E-Mail-Adresse | `email` |

### Fachliche Regeln

- Die Wunschnummer ergibt sich aus dem ausgewählten Wunsch.
- Die Übernahme wird dem Wunsch zugeordnet.
- Der Wunscherfüller erhält eine Bestätigung per E-Mail mit den notwendigen Angaben zur Geschenkabgabe.
- Die Übernahme darf bei gleichzeitigen Anfragen nur einmal erfolgreich sein.

## 3.4 Administration – Einreichung prüfen

| Label | Feldname |
|---|---|
| Status der Einreichung | `status` |
| Interne Bemerkungen | `internal_notes` |
| Lebenssituation | `life_situation` |
| Vertrauliche Nachricht | `private_message` |
| Einwilligung Bajour-Kontakt | `press_contact_consent` |

## 3.5 Administration – Wunsch bearbeiten

| Label | Feldname |
|---|---|
| Wunschnummer | `wish_number` |
| Wunschbeschreibung | `description` |
| Begründung | `reason` |
| Veröffentlichungsstatus | `publication_status` |
| Erfüllungsstatus | `fulfillment_status` |
| Interne Bemerkungen | `internal_notes` |
| Zugeordneter Wunscherfüller | `fulfiller_id` |
| Geschenk eingetroffen am | `received_at` |

### Fachliche Regeln

- Die Administration kann Wünsche einzeln freigeben oder ablehnen.
- Ein eingetroffenes Geschenk wird durch das Setzen des Eingangsdatums dokumentiert.
- Eine stornierte Übernahme kann aufgehoben werden; der Wunsch wird dadurch wieder verfügbar.

---

# 4. Technische und fachliche Hinweise

- Öffentliche API-Antworten enthalten keine E-Mail-Adressen, vertraulichen Nachrichten oder internen Bemerkungen.
- E-Mail-Adressen werden für die Zuordnung konsistent behandelt.
- Die Reservierung eines Wunsches muss transaktionssicher erfolgen.
- E-Mail-Bestätigungen und gegebenenfalls zeitlich begrenzte Verifizierungslinks werden analog zur bestehenden Mässpäggli-Infrastruktur umgesetzt.
- Aufbewahrungs- und Löschfristen sind vor dem produktiven Betrieb festzulegen.
- Für das Schema sind geeignete Fremdschlüssel und Indizes vorzusehen.

# 5. Noch nicht abschliessend festgelegt

- Können Wunschbesteller ihre Einreichungen nachträglich selbst über einen E-Mail-Link bearbeiten?
- Wie genau erfolgt die Berechtigungsprüfung der Wunschbesteller?
- Wann gilt ein Geschenk nach dem Eingang als abgeschlossen beziehungsweise übergeben?
- Welche Erinnerungs-E-Mails und Fristen werden benötigt?
- Werden E-Mail-Adressen über mehrere Aktionsjahre hinweg wiederverwendet oder pro Aktion getrennt geführt?

Diese Punkte sind bewusst offen und sollen nicht ohne fachliche Entscheidung implementiert werden.
