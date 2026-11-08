# GitHub Checks und Merge-Request-Schutz

## Zweck

Das Repository verwendet GitHub Actions, um Änderungen vor dem Merge in
`main` automatisch zu prüfen. Der Workflow ist unter
`.github/workflows/ci.yml` definiert.

Die Checks laufen bei Pull Requests nach `main` sowie bei Pushes auf `main`.
Der Workflow besitzt nur lesenden Zugriff auf den Repository-Inhalt.

## CI-Jobs

| Job | Prüfungen |
|---|---|
| `frontend-tests` | Frontend-Unit-Tests mit Vitest und Coverage |
| `frontend-build` | Production-Build des Angular-Frontends |
| `lint` | ESLint/Nx-Linting und Prettier-Formatprüfung |
| `deployment-script-test` | Deployment-Script-Tests mit Bats |
| `backend-tests` | PHPUnit-Tests |
| `backend-code-style` | PHP-CS-Fixer im Dry-Run-Modus |
| `backend-production-dependencies` | Composer-Validierung, Production-Installation und Plattformprüfung |
| `e2e-tests` | Playwright-E2E-Tests mit Chromium |
| `frontend-integration-tests` | Playwright-Integrationstests mit Docker, MariaDB und Mailpit |

### Frontend-Unit-Tests

```bash
cd frontend
npm ci
npm run test:unit -- --configuration=ci
```

### Frontend-Build

```bash
npm run build -- --configuration=production
```

### Linting und Prettier

Der Job `lint` führt aus:

```bash
npm run lint
npx prettier --check . --ignore-path .prettierignore
```

Die Formatierung wird durch `frontend/.prettierrc` und
`frontend/.prettierignore` bestimmt. Dateien können lokal formatiert werden:

```bash
cd frontend
npx prettier --write . --ignore-path .prettierignore
```

### Backend-Tests

Der Backend-Testjob verwendet PHP 8.4 und führt aus:

```bash
cd backend
composer install --no-interaction --prefer-dist
vendor/bin/phpunit
```

Die isolierten PHPUnit-Tests verwenden grundsätzlich SQLite im Speicher.

### PHP-Code-Style

```bash
cd backend
composer install --no-interaction --prefer-dist
vendor/bin/php-cs-fixer fix --dry-run --diff
```

Die Regeln sind in `backend/.php-cs-fixer.dist.php` definiert und basieren auf
PSR-12.

### Composer-Produktionsprüfung

```bash
composer validate --no-check-publish
composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader
composer check-platform-reqs --no-dev
```

Damit wird geprüft, dass die Production-Abhängigkeiten ohne
Development-Pakete installiert werden können.

### E2E-Tests

Der E2E-Job installiert Chromium und führt aus:

```bash
cd frontend
npm ci
npx playwright install --with-deps chromium
npm run test:e2e:cli
```

Die Tests verwenden `frontend/playwright.config.ts` und API-Mocks.

### Integrationstests

Der Integrationstestjob startet eine eigene Docker-Umgebung mit MariaDB,
Backend und Mailpit. Vor dem Testlauf werden Migrationen und Seeds ausgeführt:

```bash
npm run integration:setup
npm run test:integration
npm run integration:stop
```

Die Aufräumphase läuft auch nach einem fehlgeschlagenen Testlauf. Die
Integrationstest-Umgebung verwendet eine eigene Compose-Projektkennung und
bleibt dadurch vom lokalen Stack getrennt.

### Deployment-Script-Tests

```bash
bats tests/deployment/deploy.bats
```

Geprüft werden unter anderem ungültige Umgebungen, fehlende Environment-Dateien,
Production-Bestätigung, Branch-Konfiguration und Migrationsparameter.

## Branch Protection für `main`

Für `main` sollte auf GitHub eine Branch-Protection-Regel eingerichtet werden.

Empfohlene Einstellungen:

- Pull Request vor dem Merge erforderlich;
- erfolgreiche Status Checks vor dem Merge erforderlich;
- direkte Pushes auf `main` nicht erlauben;
- Force-Pushes nicht erlauben;
- Branch-Löschen nicht erlauben;
- Bypass der Regeln auch für Administratoren nicht erlauben.

Als erforderliche Status Checks werden die folgenden Jobnamen ausgewählt:

- `frontend-tests`
- `frontend-build`
- `lint`
- `deployment-script-test`
- `backend-tests`
- `backend-code-style`
- `backend-production-dependencies`
- `e2e-tests`
- `frontend-integration-tests`

Die Checks werden in GitHub oft erst zur Auswahl angeboten, nachdem der
Workflow mindestens einmal ausgeführt wurde. Deshalb muss zuerst ein Branch
mit der Workflow-Datei gepusht und ein Pull Request gegen `main` erstellt
werden.

## Lokale Prüfung vor dem Push

Frontend:

```bash
cd frontend
npm run lint
npx prettier --check . --ignore-path .prettierignore
npm run test:unit -- --configuration=ci
npm run test:e2e:cli
npm run integration:setup
npm run test:integration
npm run integration:stop
```

Backend:

```bash
cd backend
vendor/bin/phpunit -c phpunit.xml.dist
vendor/bin/php-cs-fixer fix --dry-run --diff
composer validate --no-check-publish
composer check-platform-reqs --no-dev
```

## Bekannte Hinweise

- Der Frontend-Build kann eine Bundle-Budget-Warnung ausgeben, obwohl der
  Build erfolgreich ist.
- Nx meldet derzeit eine Deprecation-Warnung für den ESLint-Executor.
- `npm audit` und `composer audit` sind derzeit nicht Bestandteil des
  Pflicht-Workflows.
- PHPStan oder Psalm sind derzeit nicht eingerichtet.
