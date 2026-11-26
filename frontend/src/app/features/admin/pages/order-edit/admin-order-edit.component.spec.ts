import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AdminOrder } from '../../../../shared/models/admin-order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import {
  selectAdminOrdersActiveOrderId,
  selectAdminOrdersForm,
} from '../../../../store/admin-orders/admin-orders.feature';
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

  afterEach(() => store.resetSelectors());

  it('restores the active form without replacing its feedback, text, status or wish edits', () => {
    const form = {
      ...component.formModel(),
      status: 'changes_requested' as const,
      currentText: 'Unsaved family text',
      adminNotes: 'Unsaved family feedback',
      items: component.formModel().items.map((item) => ({
        ...item,
        currentTitle: 'Unsaved wish title',
        adminNotes: 'Unsaved wish feedback',
        publicationStatus: 'rejected' as const,
      })),
    };
    store.overrideSelector(selectAdminOrdersActiveOrderId, order.id);
    store.overrideSelector(selectAdminOrdersForm, form);
    const dispatch = vi.spyOn(store, 'dispatch');
    fixture.destroy();
    fixture = TestBed.createComponent(AdminOrderEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.formModel()).toMatchObject({
      status: 'changes_requested',
      currentText: 'Unsaved family text',
      adminNotes: 'Unsaved family feedback',
      items: [
        expect.objectContaining({
          currentTitle: 'Unsaved wish title',
          adminNotes: 'Unsaved wish feedback',
        }),
      ],
    });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: AdminOrdersActions.formLoaded.type }),
    );
    component.save();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AdminOrdersActions.save.type,
        order: expect.objectContaining({
          adminNotes: 'Unsaved family feedback',
          currentText: 'Unsaved family text',
          status: 'changes_requested',
          items: expect.arrayContaining([
            expect.objectContaining({
              currentTitle: 'Unsaved wish title',
              adminNotes: 'Unsaved wish feedback',
            }),
          ]),
        }),
      }),
    );
  });

  it('does not reuse a form belonging to another order', () => {
    store.overrideSelector(selectAdminOrdersActiveOrderId, 'another-order');
    store.overrideSelector(selectAdminOrdersForm, {
      ...component.formModel(),
      adminNotes: 'Another order feedback',
    });
    const dispatch = vi.spyOn(store, 'dispatch');
    fixture.destroy();
    fixture = TestBed.createComponent(AdminOrderEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.formModel().adminNotes).toBe('');
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: AdminOrdersActions.formLoaded.type, orderId: order.id }),
    );
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

  it('retains image edits in the form, detects replaced files and snapshots them for saving', async () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    const first = new File(['first'], 'gift.png', { type: 'image/png' });
    const second = new File(['other'], 'gift.png', { type: 'image/png' });
    for (const file of [first, second]) {
      dispatch.mockClear();
      component.formModel.update((model) => ({
        ...model,
        items: model.items.map((item) => ({
          ...item,
          imageChange: { operation: 'replace' as const, revision: 0, file },
        })),
      }));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AdminOrdersActions.formChanged.type,
          changes: expect.objectContaining({
            items: [
              expect.objectContaining({ imageChange: { operation: 'replace', revision: 0, file } }),
            ],
          }),
        }),
      );
    }
    component.save();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AdminOrdersActions.save.type,
        imageChanges: [
          { itemId: 'item-1', change: { operation: 'replace', revision: 0, file: second } },
        ],
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

  it('keeps the current status when no status change is selected', () => {
    const dispatch = vi.spyOn(store, 'dispatch');

    component.formModel.update((model) => ({ ...model, status: 'unchanged' }));
    component.save();

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AdminOrdersActions.save.type,
        action: 'save',
        order: expect.objectContaining({ status: 'released' }),
      }),
    );
  });

  it('uses the current order status as the initial selection', () => {
    expect(component.formModel().status).toBe('released');
  });

  it('offers an unchanged option and the first five order statuses', () => {
    expect(component.statusOptions).toEqual([
      'unchanged',
      'draft',
      'released',
      'in_review',
      'changes_requested',
      'definitive',
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
