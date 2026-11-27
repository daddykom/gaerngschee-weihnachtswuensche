import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AdminOrder, AdminOrderFormValue } from '../../../../shared/models/admin-order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import {
  selectAdminItemImage,
  selectAdminOrdersActiveOrderId,
  selectAdminOrdersForm,
} from '../../../../store/admin-orders/admin-orders.feature';
import { selectImageTransfers } from '../../../../store/image-transfers/image-transfers.feature';
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
        originalTitle: 'Original title',
        currentTitle: 'Edited title',
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

  const form: AdminOrderFormValue = {
    status: order.status,
    currentText: order.currentText ?? '',
    adminNotes: '',
    adultsCount: order.adultsCount,
    childrenCount: order.childrenCount,
    items: order.items.map((item) => ({
      ...item,
      currentTitle: item.currentTitle ?? item.currentDescription,
      currentReason: item.currentReason ?? '',
      adminNotes: item.adminNotes ?? '',
    })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOrderItemEditComponent],
      providers: [
        provideTranslateService(),
        provideMockStore({
          selectors: [
            {
              selector: selectAdminItemImage,
              value: {
                status: 'loaded',
                orderId: 'order-1',
                itemId: 'item-1',
                data: { revision: 3, image: null },
                blob: null,
              },
            },
            { selector: selectImageTransfers, value: [] },
          ],
          initialState: {
            adminOrders: {
              orders: [order],
              statuses: [],
              categories: [],
              loadStatus: 'loaded',
              saveStatus: 'initial',
              errorCode: null,
              activeOrderId: order.id,
              form,
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

  afterEach(() => store.resetSelectors());

  it('opens from the active form and preserves its general feedback and other wish edits', () => {
    const existingForm: AdminOrderFormValue = {
      ...form,
      currentText: 'Unsaved family text',
      adminNotes: 'Family feedback',
      adultsCount: 3,
      items: [
        { ...form.items[0], currentTitle: 'Previous first edit', adminNotes: 'First feedback' },
        {
          ...form.items[0],
          id: 'item-2',
          currentTitle: 'Previous second edit',
          adminNotes: 'Second feedback',
        },
      ],
    };
    store.overrideSelector(selectAdminOrdersForm, existingForm);
    const dispatch = vi.spyOn(store, 'dispatch');
    fixture.destroy();
    fixture = TestBed.createComponent(AdminOrderItemEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.formModel().currentTitle).toBe('Previous first edit');
    expect(component.formModel().adminNotes).toBe('First feedback');
    expect(component.personOptions().filter((option) => option.type === 'adult')).toHaveLength(3);
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: AdminOrdersActions.formLoaded.type }),
    );

    component.formModel.update((item) => ({ ...item, currentTitle: 'New first edit' }));
    component.save();
    expect(dispatch).toHaveBeenCalledWith(
      AdminOrdersActions.formChanged({
        orderId: order.id,
        changes: {
          items: [
            { ...existingForm.items[0], currentTitle: 'New first edit' },
            existingForm.items[1],
          ],
        },
      }),
    );
    expect(existingForm.adminNotes).toBe('Family feedback');
    expect(existingForm.items[0].currentTitle).toBe('Previous first edit');
  });

  it('initializes from the stored order when the active form belongs to another order', () => {
    store.overrideSelector(selectAdminOrdersActiveOrderId, 'another-order');
    store.overrideSelector(selectAdminOrdersForm, {
      ...form,
      items: form.items.map((item) => ({ ...item, currentTitle: 'Wrong order title' })),
    });
    const dispatch = vi.spyOn(store, 'dispatch');
    fixture.destroy();
    fixture = TestBed.createComponent(AdminOrderItemEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.formModel().currentTitle).toBe('Edited title');
    expect(dispatch).toHaveBeenCalledWith(
      AdminOrdersActions.formLoaded({ orderId: order.id, form }),
    );
  });

  it('changes only the draft and navigates back when saving a wish status', () => {
    const dispatch = vi.spyOn(store, 'dispatch');

    component.formModel.update((model) => ({ ...model, publicationStatus: 'approved' }));
    component.save();

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: AdminOrdersActions.formChanged.type }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(2, NavigationActions.navigate({ target: 'back' }));
  });

  it('updates the existing form with a replacement file without saving or starting an upload', () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    const file = new File(['gift'], 'gift.png', { type: 'image/png' });
    component.selectImage(file);
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      AdminOrdersActions.formChanged({
        orderId: order.id,
        changes: {
          items: [{ ...form.items[0], imageChange: { operation: 'replace', revision: 3, file } }],
        },
      }),
    );
    expect(component.itemForm.imageChange().valid()).toBe(true);
    expect(component.itemForm.imageChange().touched()).toBe(true);
  });

  it('validates type and size, blocks continuing and can discard an invalid selection', () => {
    fixture.nativeElement.querySelector('app-order-item-image-editor').scrollIntoView = vi.fn();
    const dispatch = vi.spyOn(store, 'dispatch');
    for (const [file, kind] of [
      [new File(['not an image'], 'gift.svg', { type: 'image/svg+xml' }), 'fileType'],
      [
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
        'tooLarge',
      ],
    ] as const) {
      component.selectImage(file);
      expect(component.itemForm.imageChange().errors()[0]?.kind).toBe(kind);
      dispatch.mockClear();
      component.save();
      expect(dispatch).not.toHaveBeenCalledWith(NavigationActions.navigate({ target: 'back' }));
    }
    component.resetImage();
    expect(component.formModel().imageChange).toBeNull();
    expect(component.itemForm.imageChange().valid()).toBe(true);
  });

  it('stages removal of stored images and can undo it', () => {
    store.overrideSelector(selectAdminItemImage, {
      status: 'loaded',
      orderId: 'order-1',
      itemId: 'item-1',
      data: {
        revision: 3,
        image: {
          id: 'img',
          mimeType: 'image/png',
          width: 1,
          height: 1,
          byteSize: 4,
          updatedAt: '',
        },
      },
      blob: new Blob(['gift'], { type: 'image/png' }),
    });
    store.refreshState();
    component.removeImage();
    expect(component.formModel().imageChange).toEqual({ operation: 'remove', revision: 3 });
    component.resetImage();
    expect(component.formModel().imageChange).toBeNull();
  });

  it('prevents changing images while this wish has an active transfer', () => {
    store.overrideSelector(selectImageTransfers, [
      {
        id: 'job',
        orderId: order.id,
        itemId: 'item-1',
        status: 'queued',
        change: { operation: 'remove', revision: 3 },
      },
    ]);
    store.refreshState();
    component.selectImage(new File(['gift'], 'gift.png', { type: 'image/png' }));
    expect(component.formModel().imageChange).toBeNull();
  });

  it('distinguishes original title and description from their editable values', () => {
    const originals = Array.from(
      fixture.nativeElement.querySelectorAll('.original-text'),
    ) as HTMLElement[];
    expect(originals.map((element) => element.textContent?.trim())).toEqual([
      'Original title',
      'Originaler Wunsch',
    ]);
    expect(fixture.nativeElement.querySelector('input[matInput]').value).toBe('Edited title');
    expect(fixture.nativeElement.querySelector('textarea').value).toBe('Aktueller Wunsch');
    expect(fixture.nativeElement.textContent).toContain('app.admin.overview.originalTitle');
    expect(fixture.nativeElement.textContent).toContain('app.admin.overview.currentTitle');
    expect(fixture.nativeElement.textContent).toContain('app.admin.overview.originalDescription');
  });

  it('does not navigate or update the draft when a rejection reason is empty', () => {
    const dispatch = vi.spyOn(store, 'dispatch');

    component.formModel.update((model) => ({ ...model, publicationStatus: 'rejected' }));
    component.save();

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('changes only the draft and navigates back when rejecting with a reason', () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    component.formModel.update((model) => ({
      ...model,
      publicationStatus: 'rejected',
      adminNotes: 'Nicht erfüllbar',
    }));

    component.save();

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: AdminOrdersActions.formChanged.type }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(2, NavigationActions.navigate({ target: 'back' }));
  });
});
