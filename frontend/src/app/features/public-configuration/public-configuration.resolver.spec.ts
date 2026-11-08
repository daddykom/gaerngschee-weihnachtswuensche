import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { NavigationProgressService } from '../../shared/services/navigation-progress.service';
import { FrontendConfigActions } from '../../store/frontend-config/frontend-config.actions';
import { initialState } from '../../store/frontend-config/frontend-config.state';
import { publicConfigurationResolver } from './public-configuration.resolver';

describe('publicConfigurationResolver', () => {
  let store: MockStore;
  let progress: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    progress = { start: vi.fn(), stop: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({ initialState: { frontendConfig: initialState } }),
        { provide: NavigationProgressService, useValue: progress },
      ],
    });
    store = TestBed.inject(MockStore);
  });

  it('loads and waits for the public configuration', async () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    const result = TestBed.runInInjectionContext(() =>
      publicConfigurationResolver({} as never, {} as never),
    ) as Observable<boolean>;
    const resolved = firstValueFrom(result);

    expect(progress.start).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(FrontendConfigActions.loadPublic());

    store.setState({
      frontendConfig: { ...initialState, publicStatus: 'loaded', publicConfigs: [] },
    });

    await expect(resolved).resolves.toBe(true);
    expect(progress.stop).toHaveBeenCalledTimes(1);
  });

  it('does not reload an already loaded configuration', async () => {
    store.setState({ frontendConfig: { ...initialState, publicStatus: 'loaded' } });
    const dispatch = vi.spyOn(store, 'dispatch');

    const result = TestBed.runInInjectionContext(() =>
      publicConfigurationResolver({} as never, {} as never),
    ) as Observable<boolean>;

    await expect(firstValueFrom(result)).resolves.toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
    expect(progress.start).not.toHaveBeenCalled();
  });
});
