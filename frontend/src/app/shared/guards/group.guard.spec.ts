import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Store } from '@ngrx/store';
import { UserGroup } from '../models/frontend-config.model';
import { groupGuard } from './group.guard';

describe('groupGuard', () => {
  const router = {
    parseUrl: vi.fn(() => ({ url: '/not-found' }) as unknown as UrlTree),
  };

  const createGuardResult = (group: UserGroup | null, allowedGroups: UserGroup[]) => {
    const store = {
      selectSignal: vi.fn(() => () => group),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Store, useValue: store },
        { provide: Router, useValue: router },
      ],
    });

    return TestBed.runInInjectionContext(() =>
      groupGuard(allowedGroups)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  };

  beforeEach(() => {
    router.parseUrl.mockClear();
  });

  it.each<UserGroup>(['admin', 'user'])('allows the %s group', (group) => {
    expect(createGuardResult(group, ['user', 'admin'])).toBe(true);
    expect(router.parseUrl).not.toHaveBeenCalled();
  });

  it('rejects the client group', () => {
    expect(createGuardResult('client', ['user', 'admin'])).toEqual({ url: '/not-found' });
    expect(router.parseUrl).toHaveBeenCalledWith('/not-found');
  });

  it('rejects an unauthenticated user', () => {
    expect(createGuardResult(null, ['user', 'admin'])).toEqual({ url: '/not-found' });
    expect(router.parseUrl).toHaveBeenCalledWith('/not-found');
  });
});
