import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AdminOrder } from '../../../../shared/models/admin-order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import { NavigationActions } from '../../../../store/navigation/navigation.actions';
import { AdminOrderItemEditComponent } from './admin-order-item-edit.component';

describe('AdminOrderItemEditComponent', () => {
  let component: AdminOrderItemEditComponent;
  let fixture: ComponentFixture<AdminOrderItemEditComponent>;
  let store: MockStore;

  const order = {
    id: 'order-1',
    userId: 'user-1',
    requesterEmail: 'person@example.com',
    year: 2026,
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
        category: 'gift',
        itemNumber: null,
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
  } as AdminOrder;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOrderItemEditComponent],
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
            snapshot: {
              paramMap: { get: (name: string) => (name === 'orderId' ? 'order-1' : 'item-1') },
            },
          },
        },
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(AdminOrderItemEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('changes only the draft and navigates back when accepting a wish', () => {
    const dispatch = vi.spyOn(store, 'dispatch');

    component.accept();

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: AdminOrdersActions.draftChanged.type }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(2, NavigationActions.navigate({ target: 'back' }));
  });

  it('does not navigate or update the draft when rejection reason is empty', () => {
    const dispatch = vi.spyOn(store, 'dispatch');

    component.reject();

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('changes only the draft and navigates back when rejecting with a reason', () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    component.formModel.update((model) => ({ ...model, adminNotes: 'Nicht erfüllbar' }));

    component.reject();

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: AdminOrdersActions.draftChanged.type }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(2, NavigationActions.navigate({ target: 'back' }));
  });
});
