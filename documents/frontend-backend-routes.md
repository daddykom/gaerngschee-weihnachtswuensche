# Backend-Routen des Frontends

Diese Uebersicht dokumentiert alle Backend-Aufrufe, die aktuell im Angular-Frontend verwendet werden.

## Basis-URLs

| Zweck | URL | Quelle |
| --- | --- | --- |
| Frontend Development Server | `http://localhost:4200` | `frontend/playwright.config.ts` |
| Backend API | `http://localhost:8083` | Angular-Services und `docker-compose.yml` |

Die Backend-URLs sind aktuell direkt in den Angular-Services hinterlegt. Es gibt derzeit keine zentrale API-URL-Konfiguration und keine Environment-Dateien fuer unterschiedliche Umgebungen.

## Authentifizierung

| Methode | URL | Frontend-Datei | Request Body | Authentifizierung |
| --- | --- | --- | --- | --- |
| `POST` | `http://localhost:8083/auth/login` | `frontend/src/app/shared/services/auth.service.ts` | `{ email, password }` | oeffentlich |
| `POST` | `http://localhost:8083/auth/registration-login` | `frontend/src/app/shared/services/auth.service.ts` | `{ token }` | oeffentlich, einmaliger Registrierungstoken |
| `POST` | `http://localhost:8083/auth/logout` | `frontend/src/app/shared/services/auth.service.ts` | `{}` | Session/JWT-Kontext |
| `POST` | `http://localhost:8083/auth/password-change-authenticated` | `frontend/src/app/shared/services/auth.service.ts` | `{ password }` | erforderlich |

## Oeffentliche Registrierung

| Methode | URL | Frontend-Datei | Request Body | Authentifizierung |
| --- | --- | --- | --- | --- |
| `POST` | `http://localhost:8083/public/start` | `frontend/src/app/shared/services/anmeldung.service.ts` | `{ email, language }` | oeffentlich |

Die Backend-Route erzeugt einen einmaligen Registrierungstoken und versendet den Registrierungslink. Dabei wird noch kein Benutzer angelegt.

## Benutzerverwaltung

| Methode | URL | Frontend-Datei | Request Body | Authentifizierung |
| --- | --- | --- | --- | --- |
| `GET` | `http://localhost:8083/admin/users` | `frontend/src/app/shared/services/admin-users.service.ts` | keiner | Admin |
| `GET` | `http://localhost:8083/admin/users/{userId}` | `frontend/src/app/shared/services/admin-users.service.ts` | keiner | Admin oder User gemaess Backend-Regeln |
| `POST` | `http://localhost:8083/admin/users` | `frontend/src/app/shared/services/admin-users.service.ts` | `{ email, group }` | Admin |
| `PATCH` | `http://localhost:8083/admin/users/{userId}` | `frontend/src/app/shared/services/admin-users.service.ts` | `{ email?, group?, required_password_reset? }` | Admin oder User gemaess Backend-Regeln |
| `DELETE` | `http://localhost:8083/admin/users/{userId}` | `frontend/src/app/shared/services/admin-users.service.ts` | keiner | Admin |

## Frontend-Konfiguration

| Methode | URL | Frontend-Datei | Request Body | Authentifizierung |
| --- | --- | --- | --- | --- |
| `GET` | `http://localhost:8083/admin/configuration` | `frontend/src/app/shared/services/frontend-config.service.ts` | keiner | Admin oder User |
| `PATCH` | `http://localhost:8083/admin/configuration/{configId}` | `frontend/src/app/shared/services/frontend-config.service.ts` | `{ value }` | Admin oder User |

## Fairgate-Test

| Methode | URL | Frontend-Datei | Request Body | Authentifizierung |
| --- | --- | --- | --- | --- |
| `GET` | `http://localhost:8083/admin/fairgate/test` | `frontend/src/app/shared/services/fairgate-test.service.ts` | keiner | Admin |

Die Testadresse wird im Backend aus dem Konfigurationswert `fairgate_test_email` gelesen. Der Fairgate-Zugriff verwendet `FSA_MODE` beziehungsweise den von `APP_ENV` abgeleiteten Modus `fake` oder `real`.

## Abdeckung

Alle aktuell dokumentierten fachlichen Backend-Routen werden durch das Frontend verwendet.

## Technische Hinweise

- Alle aktuell verwendeten API-Aufrufe zeigen auf `http://localhost:8083`.
- Fuer eine produktive Bereitstellung muss die API-Basis-URL konfigurierbar gemacht werden.
- Die Playwright-E2E-Tests mocken die API teilweise ebenfalls mit `http://localhost:8083`.
- Der Auth-Interceptor fuegt den gespeicherten Token automatisch zu geschuetzten Requests hinzu.
