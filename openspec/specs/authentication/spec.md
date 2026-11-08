# Authentication Capability Spec

## Overview

Authentication and URL-based authorization for the Gärngschee-Weihnachtswünsche
platform. This capability currently covers the Slim backend.

## Zugriffmodell

Public and protected endpoints are separated by URL:

| URL | Access |
|-----|--------|
| `/public/*` | Public access without authentication |
| `/auth/*` | Authentication endpoints |
| `/client/*` | Authenticated users in group `wunschbesteller` |
| `/fulfiller/*` | Authenticated users in group `wunscherfueller` |
| `/user/*` | Authenticated users in group `user` |
| `/admin/*` | Authenticated users in group `admin` |

An unknown or unauthorized group resource is not exposed as an available
resource. Authentication failures return `401`; a user without the required
group receives `404`.

## Benutzergruppen

There are four authenticated user groups. Each user belongs to one group:

| Gruppe | Beschreibung |
|--------|--------------|
| `wunschbesteller` | Personen, die Weihnachtswünsche anfragen oder ihre Bestellung verwalten |
| `user` | Authenticated platform users |
| `admin` | System administration and user management |
| `wunscherfueller` | Personen, die einzelne Wünsche erfüllen |

The client registration flow creates users in group `wunschbesteller`. The client
cannot choose or submit a different group. The fulfiller registration flow creates
users in group `wunscherfueller` after successful one-time-token verification and
does not use a password form.

## Backend Implementation

### User data

`UserRepository` provides:

- Lookup by ID and email without returning the password hash
- Password verification with `password_verify()`
- User creation with `password_hash()` and `PASSWORD_DEFAULT`
- Validation of the groups `wunschbesteller`, `wunscherfueller`, `user`, and `admin`

### JWT and sessions

- JWTs are created and verified with `firebase/php-jwt` installed through
  Composer.
- The JWT contains `sub` (user ID), `iat`, and `exp`.
- JWT configuration is provided through `JWT_SECRET`, `JWT_ALGORITHM`, and
  `JWT_TTL` environment variables.
- HS256 secrets must contain at least 32 bytes.
- Successful login and registration store `user_id` in the PHP session.
- Login regenerates the session ID.
- Logout clears and destroys the PHP session.
- Bearer tokens are read from the `Authorization` header.

### Routes

Implemented routes:

| Method | URL | Purpose |
|--------|-----|---------|
| `POST` | `/auth/login` | Authenticate a user and issue a JWT |
| `POST` | `/auth/registration-login` | Consume a client registration token and authenticate a client |
| `POST` | `/auth/fulfiller-registration-login` | Consume a fulfiller registration token and authenticate a fulfiller |
| `POST` | `/auth/logout` | Destroy the current session |
| `POST` | `/public/start` | Request a client registration link |
| `POST` | `/public/fulfiller-start` | Request a fulfiller registration link after required privacy opt-in |
| `GET` | `/admin/users` | List users for administrators |

### Middleware

- `AuthMiddleware` accepts either the authenticated PHP session or a valid
  Bearer JWT and attaches the user ID to the request. Unauthenticated or
  invalid requests return `404`.
- `GroupMiddleware` resolves the user through the user ID and enforces the
  allowed groups.
- `/admin/*` routes are protected by both middleware layers and allow only the
  `admin` group.
- `/user/*` routes are protected by both middleware layers and allow the
  `user` and `admin` groups. Administrators therefore have all user rights.
- `/client/*` routes allow only the `wunschbesteller` group.
- `/fulfiller/*` routes allow only the `wunscherfueller` group.

### Passwordless fulfiller registration

- `POST /public/fulfiller-start` accepts an email address, language and mandatory
  privacy opt-in.
- The opt-in timestamp is stored with the registration token as
  `privacy_accepted_at`.
- A separate token purpose `fulfiller` is used. Tokens are stored hashed, expire
  after ten minutes and can only be consumed once.
- `POST /auth/fulfiller-registration-login` consumes only `fulfiller` tokens.
- Existing `admin`, `user` and `wunschbesteller` accounts are not converted into
  fulfillers. A new fulfiller account is created only when no account exists for
  the verified email address.

## Security Considerations

- Passwords are never returned by the repository or API responses.
- Passwords use PHP's `password_hash()` and `password_verify()`.
- JWT secrets are supplied through environment variables and must not be
  committed.
- JWTs are sent through the `Authorization: Bearer` header.
- CORS preflight allows the `Authorization` header.
- CSRF protection and rate limiting are not implemented yet.
- JWT revocation is currently session-based; issued JWTs remain valid until
  expiry unless additional revocation is introduced.

## Implementation Status

| Component | Status |
|-----------|--------|
| Public route structure | Implemented |
| User repository and password handling | Implemented |
| JWT service | Implemented |
| PHP session service | Implemented |
| Login and registration routes | Implemented |
| Logout and current-user routes | Implemented |
| Authentication middleware | Implemented |
| Group middleware | Implemented |
| Admin user route | Implemented |
| Client routes | Implemented |
| User profile routes | Implemented |
| CSRF protection | Not implemented |
| Rate limiting | Not implemented |

## Frontend Integration

Frontend JWT storage and API integration are not part of the current Slim
backend implementation. The planned client integration uses Local Storage for
the JWT and sends it as a Bearer token.

## Open Decisions

- Fairgate integration for eligibility
- Whether JWT revocation needs to be supported before token expiry
- Implementation of client and user route groups
