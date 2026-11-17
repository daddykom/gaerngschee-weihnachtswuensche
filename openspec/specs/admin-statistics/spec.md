# Admin-Kennzahlen

- `/admin/statistics` ist über den Admin-Menüeintrag „Kennzahlen“ erreichbar.
  Nur Administratoren erhalten Zugriff; die bestehende Bearbeitungsübersicht
  und ihre Filter bleiben unverändert.
- `GET /admin/statistics` verwendet ausschliesslich das konfigurierte
  `campaign_year`. Listenfilter oder ein Jahr in Query-Parametern schränken die
  Abfrage nicht ein. Die Antwort enthält nur Jahr und aggregierte Ganzzahlen:
  `year`, `orderCount`, `wishCount`, `availableCount`, `pendingConfirmationCount`, `reservedCount`,
  `receivedCount` und `completedCount`, keine personenbezogenen Daten.
- `orderCount` zählt alle Wunschzettel des Jahres unabhängig vom Bestellstatus,
  auch leere Wunschzettel. `wishCount` zählt alle zugehörigen Wünsche unabhängig
  von Kategorie und Veröffentlichungsstatus, einschliesslich Entwürfen und
  zurückgewiesenen Wünschen. Ein Wunschzettel mit mehreren Wünschen zählt nur
  einmal als Wunschzettel.
- Die Erfüllungszahlen zählen ausschliesslich den jeweils gespeicherten
  `fulfillment_status`: `available`, `pending_confirmation`, `reserved`, `received` oder
  `completed`. Sie sind disjunkte Teilmengen der Gesamtzahl, nicht zusätzliche
  Wünsche. Ein leeres Aktionsjahr liefert für alle Kennzahlen `0`.
- „Offene Wünsche“ (`availableCount`) zählt alle Wünsche mit `available`,
  auch Entwürfe und zurückgewiesene Wünsche, unabhängig von ihrer Veröffentlichung.
- Das Backend aggregiert direkt in der Datenbank. Die Seite verwendet einen
  eigenen NgRx-Store mit discriminated union für den Ladezustand und einen
  Route-Resolver für das initiale Laden. Der Progress-Cursor gilt nur während
  der Wartezeit im Resolver und endet auch bei einem Fehler.
- Ladefehler geben die Navigation frei und erscheinen über den globalen
  Notification-Store in der zentralen Informationszone. Es werden keine
  irreführenden Nullwerte angezeigt; die Seite bietet einen erneuten Versuch.
- Kennzahlen haben einen eigenen Übersetzungskontext `app.admin.statistics`.
  Darstellung und Container sind getrennt; das responsive Layout verwendet
  bestehende globale Layout-Primitives.
