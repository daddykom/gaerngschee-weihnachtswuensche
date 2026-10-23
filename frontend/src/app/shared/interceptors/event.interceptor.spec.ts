import { HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { firstValueFrom, of } from 'rxjs';
import { EventActions } from '../../store/events/events.actions';
import { eventInterceptor } from './event.interceptor';

describe('eventInterceptor', () => {
  it('dispatches event values higher than the store value', async () => {
    const store = {
      selectSignal: vi.fn(() => () => ({ 'order-status-change': 2 })),
      dispatch: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [{ provide: Store, useValue: store }] });
    const response = new HttpResponse({
      headers: new HttpHeaders({ 'X-Event-order-status-change': '3' }),
    });

    await firstValueFrom(
      TestBed.runInInjectionContext(() =>
        eventInterceptor(new HttpRequest('GET', '/admin/overview'), () => of(response)),
      ),
    );

    expect(store.dispatch).toHaveBeenCalledWith(
      EventActions.received({ key: 'order-status-change', value: 3 }),
    );
  });

  it('ignores equal, lower, and invalid event values', async () => {
    const store = {
      selectSignal: vi.fn(() => () => ({ 'order-status-change': 3 })),
      dispatch: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [{ provide: Store, useValue: store }] });
    const response = new HttpResponse({
      headers: new HttpHeaders({
        'X-Event-order-status-change': '3',
        'X-Event-other': 'not-an-integer',
      }),
    });

    await firstValueFrom(
      TestBed.runInInjectionContext(() =>
        eventInterceptor(new HttpRequest('GET', '/admin/overview'), () => of(response)),
      ),
    );

    expect(store.dispatch).not.toHaveBeenCalled();
  });
});
