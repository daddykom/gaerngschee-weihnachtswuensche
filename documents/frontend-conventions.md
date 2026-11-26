# Frontend Conventions

## View/Container Pattern

### Principle

Separate pure presentation (View) from stateful logic (Container).

### ViewComponent

- **Pure** - no side effects
- Receives data via **signal inputs** (`input()`)
- Emits events via **signal outputs** (`output()`)
- No service injections
- No direct store access
- Uses Angular 21 control flow (`@if`, `@for`, `@switch`, `@defer`)

```typescript
@Component({
  selector: 'app-registration-list-view',
  standalone: true,
  templateUrl: './registration-list-view.component.html',
})
export class RegistrationListViewComponent {
  registrations = input<Registration[]>([]);
  loading = input<boolean>(false);
  itemClick = output<Registration>();
}
```

**Template (`registration-list-view.component.html`):**
```html
@if (loading()) {
  <mat-spinner></mat-spinner>
} @else {
  @for (registration of registrations(); track registration.id) {
    <app-registration-card [registration]="registration" (cardClick)="itemClick.emit($event)" />
  }
}
```

### ContainerComponent

- **Impure** - manages state
- Injects NgRx Store and services
- Selects state via **selectSignal()** (signals-based)
- Dispatches actions
- Passes data to View via **signal inputs** (`input()`)

```typescript
@Component({
  selector: 'app-registration-list-container',
  standalone: true,
  template: `<app-registration-list-view [registrations]="registrations()" (itemClick)="onItemClick($event)" />`
})
export class RegistrationListContainerComponent {
  private store = inject(Store);

  registrations = this.store.selectSignal(selectRegistrations);
  loading = this.store.selectSignal(selectRegistrationsLoading);

  onItemClick(registration: Registration) {
    this.store.dispatch(RegistrationActions.selectRegistration({ registration }));
  }
}
```

### Signal Inputs (Required)

ViewComponents **must** use Angular's signal-based inputs instead of `@Input()`:

```typescript
// GOOD - Signal inputs
registrations = input<Registration[]>([]);
loading = input<boolean>(false);
itemClick = output<Registration>();

// BAD - @Input() decorator
@Input() registrations: Registration[] = [];
@Input() loading = false;
@Output() itemClick = new EventEmitter<Registration>();
```

**Rule:** Signals are preferred in components. For store access, use `selectSignal()` instead of `store.select()`. Effects must use RxJS Observables (this is intentional and correct).

## File Patterns

| Pattern | Description |
|---------|-------------|
| `*.component.ts` | Angular components |
| `*.component.html` | Component templates (always use separate file, never inline) |
| `*.component.scss` | Component styles |
| `*.service.ts` | Angular services |
| `*.actions.ts` | NgRx actions |
| `*.feature.ts` | NgRx feature (reducer + selectors) |
| `*.effects.ts` | NgRx effects (functional pattern) |
| `*.model.ts` | TypeScript interfaces |
| `*.util.ts` | Pure utility functions |
| `*.pipe.ts` | Angular pipes |

## NgRx Store Organization

```
store/
├── app.state.ts              # Root state interface
├── registrations/
│   ├── registrations.actions.ts
│   ├── registrations.feature.ts
│   ├── registrations.effects.ts
│   └── registrations.state.ts
├── donations/
│   └── ...
└── ...
```

## Functional Effects Pattern

Feature-Routen werden über `loadChildren` aus fachlich zugehörigen
`*.routes.ts`-Dateien nachgeladen. Ihre Store-Provider, Effects und Resolver
werden ausschliesslich dort importiert, nicht statisch in `app.routes.ts`.
`loadComponent` allein verschiebt diese Abhängigkeiten nicht aus dem initialen
Bundle. Gemeinsam benötigte Resolver und Provider bleiben auf der gemeinsamen
Parent-Route, damit Child-Navigationen keinen erneuten Datenabruf auslösen.

Die NgRx-Devtools-Provider werden über die Environment-Dateien bereitgestellt.
Das Production-Environment exportiert eine leere Provider-Liste und importiert
die Devtools nicht. Eine reine Laufzeitbedingung verhindert zwar ihre
Aktivierung, entfernt den statischen Import aber nicht zuverlässig aus dem Bundle.

```typescript
export const loadRegistrationsEffect = createEffect(
    (actions$ = inject(Actions), store = inject(Store), registrationService = inject(RegistrationService)) => {
        return actions$.pipe(
            ofType(RegistrationsActions.loadRegistrations),
            switchMap(() =>
                registrationService.getRegistrations().pipe(
                    map((registrations) => RegistrationsActions.loadRegistrationsSuccess({ registrations })),
                    catchError((error) => of(RegistrationsActions.loadRegistrationsFailure({ error: error.message })))
                )
            )
        );
    },
    { functional: true }
);

export const registrationsEffects = [loadRegistrationsEffect];
```

Registration in `app.config.ts`:
```typescript
provideEffects(registrationsEffects)
```

## Reactive Patterns

### Background wish-image transfers

Image edits belong to the existing admin order form:
`AdminOrderFormValue.items[].imageChange` is either a replacement with a `File`
and the current image revision, or a removal with that revision. It is changed
through the same partial form-update action as the other fields. There is no
separate image draft outside the form.

The order editor snapshots image changes with the save event.
`AdminOrdersService` continues to send only wish data in its JSON PATCH;
image files are never serialized into that request. Only after the backend
confirms the wish-data save does its effect queue image transfers for wishes
present in the saved response. A failed save leaves the form intact and starts
no image requests. Navigation after saving does not wait for the images.

`imageTransfersFeature` and `imageTransfersEffects` are deliberately registered
at application level in `app.config.ts`, unlike route-bound admin editing
features. The queue must survive both editor destruction and navigation outside
the admin routes. It contains committed transfer jobs, not another form draft.

`OrderItemImagesService` uses multipart POST with `image` and `revision` and
the existing XHR backend for upload progress. Binary preview retrieval and
metadata retrieval use separate requests. Removals use DELETE with the revision.
All requests use the existing credentials and CSRF interceptors.

Transfers run sequentially and use discriminated states: `queued`, `uploading`,
`success` and `error`. Percentages are bounded and monotonic; missing upload totals
do not create estimated progress. Even 100 percent remains `uploading` until the
backend confirms persistence. Success releases the file; failure retains it for
an explicit image-only retry. A revision conflict is not automatically retried
or rebased onto another administrator's change.

When a queued change to the same wish was based on this application's preceding
write, its expected revision advances after that write succeeds. Logout, account
changes and session expiry cancel requests and clear the queue. An outstanding
wish-data save is also cancelled so it cannot queue a late upload for a previous
session.

Files stay in memory in the form/transfer state and are not persisted to browser
storage or encoded as Base64. Reloading or closing the tab cannot resume them.
The upload controls, global progress display and unload warning are added in
the subsequent UI steps.

### RxJS Usage

- Prefer Observables for async operations
- Use operators: map, filter, switchMap, catchError, withLatestFrom
- Avoid subscriptions where possible; use effects instead
- Complete observables properly to prevent memory leaks

### Functional Style

```typescript
// GOOD - Functional style with array methods
export const getActiveRegistrations = (registrations: Registration[]): Registration[] =>
    registrations.filter(r => r.status === 'active');

export const groupByStatus = (registrations: Registration[]): Record<string, Registration[]> =>
    registrations.reduce((acc, reg) => {
        const key = reg.status;
        return { ...acc, [key]: [...(acc[key] || []), reg] };
    }, {} as Record<string, Registration[]>);

// GOOD - Composing functions
export const getQualifiedCount = (registrations: Registration[]): number =>
    registrations
        .filter(r => r.status === 'qualified')
        .length;

// BAD - Imperative style
let count = 0;
for (const reg of registrations) {
    if (reg.status === 'qualified') count++;
}
```

### Effect Patterns

Effects handle side effects reactively:

```typescript
export const loadRegistrationsEffect = createEffect(
    (actions$ = inject(Actions), registrationService = inject(RegistrationService)) => {
        return actions$.pipe(
            ofType(RegistrationsActions.loadRegistrations),
            switchMap(() =>
                registrationService.getRegistrations().pipe(
                    map(registrations => RegistrationsActions.loadRegistrationsSuccess({ registrations })),
                    catchError(error => of(RegistrationsActions.loadRegistrationsFailure({ error: error.message })))
                )
            )
        );
    },
    { functional: true }
);
```

## Coding Style

### Prefer Pure Functions

```typescript
// BAD
@Component()
class RegistrationListComponent {
    activeRegistrations = this.registrations.filter(r => r.status === 'active');
}

// GOOD
export const filterActiveRegistrations = (registrations: Registration[]): Registration[] =>
    registrations.filter(r => r.status === 'active');
```

### Use Strong Typing

- No `any` types
- Explicit return types
- Use interfaces for all data structures

### Immutable Data

- Use spread operators for updates
- Avoid mutation
- Use `readonly` where applicable

## Testing

- Vitest with Angular's `@angular/build:unit-test` builder for unit tests
- Components: test rendering with `@Input()` values
- Services: mock dependencies
- NgRx: test actions, reducers, selectors independently
- Pure functions: simple input/output tests
