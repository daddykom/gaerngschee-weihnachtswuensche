import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AdminOrder } from '../../../../shared/models/admin-order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import { NavigationActions } from '../../../../store/navigation/navigation.actions';
import { NotificationActions } from '../../../../store/notification/notification.actions';
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
    fairgateStatus: null,
    fairgateAdultsCount: null,
    fairgateChildrenCount: null,
    processingYear: 2026,
    releasedAt: null,
    definitiveAt: null,
    confirmationEmailSentAt: null,
    fairgateReminderEmailSentAt: null,
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

  it('uses the current order status as the initial selection', () => {
    expect(component.formModel().status).toBe('released');
  });

  it('offers all order statuses in workflow order', () => {
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

  it('shows an error instead of silently aborting when a wish description is missing', () => {
    const dispatch = vi.spyOn(store, 'dispatch');

    component.formModel.update((model) => ({
      ...model,
      items: model.items.map((item) => ({ ...item, currentDescription: '' })),
    }));
    component.save();

    expect(dispatch).toHaveBeenCalledWith(
      NotificationActions.show({
        variant: 'error',
        titleKey: 'app.admin.overview.saveErrorTitle',
        messageKey: 'app.admin.overview.errors.ITEM_DESCRIPTION_REQUIRED',
        preserveOnRoutes: ['/admin/overview', '/admin/orders'],
      }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: AdminOrdersActions.save.type }),
    );
  });
});
