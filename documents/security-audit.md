# Sicherheits-Audit

Stand: 12. September 2026

## Umfang

Der Audit umfasst eine statische Prüfung des Frontend- und Backend-Codes,
der Konfigurationen und der verwendeten Abhängigkeiten. Es wurde kein
vollständiger Penetrationstest durchgeführt.

Der Audit beschreibt den Stand zum Zeitpunkt der Prüfung; die danach
umgesetzten Härtungsmassnahmen sind im Arbeitsverlauf dokumentiert.

## Ergebnis

`npm audit` und `composer audit` melden aktuell jeweils keine bekannten
Dependency-Schwachstellen. Im Anwendungscode bestehen dennoch mehrere
Sicherheits- und Härtungsrisiken.

## Befunde nach Risiko

| Risiko | Problem | Lösung | Restrisiko |
| --- | --- | --- | --- |
| **Niedrig-Mittel** | Die lokale/isolierte Konfiguration `backend/.env.integration` enthält Test-Zugangsdaten und ein Test-JWT-Secret. Sie wird nur lokal und in GitHub Checks verwendet, darf aber nicht für produktive Systeme eingesetzt werden. | Produktive Secrets getrennt verwalten, Testwerte regelmässig rotieren und Repository-/CI-Zugriff begrenzen. | Bereits geklonte Repositorys und Backups können Testwerte weiterhin enthalten; eine Fehlkonfiguration könnte sie in einer falschen Umgebung aktivieren. |
| **Erledigt, Restrisiko** | Der JWT wird nicht mehr in `localStorage` gespeichert. Dort liegt nur noch nicht-authentifizierender Sitzungsstatus (`frontend/src/app/shared/services/auth-storage.ts`). | JWT bleibt im flüchtigen Speicher; zusätzlich bleiben kurze Ablaufzeiten und serverseitige Widerrufbarkeit zu prüfen. | Ein XSS kann weiterhin Aktionen im laufenden Browser auslösen. |
| **Erledigt, Restrisiko** | CSRF-Schutz, Origin-Prüfung und feste CORS-Allowlist sind umgesetzt (`backend/src/Middleware/CsrfMiddleware.php`, `backend/src/Application.php`). | Schutz für alle mutierenden Routen und Deployment-Origin regelmässig prüfen. | Ein kompromittierter Origin kann weiterhin legitime Browseraktionen auslösen. |
| **Erledigt, Restrisiko** | Rate Limiting ist für Login-, Passwort-, Registrierungs- und Mail-Flows umgesetzt. | Zentrale Limits und Monitoring für verteilte Angriffe ergänzen. | Verteilte Angriffe benötigen zusätzlich Bot-Schutz. |
| **Erledigt, Restrisiko** | Session-Cookies werden vor `session_start()` mit `Secure`, `HttpOnly` und `SameSite` konfiguriert (`backend/src/Auth/Services/SessionService.php`). | HTTPS und HSTS im produktiven Reverse Proxy prüfen. | Effektive Defaults hängen weiterhin von der Deployment-Umgebung ab. |
| **Hoch** | JWTs enthalten keine Bindung an Issuer, Audience oder Benutzerstatus. Serverseitiger Widerruf fehlt (`backend/src/Auth/Services/JwtService.php:61-78`). | Algorithmus strikt allowlisten, `iss`/`aud` validieren, Token-Version oder Revocation-Liste nutzen und Tokens bei Passwort- oder Rollenänderung widerrufen. | Gestohlene Tokens bleiben bis zum Ablauf gültig. |
| **Erledigt, Restrisiko** | Registration-, Reset- und Delivery-Tokens werden nach dem Einlesen per `replaceUrl` aus der Browser-URL entfernt. | Referrer-Policy und möglichst Fragment- oder Bootstrap-Tokens ergänzen. | Leaks vor der URL-Bereinigung sind nicht vollständig verhinderbar. |
| **Erledigt, Restrisiko** | Request-Grössen und fachliche Werte sind server- und clientseitig begrenzt. | Limits durch Webserver-Konfiguration und Integrationstests zusätzlich absichern. | Limits müssen mit legitimen Bestelldaten abgestimmt werden. |
| **Erledigt, Restrisiko** | Dynamisches `[innerHTML]` wurde entfernt; Linktext und `href` werden separat gebunden. | Externe HTTPS-Ziele weiterhin fachlich begrenzen. | Erlaubte externe HTTPS-Ziele bleiben ein Vertrauensrisiko. |
| **Behoben** | Security Headers und eine verbindliche CSP sind in `docker/nginx.conf` und `frontend/public/.htaccess` gesetzt. | Konfiguration am tatsächlich öffentlichen Reverse Proxy prüfen und CSP bei Änderungen an externen Ressourcen aktualisieren. | Der lokale Container konnte hier nicht mit einem installierten Nginx-Konfigurationsparser geprüft werden. |
| **Erledigt** | Der Auth-Interceptor sendet keine Bearer-Tokens mehr und beschränkt sich auf den CSRF-Header (`frontend/src/app/shared/interceptors/auth-token.interceptor.ts`). | API-Origin und CORS-Allowlist im Deployment prüfen. | Keine zusätzlichen Token-Header im Frontend-Interceptor. |
| **Mittel** | Der Password-Reset-/Registration-Flow kann nach einem externen Fairgate-Fehler inkonsistent sein: Tokens werden vor Abschluss des Flows verbraucht. | Idempotenten Zustandsautomaten mit sauberem Retry-/Rollback-Verhalten implementieren. | Externe Fairgate-Ausfälle bleiben möglich. |
| **Mittel** | Schwache Passwörter werden akzeptiert; das Backend prüft primär auf einen vorhandenen String. | Zentrale Mindestlänge, beispielsweise 12 Zeichen, und Prüfung kompromittierter Passwörter. MFA für Admins ergänzen. | Schützt nicht gegen Phishing oder Credential Stuffing. |
| **Niedrig-Mittel** | NgRx Store DevTools sind offenbar global aktiv (`frontend/src/app/app.config.ts:32`). Der Store enthält Tokens und personenbezogene Daten. | DevTools nur in Development aktivieren. | Benutzer mit Browser- oder Debug-Zugriff können Laufzeitdaten weiterhin sehen. |
| **Niedrig-Mittel** | Development- und Integration-Builds verwenden Source Maps und deaktivierte Optimierung. | Ausschliesslich Produktionsartefakte deployen und `.map`-Dateien im Deployment blockieren. | Öffentlicher JavaScript-Code bleibt grundsätzlich analysierbar. |

## Dependency-Check

### Frontend

- Angular, Material und Router: `22.1.5`
- Angular CLI und Build: `22.1.7`
- Nx: `23.2.0`
- NgRx: `22.0.0`
- Playwright: `1.61.1`
- RxJS: `7.8.2`
- `smol-toml`: per Override auf `1.8.0`

### Backend

- Slim: `4.15.3`
- Slim PSR-7: `1.8.0`
- `firebase/php-jwt`: `7.1.0`
- Guzzle: `7.15.5`
- Symfony: `7.4.17`
- Twig: `3.28.0`
- PHP dotenv: `5.7.0`

### Bekannte Advisories

- Slim `CVE-2026-48157` betrifft `4.4.0` bis `4.15.1` und ist ab `4.15.2` behoben. Installiert ist `4.15.3`, daher ist diese Anwendung versionsseitig nicht betroffen. [GitHub Advisory](https://github.com/advisories/GHSA-53h4-8rc4-f539)
- Der Nx-Supply-Chain-Vorfall `CVE-2025-10894` betraf unter anderem die Versionen `20.9.0` bis `21.8.0`. Installiert ist `23.2.0`, daher besteht keine Übereinstimmung mit den betroffenen Versionen. Eine historische Kompromittierung kann durch die aktuelle Version allein nicht ausgeschlossen werden. [GitHub Advisory](https://github.com/advisories/GHSA-cxm3-wv7p-598c)
- Angular veröffentlichte 2026 mehrere XSS-Advisories. Die bekannten Fix-Schwellen liegen unterhalb der installierten Angular-Version `22.1.5`; `npm audit` meldet keine betroffene Dependency. Trotzdem sollte regelmässig auf den neuesten verfügbaren `22.1.x`-Patchstand aktualisiert werden. [Angular Security](https://angular.dev/best-practices/security)
- `firebase/php-jwt` ist mit `7.1.0` neuer als die von `CVE-2021-46743` betroffenen Versionen unter `6.0.0`.

## Nicht bestätigte Risiken

Im geprüften Code wurden keine eindeutigen Hinweise auf folgende Probleme
gefunden:

- SQL Injection: PDO-Prepared-Statements werden verwendet.
- Command Injection: Es wurden keine relevanten Shell-Aufrufe gefunden.
- Klassische IDOR-Lücke: Objekt- und Gruppenprüfungen sind im Backend vorhanden.
- Unsichere Angular-APIs wie `bypassSecurityTrust...`, `eval` oder direkte DOM-Injection.

## Positive Beobachtungen

- Registration- und Reset-Tokens werden mit kryptografisch sicheren Zufallswerten erzeugt und gehasht gespeichert.
- Tokens sind zeitlich begrenzt und als Einmal-Tokens ausgelegt.
- Backend-Routen verwenden zusätzlich zu Frontend-Guards Authentifizierungs- und Gruppenprüfungen.
- Normale Angular-Interpolation wird überwiegend verwendet.
- Links zu externen Informationsseiten werden auf `https:` begrenzt und verwenden bei neuen Tabs `noopener noreferrer`.

## Empfohlene Reihenfolge

1. Alle Secrets rotieren und Git-Historie sowie CI-Logs prüfen.
2. JWT-Claims, Widerruf und Passwortregeln ergänzen.
3. Security Headers, CSP, HTTPS und HSTS produktiv verifizieren.
4. Eingabelimits mit Webserver- und Integrationstests absichern.
5. Referrer-Policy und externe Ziel-Allowlist ergänzen.

## Einschränkungen

Besonders Cookie-Attribute, PHP-Version, Reverse-Proxy-Konfiguration,
Git-Historie und produktive Secret-Werte müssen zusätzlich in der realen
Deployment-Umgebung geprüft werden. Der Audit ersetzt keinen unabhängigen
Penetrationstest.
