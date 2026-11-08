import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AdminOrder } from '../../../../shared/models/admin-order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import { NavigationActions } from '../../../../store/navigation/navigation.actions';
import { AdminOrderEditComponent } from './admin-order-edit.component';

describe('AdminOrderEditComponent', () => {
  let component: AdminOrderEditComponent;
  let fixture: ComponentFixture<AdminOrderEditComponent>;
  let store: MockStore;

  const order: AdminOrder = {
    id: 'order-1',
    userId: 'user-1',
    requesterEmail: 'person@example.com',
    year: 2026,
    orderNumber: null,
    status: 'released',
    adultsCount: 1,
    childrenCount: 1,
    originalText: 'Original',
    currentText: 'Aktuell',
    adminNotes: null,
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        itemNumber: null,
        category: 'gift',
        originalDescription: 'Originaler Wunsch',
        currentDescription: 'Aktueller Wunsch',
        originalReason: 'Originaler Grund',
        currentReason: 'Aktueller Grund',
        publicationStatus: 'submitted',
        fulfillmentStatus: 'available',
        adminNotes: null,
      },
    ],
    createdAt: null,
    updatedAt: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOrderEditComponent],
      providers: [
        provideTranslateService(),
        provideMockStore({
          initialState: {
            adminOrders: {
              orders: [order],
              statuses: [],
              categories: [],
              loadStatus: 'loaded',
              saveStatus: 'initial',
              errorCode: null,
            },
          },
        }),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'order-1' }, queryParamMap: { get: () => null } },
          },
        },
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(AdminOrderEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('dispatches browser back when cancelling', () => {
    const dispatch = vi.spyOn(store, 'dispatch');

    component.cancel();

    expect(dispatch).toHaveBeenCalledWith(NavigationActions.navigate({ target: 'back' }));
  });

  it('saves the complete draft with the save action', () => {
    const dispatch = vi.spyOn(store, 'dispatch');

    component.save();

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AdminOrdersActions.save.type,
        action: 'save',
        order: expect.objectContaining({ id: 'order-1', items: expect.any(Array) }),
      }),
    );
  });

  it('saves the selected status with the order', () => {
    const dispatch = vi.spyOn(store, 'dispatch');

    component.formModel.update((model) => ({ ...model, status: 'completed' }));
    component.save();

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AdminOrdersActions.save.type,
        action: 'save',
        order: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });
});
