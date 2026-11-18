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
- The frontend checks the artifact at startup, every minute while visible, on
  tab focus and navigation, and after a differing header hint. Headers are hints
  only: the published frontend artifact must confirm the difference. Failed or
  invalid checks do not interrupt work. Only `buildId`, not `appVersion`, is
  compared. The running footer version never changes from a remote response.
- The central information zone shows a persistent, non-blocking update notice.
  An automatic confirmation popup is allowed only on routes explicitly marked
  `updatePromptAllowed`, not on forms or link-login/token-confirmation routes,
  and not while another dialog is open. Users can also open it from the notice.
- Reloading requires an explicit affirmative dialog result. Escape, backdrop
  dismissal and “Später” continue without reloading. Deferral is remembered per
  running/published build pair in the tab's session storage. The notice remains
  available for a later manual decision. The dialog warns about unsaved input.
- Deployments preserve previous hashed JS/CSS bundles so deferred clients can
  still load lazy routes. These files need occasional operational cleanup;
  continued API compatibility remains a deployment responsibility.

## Technical Requirements

| Requirement | Implementation |
|-------------|----------------|
| PWA | Service Worker, manifest.json |
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
