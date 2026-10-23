# Docker-Umgebung

## Container

| Container | Image | Status | Ports |
|-----------|-------|--------|-------|
| `gaerngschee-weihnachtswuensche-backend` | Custom (php:8.3-fpm-alpine) | Up | `8083→80` |
| `gaerngschee-database` (shared with maesspaeggli) | mariadb:10.11 | Up | `3306→3306` |

---

## Backend-Container (`gaerngschee-weihnachtswuensche-backend`)

**Image:** Custom Build aus `Dockerfile`

**Stack:**
- PHP 8.3 (FPM)
- Nginx (Webserver)
- Supervisor (Prozess-Manager)

**Konfiguration:**

| Datei | Zweck |
|-------|-------|
| `docker/nginx.conf` | Nginx Routing → PHP-FPM auf Port 9000 |
| `docker/supervisord.conf` | Startet PHP-FPM + Nginx |
| `docker/php.ini` | PHP-Config (Display Errors etc.) |

**Volumes:**
- `./backend:/var/www/html` (Code + Vendor)
- `./db:/var/www/db` (Migrations + Seeds)

**Environment:**
```
DB_HOST=host.docker.internal
DB_PORT=3306
DB_NAME=gaerngschee_weihnachtswuensche
DB_USER=gaerngschee_weihnachtswuensche
DB_PASS=weihnachtswuensche-local-password
PHP_DISPLAY_ERRORS=1
```

---

## Gemeinsamer Database-Container (`gaerngschee-database`)

**Image:** `mariadb:10.11`

Der MariaDB-Container wird vom `maesspaeggli`-Projekt betrieben. Das
Weihnachtswünsche-Backend verwendet darin die eigene Datenbank
`gaerngschee_weihnachtswuensche` und den eigenen Benutzer
`gaerngschee_weihnachtswuensche`.

**Volumes:**
- Die Datenbankdaten und das Volume werden vom `maesspaeggli`-Stack verwaltet.

---

## Start/Stop Commands

```bash
# Alle Container starten
docker compose up -d

# Alle Container stoppen
docker compose down

# Einzelne Container
docker restart gaerngschee-weihnachtswuensche-backend
docker restart gaerngschee-database

# Logs anzeigen (live mit -f)
docker logs gaerngschee-weihnachtswuensche-backend --tail=100 -f
docker logs gaerngschee-database --tail=100 -f

# In Container rein shells
docker exec -it gaerngschee-weihnachtswuensche-backend sh
docker exec -it gaerngschee-database mysql -u root -prootpassword
```

---

## Datenbank Commands

```bash
# Migrationen ausführen
npm run db:migrate

# Integrationstests vorbereiten (Migration + Integration-Seeds)
npm run integration:setup

# Setup (start + migrate)
npm run db:setup

# Reset (stop + start + migrate)
npm run db:reset

# Migration Status prüfen
docker exec gaerngschee-weihnachtswuensche-backend vendor/bin/phinx status -c /var/www/db/phinx.php
```

---

## Phinx Migration

**Config:** `db/phinx.php`

**Migrations:** `db/migrations/`

**Seeds:** `db/seeds/`

| Environment | Seed Path |
|-------------|-----------|
| integration | `db/seeds/integration/` |

---

## Wichtige Hinweise

### Service-Namen vs Container-Namen

| Service-Name (docker compose) | Container-Name (docker) |
|-------------------------------|-------------------------|
| `backend` | `gaerngschee-weihnachtswuensche-backend` |
| externe MariaDB | `gaerngschee-database` |

**Wichtig:** `docker compose exec` nutzt den Service-Namen `backend`. Die MariaDB
läuft in diesem lokalen Stack extern im bestehenden `maesspaeggli`-Stack.

```bash
# Richtig (Service-Name)
docker compose exec backend ...

# Falsch (Container-Name - funktioniert nicht!)
docker compose exec gaerngschee-weihnachtswuensche-backend ...
```

### Volume-Mapping

Das Volume `./backend:/var/www/html` spiegelt den Container-`vendor/` auf den Host. Änderungen an `composer.json` müssen daher im Container ausgeführt werden:

```bash
docker exec gaerngschee-weihnachtswuensche-backend composer update --working-dir=/var/www/html
```

### Troubleshooting

| Problem | Lösung |
|---------|--------|
| CORS-Fehler im Browser | Backend-Exception prüfen: `docker logs gaerngschee-weihnachtswuensche-backend` |
| Access denied für DB-User | User + Rechte erstellen (siehe `docker exec gaerngschee-database mysql -u root -prootpassword -e "GRANT ALL..."`) |
| Tabelle existiert nicht | `npm run db:migrate` ausführen |
| Phinx nicht gefunden | `docker exec gaerngschee-weihnachtswuensche-backend composer update --working-dir=/var/www/html` |
