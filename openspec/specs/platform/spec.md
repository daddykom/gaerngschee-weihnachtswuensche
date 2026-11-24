# Platform Capability Spec

## Overview

Cross-cutting platform concerns: PWA, i18n, accessibility, responsive design.

## Features

### F1: Progressive Web App (PWA)

- Installable on desktop and mobile devices
- Offline capability (read cached data)
- Background sync when connection restored
- Push notifications (optional)

### F2: Responsive Design

- Mobile-first approach
- Breakpoints:
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px
- Touch-friendly controls

### F3: Internationalization (i18n)

**Languages:**
- German (primary)
- Additional languages TBD

**Translatable content:**
- UI labels and buttons
- Error messages
- Email templates

### F4: Accessibility (a11y)

- WCAG 2.1 AA compliance target
- Keyboard navigation
- Screen reader support
- Color contrast compliance
- Focus indicators
- Skip links
- ARIA labels

### F5: Privacy & Data Protection

- No tracking cookies
- Minimal data collection
- Clear privacy policy
- GDPR-compliant (EU users)
- Data export capability (for users)

### F6: Database Migrations

All database schema changes via Phinx migrations.

- All migrations stored in `db/migrations/`
- Migrations are reversible via `phinx rollback`
- Environment-based database credentials
- No direct SQL modifications in production

### F7: Release identity and voluntary application updates

- `appVersion` identifies the installed release and is embedded in the frontend
  bundle. It comes from the nearest reachable repository release tag, or an
  explicit `APP_VERSION` for source archives. Missing release information fails
  the build instead of silently displaying `0.0.0-dev`.
- Every build generates a fresh opaque UUID `buildId`, even when rebuilding the
  same commit. Nx prepares identical metadata for the compiled baseline and
  `build-info.json` before build, serve, lint and unit tests. Production builds
  are not restored from the Nx cache. CI fetches tags and history.
- `build-info.json` and `index.html` are not cached; hashed JS/CSS assets are
  immutable. API responses expose the deployed frontend's ID as `X-App-Build`,
  alongside the unchanged numeric `X-Event-*` headers. Missing build metadata
  never prevents API requests.
- A dedicated frontend interceptor compares `X-App-Build` on existing API
  responses, including error responses, with the compiled `buildId`. The backend
  reads this ID from the published frontend's `build-info.json`, so no additional
  verification request is needed. There is no update polling or metadata request
  on startup, tab focus or navigation. Missing, invalid or unchanged headers do
  not trigger updates. Only `buildId`, not `appVersion`, is compared. The running
  footer version never changes from a remote response.
- The central information zone shows a persistent, non-blocking update notice.
  Functional NgRx effects handle dialog decisions, session-storage persistence
  and the confirmed reload. The application shell reads selectors and dispatches
  the reload-click event; it does not start or orchestrate an update service.
  An automatic confirmation popup is offered globally on all routes, including
  forms and link-login/token-confirmation routes, but not while another dialog
  is open. Users can also open it from the notice.
- Reloading requires an explicit affirmative dialog result. Escape, backdrop
  dismissal and “Später” continue without reloading. Deferral is remembered per
  running/published build pair in the tab's session storage. The notice remains
  available for a later manual decision. The dialog warns about unsaved input.
- Deployments preserve previous hashed JS/CSS bundles so deferred clients can
  still load lazy routes. These files need occasional operational cleanup;
  continued API compatibility remains a deployment responsibility.

### F8: Retire previously installed Angular service workers

- The application does not register new service workers. The old URL
  `/ngsw-worker.js` permanently serves Angular's safety worker as JavaScript with
  non-cacheable response headers, not the SPA document.
- When an existing registration updates, the safety worker activates, unregisters
  itself and deletes only caches prefixed with `ngsw:`. Other caches and unsaved
  work remain untouched; no automatic page reload is forced.
- `/ngsw.json`, including requests with query parameters, returns HTTP 404 even
  when a stale manifest file exists. The SPA fallback must not turn it into HTML
  with status 200. This enables the old worker's manifest fail-safe as well.

## Technical Requirements

| Requirement | Implementation |
|-------------|----------------|
| PWA | Web manifest; Angular service worker retired via safety worker |
| i18n | @angular/localize |
| a11y | Angular CDK a11y, semantic HTML |
| Privacy | No third-party analytics, minimal cookies |

## Infrastructure

| Component | Technology |
|-----------|------------|
| Hosting | Cyon.ch (Webhosting Double) |
| Database | MariaDB |
| CI/CD | GitHub Actions |
| Domain | TBD |

## Quality Assurance

### Testing Strategy

| Test Type | Scope |
|-----------|-------|
| Unit Tests | Components, Services, NgRx, Pure Functions |
| Integration Tests | API endpoints, data flow |
| E2E Tests | Playwright |
| Accessibility Tests | axe-core integration |

### CI/CD Pipeline

```
Push → Lint → Build → Test → Deploy to staging → (approval) → Deploy to production
```

## Implementation Status

| Component | Status |
|-----------|--------|
| PWA setup | ✗ Not implemented |
| i18n | ✗ Not implemented |
| Accessibility | ✗ Not implemented |
| Privacy features | ✗ Not implemented |
| GitHub Actions CI | ✗ Not implemented |

## Open Decisions

- Which additional languages?
- Notification strategy (push, email)?
- Backup strategy for MariaDB?
- Monitoring/alerting solution?
