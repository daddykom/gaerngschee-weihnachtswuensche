import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeferBlockState, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { App } from './app';
import { AuthActions } from './store/auth/auth.actions';
import { initialState as authInitialState } from './store/auth/auth.state';
import { SessionActions } from './store/auth/session.actions';
import { initialState as frontendConfigInitialState } from './store/frontend-config/frontend-config.state';

@Component({ changeDetection: ChangeDetectionStrategy.Eager, template: '' })
class TestPage {}

describe('App', () => {
  let originalScrollIntoView: PropertyDescriptor | undefined;

  beforeEach(async () => {
    originalScrollIntoView = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    );
    await TestBed.configureTestingModule({
      imports: [App, RouterTestingModule],
      providers: [
        provideTranslateService(),
        provideMockStore({
          initialState: {
            auth: authInitialState,
            frontendConfig: { ...frontendConfigInitialState, publicStatus: 'loaded' },
            notification: { current: null },
          },
        }),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });

  it('should render router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it.each(['/client-login?token=registration-token', '/client-login/'])(
    'does not check a persisted session when booting on %s before router navigation',
    (path) => {
      const store = TestBed.inject(MockStore);
      store.setState({ auth: { ...authInitialState, group: 'wunschbesteller' } });
      vi.spyOn(TestBed.inject(Location), 'path').mockReturnValue(path);
      const dispatch = vi.spyOn(store, 'dispatch');

      expect(TestBed.inject(Router).url).toBe('/');
      TestBed.createComponent(App);

      expect(dispatch).not.toHaveBeenCalledWith(SessionActions.pollingStarted());
    },
  );

  it('continues checking persisted sessions outside the link-login route', () => {
    const store = TestBed.inject(MockStore);
    store.setState({ auth: { ...authInitialState, group: 'admin' } });
    vi.spyOn(TestBed.inject(Location), 'path').mockReturnValue('/admin/overview');
    const dispatch = vi.spyOn(store, 'dispatch');

    TestBed.createComponent(App);

    expect(dispatch).toHaveBeenCalledWith(SessionActions.pollingStarted());
  });

  it('shows the global notification in the info box', async () => {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [App, RouterTestingModule],
        providers: [
          provideTranslateService(),
          provideMockStore({
            initialState: {
              notification: {
                current: {
                  variant: 'error',
                  titleKey: 'app.auth.loginErrorTitle',
                  messageKey: 'INVALID_CREDENTIALS',
                  params: {},
                  preserveOnRoutes: [],
                },
              },
              auth: authInitialState,
            },
          }),
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('INVALID_CREDENTIALS');
  });

  it('scrolls a new notification into view when it is outside the viewport', async () => {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [App, RouterTestingModule],
        providers: [
          provideTranslateService(),
          provideMockStore({
            initialState: {
              notification: {
                current: {
                  variant: 'error',
                  titleKey: 'app.auth.loginErrorTitle',
                  messageKey: 'INVALID_CREDENTIALS',
                  params: {},
                  preserveOnRoutes: [],
                },
              },
              auth: authInitialState,
            },
          }),
        ],
      })
      .compileComponents();

    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: -100,
      bottom: 100,
      left: 0,
      right: 0,
      width: 0,
      height: 200,
      x: 0,
      y: -100,
      toJSON: () => ({}),
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('does not scroll a notification that is already visible', async () => {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [App, RouterTestingModule],
        providers: [
          provideTranslateService(),
          provideMockStore({
            initialState: {
              notification: {
                current: {
                  variant: 'info',
                  titleKey: 'app.title',
                  messageKey: 'app.title',
                  params: {},
                  preserveOnRoutes: [],
                },
              },
              auth: authInitialState,
            },
          }),
        ],
      })
      .compileComponents();

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 200,
      left: 0,
      right: 0,
      width: 0,
      height: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('dispatches logout from the app shell', () => {
    const store = TestBed.inject(MockStore);
    const dispatch = vi.spyOn(store, 'dispatch');
    const fixture = TestBed.createComponent(App);

    fixture.componentInstance.logout();

    expect(dispatch).toHaveBeenCalledWith(AuthActions.logoutRequested());
  });

  it('renders route metadata and the admin menu on an admin route', async () => {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [
          App,
          TestPage,
          RouterTestingModule.withRoutes([
            {
              path: 'admin/overview',
              component: TestPage,
              data: { pageTitle: 'app.admin.overview.title' },
            },
          ]),
        ],
        providers: [
          provideTranslateService(),
          provideMockStore({
            initialState: {
              auth: { ...authInitialState, group: 'admin', email: 'admin@example.com' },
              notification: { current: null },
            },
          }),
        ],
      })
      .compileComponents();

    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl('/admin/overview');
    fixture.detectChanges();
    const [adminNavigation] = await fixture.getDeferBlocks();
    await adminNavigation.render(DeferBlockState.Complete);
    fixture.detectChanges();

    expect(fixture.componentInstance.isAdmin()).toBe(true);
    expect(fixture.nativeElement.querySelector('.app-header__email')?.textContent).toContain(
      'admin@example.com',
    );
    expect(fixture.componentInstance.pageTitleKey()).toBe('app.admin.overview.title');
    expect(fixture.nativeElement.querySelector('.admin-menu-button')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[routerLink="/"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('main h1')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('main router-outlet')).toBeTruthy();
  });
});
