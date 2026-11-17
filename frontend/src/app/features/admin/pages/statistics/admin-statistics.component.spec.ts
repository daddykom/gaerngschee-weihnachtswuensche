import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AdminStatisticsActions } from '../../../../store/admin-statistics/admin-statistics.actions';
import { AdminStatisticsComponent } from './admin-statistics.component';

describe('AdminStatisticsComponent', () => {
  it('offers retry on errors without displaying misleading counts', async () => {
    TestBed.configureTestingModule({
      imports: [AdminStatisticsComponent],
      providers: [
        provideTranslateService(),
        provideMockStore({
          initialState: { adminStatistics: { request: { status: 'error', errorCode: 'FAILED' } } },
        }),
      ],
    });
    const store = TestBed.inject(MockStore);
    const dispatch = vi.spyOn(store, 'dispatch');
    const fixture = TestBed.createComponent(AdminStatisticsComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dd')).toBeNull();
    fixture.nativeElement.querySelector('button').click();
    expect(dispatch).toHaveBeenCalledWith(AdminStatisticsActions.retryClicked());
    store.setState({ adminStatistics: { request: { status: 'loading' } } });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });
});
