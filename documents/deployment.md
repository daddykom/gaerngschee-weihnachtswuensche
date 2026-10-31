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
```

Die Datenbank wird vor dem Aktivieren des neuen Frontend-Builds migriert. Die
Migrationen legen auch die für den Betrieb notwendigen Basisdaten an. Seeds
werden beim Deployment nicht ausgeführt. Danach wird der Inhalt des
Angular-Builds nach `<deployment>/frontend` veröffentlicht.

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
