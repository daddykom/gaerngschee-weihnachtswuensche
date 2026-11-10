# Deployment

Die Anwendung wird pro Umgebung in einem eigenen Verzeichnis installiert. Das
Verzeichnis kann `prod` oder `pre-prod` heissen:

```text
$HOME/public_html/gaerngschee/weihnachtswuensche/<umgebung>/
├── backend/
│   ├── .env
│   └── public/
└── frontend/
```

Der Webserver verwendet `<deployment>/frontend` als Document-Root. Requests
unter `/api/` werden an `<deployment>/backend/public/index.php` weitergeleitet.
Der Backend-Document-Root wird nicht direkt öffentlich ausgeliefert.
Bei Apache übernimmt `<deployment>/frontend/.htaccess` diese Weiterleitung und
den SPA-Fallback. Die Weiterleitung geht zunächst an die öffentliche
PHP-Bridge unter `<deployment>/frontend/api/index.php`, die den privaten
Backend-Entry-Point lädt. Der externe `/api`-Prefix wird im PHP-Entry-Point
entfernt, bevor Slim die interne Route verarbeitet.

## Environment

Vor dem Start muss eine umgebungsspezifische `backend/.env` auf dem jeweiligen
Server bereitgestellt werden. Diese Datei wird nicht aus dem Repository
übernommen und darf nicht versioniert werden. Alternativ kann der Prozess mit
`GAERNGSCHEE_ENV_FILE` auf eine ausserhalb des Deployment-Verzeichnisses
liegende Environment-Datei zeigen.

Mindestens diese Werte müssen gesetzt werden:

```dotenv
APP_ENV=prod
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=gaerngschee_prod
DB_USER=...
DB_PASS=...
JWT_SECRET=...
FRONTEND_BASE_URL=https://example.org
MAILER_DSN=smtp://...
MAIL_FROM_ADDRESS=...
MAIL_FROM_NAME=Gärngschee-Weihnachtswünsche
FSA_MODE=real
FSA_BASE_URL=https://...
FSA_ORGANIZATION_ID=...
FSA_ACCESS_KEY=...
FSA_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

`APP_ENV` muss `test` oder `prod` sein. Die lokale Entwicklung und die
Integrationstests verwenden `test`. Pre-Production und Production verwenden
`prod`. `FSA_MODE` wird für die gewünschte Fairgate-Variante separat gesetzt:
Pre-Production kann den Fake verwenden, Production den echten Service.

## Installation

```bash
cd <deployment>/backend
composer install --no-dev --optimize-autoloader
vendor/bin/phinx migrate -e production
php bin/sync-fairgate-contacts.php
```

Die Datenbank wird vor dem Aktivieren des neuen Frontend-Builds migriert. Die
Migrationen legen auch die für den Betrieb notwendigen Basisdaten an. Seeds
werden beim Deployment nicht ausgeführt. Vor der Veröffentlichung muss der
Fairgate-Kontaktabgleich erfolgreich abgeschlossen sein. Im Real-Modus wird
ein vollständiger, nicht leerer Bestand vorausgesetzt; im Fake-Modus wird der
Abgleich ausdrücklich übersprungen. Danach wird der Inhalt des Angular-Builds
nach `<deployment>/frontend` veröffentlicht.

## Regelmässige Batch-Prozesse

### Manueller Fairgate-Kontaktabgleich

Nach der Migration für `fairgate_contacts` kann der Kontaktbestand manuell
synchronisiert werden:

```bash
cd <deployment>/backend
php bin/sync-fairgate-contacts.php
```

Das Script verwendet die Environment-Konfiguration und `FSA_MODE`. Im Modus
`real` werden alle Kontakte der Membership `Klient*innen` gelesen. Im Modus
`fake` wird der Kontaktabgleich mit einem Hinweis und Exit-Code `0`
übersprungen, ohne Datenbankzugriff oder Fairgate-Aufrufe. Der lokale
Kontaktbestand bleibt unverändert. Der Fake liefert die benötigten Daten
weiterhin direkt anhand des E-Mail-Markers (`+fair1`, `+fair2` usw.); es gibt
keine feste Kontaktliste und beliebige Testadressen müssen nicht vorab erfasst
werden.

Das Script gibt die Anzahl gelesener, eingefügter, geänderter und gelöschter
Kontakte aus. Exit-Code `0` bedeutet Erfolg. Bei einem Fehler wird die Meldung
nach stderr geschrieben und das Script mit Exit-Code `1` beendet. Leere
Kontaktlisten werden als Löschschutz abgelehnt; bei Abfrage- oder
Schreibfehlern bleibt der bisherige Bestand erhalten.

Das Script ist in den gemeinsamen Batch-Runner und als Voraussetzung vor der
Veröffentlichung in das Deployment-Script eingebunden.

### Gemeinsamer Runner

Die drei Backend-Batches werden im Regelbetrieb über den gemeinsamen Runner
`process-all-batches.php` mindestens einmal innerhalb von zwölf Stunden
ausgeführt. Empfohlen ist ein einziger Cron-Eintrag:

```cron
0 */12 * * * cd /home/<user>/public_html/gaerngschee/weihnachtswuensche/prod/backend && php bin/process-all-batches.php >> /var/log/gaerngschee-batches.log 2>&1
```

Die einzelnen Prozesse verwenden die konfigurierte `backend/.env`. Die
Reihenfolge ist:

1. Fairgate-Kontakte synchronisieren.
2. Wartende Fairgate-Registrierungen anhand des aktualisierten Bestands prüfen.
3. E-Mail-Queue und Bereinigung über den bisherigen Bestellungsbatch verarbeiten.

Bei einem Fehler der Kontaktsynchronisation wird die Registrierungsprüfung
übersprungen, damit sie nicht mit einem veralteten Bestand arbeitet. Der
unabhängige Bestellungsbatch läuft trotzdem. Schlägt die Registrierungsprüfung
fehl, wird der Bestellungsbatch ebenfalls noch ausgeführt. Der Runner beendet
sich mit Exit-Code `1`, wenn mindestens ein Prozess fehlgeschlagen ist.
Im Fake-Modus wird die Synchronisation erfolgreich übersprungen; die übrigen
Batches laufen wie gewohnt.

Ein nicht blockierender Dateilock verhindert parallele Läufe dieses Runners
pro Installation. Ein zweiter Lauf wird mit einem Hinweis und Exit-Code `0`
übersprungen. Kann der Lock nicht geöffnet oder erworben werden, ist der
Exit-Code `1`. Die Lockdatei liegt im temporären Verzeichnis des PHP-Prozesses
und wird anhand des Installationspfads benannt. Sie bleibt bestehen; die Sperre
wird beim Prozessende freigegeben. Direkte Einzelaufrufe der Batch-Scripts
werden von dieser Runner-Sperre nicht erfasst.

## Deployment-Script

Das versionierte Script deployt den `main`-Branch in die für die Umgebung
vorgesehene Installation. Standardmässig wird
`$HOME/public_html/gaerngschee/weihnachtswuensche` als Basisverzeichnis verwendet:

```bash
scripts/deploy-weihnachtswuensche.sh pre-prod
scripts/deploy-weihnachtswuensche.sh prod
```

Die Ziele sind damit:

```text
$HOME/public_html/gaerngschee/weihnachtswuensche/pre-prod/
$HOME/public_html/gaerngschee/weihnachtswuensche/prod/
```

Vor dem ersten Lauf muss in jeder Umgebung die Datei
`<ziel>/backend/.env` vorhanden sein. Das Script überschreibt sie nicht. Das
Basisverzeichnis kann über `DEPLOY_BASE_DIR` und die Repository-URL über
`REPO_URL` geändert werden. Ein produktives Deployment verlangt zusätzlich
die Eingabe `DEPLOY PROD`. Composer wird bewusst aus dem jeweiligen
Zielverzeichnis gestartet, damit Hosting-Umgebungen die dort konfigurierte
PHP-Version verwenden; die Abhängigkeiten werden trotzdem zunächst in einem
temporären Release installiert. Das temporäre Verzeichnis liegt standardmässig
unter `$HOME/tmp`, weil manche Hosting-Server `/tmp` mit `noexec` mounten. Die
Composer-Installation wird aus dem Zielverzeichnis mit
`php84 $HOME/bin/composer install` ausgeführt, wie es die Hosting-Umgebung
vorgibt. Der Composer-Pfad kann über `COMPOSER_BIN` überschrieben werden.
Der Frontend-Production-Build wird auf einem CPU-Kern mit deaktiviertem
Nx-Daemon und deaktiviertem Nx-Native-File-Cache ausgeführt, um die
Hosting-Limits zu berücksichtigen. Die Apache-`.htaccess` wird unabhängig vom
Angular-Asset-Build in das Frontend-Ziel kopiert.

### Fairgate-Kontaktbestand vor der Veröffentlichung

Das Deployment führt im temporären Release zuerst die Phinx-Migrationen und
danach `php84 bin/sync-fairgate-contacts.php` aus. Beide Prozesse verwenden
über `GAERNGSCHEE_ENV_FILE` dieselbe Environment-Datei des Ziels. Geerbte
Datenbank-, `APP_ENV`- und Fairgate-Werte werden für diese Schritte entfernt,
damit insbesondere ein geerbtes `FSA_MODE=fake` den realen Kontaktimport nicht
versehentlich überspringt.

Im Real-Modus bestätigt ein erfolgreicher Kontaktabgleich, dass alle Seiten
gelesen, die Kontaktzuordnungen geprüft und der nicht leere Bestand in einer
Transaktion gespeichert wurden. Erst danach werden Backend und Frontend in
die aktive Installation kopiert. Bei einem Fehler in Migration oder Abgleich
bricht das Deployment ab, ohne die aktiven Anwendungsdateien zu ersetzen.
Bereits erfolgreich ausgeführte Migrationen bleiben bestehen. Der Abgleich
selbst erhält bei Fehlern den vorherigen Kontaktbestand. Im Fake-Modus ist
kein lokaler Kontaktbestand erforderlich.

Die Runner-Sperre erfasst den direkten Deployment-Aufruf des Sync-Scripts
nicht. Deployment und Cron sollten deshalb zeitlich getrennt ausgeführt
werden.

Bei jedem gemergten Pull Request nach `main` erzeugt GitHub Actions automatisch ein
Release-Tag im Format `v<semver>+<build>`, zum Beispiel `v1.0.1+2`. Die
SemVer-Komponente wird aus dem Conventional-Commit-Präfix des PR-Titels
bestimmt: `feat:` erhöht Minor, ein Breaking Change erhöht Major und alle
anderen Merges erhöhen Patch. Der globale Build-Zähler startet bei `1` und
wird bei jedem Release erhöht. Der Frontend-Build ermittelt das erreichbare
Release-Tag automatisch und stellt die Version als `version.json` für den
Footer bereit. Nicht getaggte lokale Builds zeigen `0.0.0-dev` an.

Der lokale Bats-Test des Scripts benötigt keinen Server und keinen GitHub-Zugriff.
Bats Core muss lokal installiert sein:

```bash
bats tests/deployment/deploy.bats
```

## Testumgebung

Für die Integrationstests wird `backend/.env.integration` über Docker Compose
als `env_file` geladen. Diese Datei enthält ausschliesslich Testwerte und keine
Produktionszugangsdaten.

Die Integrationsdatenbank verwendet die technische Phinx-Umgebung `test` und
kann für Test-Fixtures den Seed-Pfad `db/seeds/integration/` verwenden.
Pre-Production und Production verwenden die technische Phinx-Umgebung
`production`. Ihre Basisdaten werden durch Migrationen angelegt.

## Sicherheit

- `.env`-Dateien gehören nicht ins Repository.
- `JWT_SECRET`, Datenbankpasswörter und Fairgate-Schlüssel werden nur über die
  Prozessumgebung oder eine geschützte Environment-Datei bereitgestellt.
- Der Webserver darf nur `<deployment>/frontend` und die vorgesehenen API- und
  SPA-Rewrite-Regeln erreichen.
