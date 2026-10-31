import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import { AdminOverviewComponent } from './admin-overview.component';

describe('AdminOverviewComponent', () => {
  let component: AdminOverviewComponent;
  let fixture: ComponentFixture<AdminOverviewComponent>;
  let store: MockStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOverviewComponent],
      providers: [
        provideTranslateService(),
        provideMockStore({
          initialState: {
            adminOrders: {
              orders: [],
              statuses: ['definitive'],
              categories: ['gift'],
              loadStatus: 'loaded',
              saveStatus: 'initial',
              errorCode: null,
            },
          },
        }),
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(AdminOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('reads active filters from the store', () => {
    expect(component.selectedStatuses()).toEqual(['definitive']);
    expect(component.selectedCategories()).toEqual(['gift']);
  });

  it('keeps the other filter when one filter changes', () => {
    const dispatch = vi.spyOn(store, 'dispatch');

    component.statusChanged(['completed']);

    expect(dispatch).toHaveBeenLastCalledWith(
      AdminOrdersActions.filtersChanged({
        statuses: ['completed'],
        categories: ['gift'],
      }),
    );
  });
});
