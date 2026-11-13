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
