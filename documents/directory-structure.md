# Directory Structure

## Project Root

```
gaerngschee-weihnachtswuensche/
├── frontend/                  # Angular SPA
├── backend/                   # PHP Slim API
├── db/                        # Database migrations & seeds
├── documents/                 # Human-readable documentation
├── openspec/                  # OpenSpec capability specs
├── docker-compose.yml         # Docker configuration
└── README.md                  # Project documentation
```

## Frontend

```
frontend/
├── src/
│   ├── app/
│   │   ├── app.ts                    # Root component
│   │   ├── app.config.ts             # App configuration
│   │   ├── app.routes.ts             # Routing configuration
│   │   ├── store/                   # NgRx store
│   │   │   ├── app.state.ts
│   │   │   └── ...                   # Feature-specific NgRx state
│   │   ├── features/
│   │   │   ├── registrations/        # Registration feature
│   │   │   ├── donations/           # Donation feature
│   │   │   ├── waitlist/            # Waitlist feature
│   │   │   ├── pickup/              # Pickup feature
│   │   │   └── ...
│   │   └── shared/                  # Shared components, pipes, utils
│   ├── environments/
│   └── assets/
├── project.json               # Nx configuration
├── package.json
└── nx.json
```

## Backend

```
backend/
├── public/
│   └── index.php              # Entry point
├── src/
│   ├── Application.php        # App factory
│   ├── Auth/                  # Auth actions, services and data
│   ├── Configuration/         # Configuration actions and data
│   ├── Fairgate/              # Fairgate actions and services
│   ├── Registration/          # Registration actions and services
│   ├── Users/                 # User actions and data
│   ├── Shared/                # Shared infrastructure
│   ├── Middleware/            # PSR-15 middleware
│   ├── PublicApi/             # Public API actions
│   └── Routes/                # Thin API route registration
│   └── ...
├── vendor/                    # Composer dependencies
├── composer.json
└── composer.lock
```

Backend-Tests liegen unter `backend/tests/` in derselben fachlichen Struktur.
Gemeinsame Test-Infrastruktur liegt unter `backend/tests/Support/`; der
Bootstrap wird in `backend/tests/bootstrap.php` geladen.

## Database

```
db/
├── phinx.php                  # Phinx configuration
├── migrations/               # Database migrations
│   ├── 20260614080000_create_registrations_table.php
│   ├── 20260614081000_create_children_table.php
│   └── ...
└── seeds/
    └── integration/          # Integration test fixtures
```

## Documentation

```
documents/
├── project.md                # Project overview
├── architecture.md           # System architecture
├── frontend-conventions.md   # Angular conventions
├── backend-conventions.md    # PHP conventions
└── database-conventions.md   # Database conventions
```

## OpenSpec

```
openspec/
├── SPEC.md                   # OpenSpec index
└── specs/                    # Capability specifications
    ├── weihnachtswuensche.md       # Fachkonzept
    ├── weihnachtswuensche/         # Main capability spec
    ├── donations/
    ├── registrations/
    ├── eligibility/
    ├── waitlist/
    ├── qualification/
    ├── pickup/
    ├── notifications/
    ├── email-templates/
    ├── authentication/
    ├── platform/
    └── agents-md-workflow/
```
