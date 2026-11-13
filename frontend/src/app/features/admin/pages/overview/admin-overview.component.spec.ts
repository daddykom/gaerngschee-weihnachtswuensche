import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AdminOrder } from '../../../../shared/models/admin-order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import { selectAdminFilteredOrders } from '../../../../store/admin-orders/admin-orders.feature';
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
              searchForm: { email: '', orderNumber: '' },
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

  it('counts every item in the filtered orders and updates when the result changes', () => {
    const orders = store.overrideSelector(selectAdminFilteredOrders, [
      { id: 'order-1', items: [{}, {}] },
      { id: 'order-2', items: [{}] },
    ] as AdminOrder[]);
    store.refreshState();
    expect(component.orders().length).toBe(2);
    expect(component.itemCount()).toBe(3);

    orders.setResult([{ id: 'order-2', items: [{}] }] as AdminOrder[]);
    store.refreshState();
    expect(component.orders().length).toBe(1);
    expect(component.itemCount()).toBe(1);

    orders.setResult([]);
    store.refreshState();
    expect(component.orders().length).toBe(0);
    expect(component.itemCount()).toBe(0);
  });

  it('offers all order statuses as selectable filters', () => {
    expect(component.statusOptions).toEqual([
      'draft',
      'released',
      'in_review',
      'changes_requested',
      'definitive',
      'ready_for_pickup',
      'completed',
    ]);
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

  it('dispatches only the changed email search field', () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;

    input.value = 'EXAMPLE';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(dispatch).toHaveBeenCalledWith(
      AdminOrdersActions.searchFormChanged({ changes: { email: 'EXAMPLE' } }),
    );
  });

  it('dispatches only the changed order number search field', () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    const input = fixture.nativeElement.querySelector(
      'input[inputmode="numeric"]',
    ) as HTMLInputElement;
    input.value = '12';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(dispatch).toHaveBeenCalledWith(
      AdminOrdersActions.searchFormChanged({ changes: { orderNumber: '12' } }),
    );
  });
});
