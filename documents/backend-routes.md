# Vom Backend bereitgestellte Routen

Diese Uebersicht beschreibt alle HTTP-Routen, die das Backend in `backend/src/Application.php` registriert.

## Basis

Das Backend verwendet keinen globalen URL-Praefix. In der lokalen Docker-Umgebung ist es unter `http://localhost:8083` erreichbar.

Standardantworten werden als JSON geliefert. CORS ist global fuer alle nicht-`OPTIONS`-Antworten mit `Access-Control-Allow-Origin: *` aktiviert.

## Oeffentliche Routen

| Methode | Pfad | Action | Authentifizierung | Request Body |
| --- | --- | --- | --- | --- |
| `POST` | `/public/start` | `StartRegistrationAction` | keine | `{ email, language }` |

`POST /public/start` erstellt einen einmaligen Registrierungstoken und versendet einen Registrierungslink. Der Benutzer wird erst beim anschliessenden Token-Login angelegt.

Unterstuetzte Sprache fuer `/public/start`: `de`.

## Authentifizierung

| Methode | Pfad | Action | Authentifizierung | Request Body |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/login` | `LoginAction` | keine | `{ email, password }` |
| `POST` | `/auth/logout` | `LogoutAction` | keine Middleware | keiner oder `{}` |
| `POST` | `/auth/registration-login` | `ClientRegistrationLoginAction` | keine Middleware, Registrierungstoken erforderlich | `{ token }` |
| `POST` | `/auth/password-change-authenticated` | `AuthenticatedPasswordChangeAction` | `AuthMiddleware` | `{ password }` |

## Benutzerverwaltung

| Methode | Pfad | Action | Authentifizierung | Request Body |
| --- | --- | --- | --- | --- |
| `GET` | `/admin/users` | `ListUsersAction` | `AuthMiddleware`, Gruppe `admin` | keiner |
| `GET` | `/admin/users/{userId}` | `GetUserAction` | `AuthMiddleware`, Gruppe `admin` oder `user` | keiner |
| `POST` | `/admin/users` | `CreateUserAction` | `AuthMiddleware`, Gruppe `admin` | `{ email, group }` |
| `PATCH` | `/admin/users/{userId}` | `UpdateUserAction` | `AuthMiddleware`, Gruppe `admin` oder `user` | `{ email?, group?, required_password_reset? }` |
| `DELETE` | `/admin/users/{userId}` | `DeleteUserAction` | `AuthMiddleware`, Gruppe `admin` | keiner |

Moegliche Gruppen werden durch das Backend validiert und umfassen `admin`, `user` und `client`. Die Berechtigungen der jeweiligen Route sind in der Tabelle angegeben.

## Fairgate

| Methode | Pfad | Action | Authentifizierung | Request Body |
| --- | --- | --- | --- | --- |
| `GET` | `/admin/fairgate/test` | `FairgateTestAction` | `AuthMiddleware`, Gruppe `admin` | keiner |

Die Testadresse wird aus `frontend_config` mit dem Schluessel `fairgate_test_email` geladen. Der externe Fairgate-Zugriff verwendet `FSA_MODE` beziehungsweise den von `APP_ENV` abgeleiteten Modus `fake` oder `real`.

## Frontend-Konfiguration

| Methode | Pfad | Action | Authentifizierung | Request Body |
| --- | --- | --- | --- | --- |
| `GET` | `/admin/configuration` | `ListConfigurationAction` | `AuthMiddleware`, Gruppe `admin` oder `user` | keiner |
| `PATCH` | `/admin/configuration/{configId}` | `UpdateConfigurationAction` | `AuthMiddleware`, Gruppe `admin` oder `user` | `{ value }` |

## OPTIONS / CORS

Fuer `OPTIONS`-Requests existiert keine fachliche Route. Die globale Middleware beantwortet sie direkt mit Status `204` und folgenden erlaubten Werten:

- Methoden: `GET, POST, PATCH, PUT, DELETE, OPTIONS`
- Header: `Content-Type, Authorization`
- Origin: `*`

## Routenregistrierung

Die Registrierung erfolgt in dieser Reihenfolge:

1. `PublicRoutes`
2. `AuthRoutes`
3. `AdminRoutes`
4. `ConfigurationRoutes`

Die Route-Definitionen befinden sich unter `backend/src/Routes/`.
