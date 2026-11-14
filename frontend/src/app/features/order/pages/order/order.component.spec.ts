import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { NotificationActions } from '../../../../store/notification/notification.actions';
import { OrderActions } from '../../../../store/order/order.actions';
import { selectOrder, selectOrderForm } from '../../../../store/order/order.feature';
import { OrderComponent } from './order.component';

describe('OrderComponent', () => {
  let component: OrderComponent;
  let fixture: ComponentFixture<OrderComponent>;
  let store: MockStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderComponent],
      providers: [
        provideTranslateService(),
        provideMockStore({
          initialState: {
            order: {
              status: 'loaded',
              order: {
                id: 'order-1',
                status: 'draft',
                originalText: 'Meine ursprüngliche Situation',
                currentText: 'Meine Situation',
                items: [{ id: 'item-1', status: 'submitted' }],
              },
              year: 2026,
              fairgateStatus: null,
              fairgateUserExists: false,
              childrenCount: 0,
              adultsCount: 1,
              form: {
                password: '',
                passwordConfirmation: '',
                adultsCount: 1,
                childrenCount: 0,
                text: 'Meine Situation',
                items: [
                  {
                    id: 'item-1',
                    category: 'gift',
                    personType: 'adult',
                    personIndex: 1,
                    title: 'Winterjacke',
                    description: '',
                    giftLink: '',
                    personalMessage: '',
                  },
                ],
              },
              errorCode: null,
              saveStatus: 'initial',
              saveErrorCode: null,
            },
          },
        }),
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(true) })) } },
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(OrderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    store.resetSelectors();
  });

  it('shows wish feedback next to the corresponding wish title as text', () => {
    store.overrideSelector(selectOrder, {
      ...component.order()!,
      status: 'changes_requested',
      items: component.order()!.items.map((item) => ({
        ...item,
        status: 'rejected' as const,
        adminNotes: 'Please review <b>the wish</b>.\nPlease specify the size.',
      })),
    });
    store.refreshState();
    fixture.detectChanges();
    const feedback = fixture.nativeElement.querySelector('tbody app-info-box') as HTMLElement;

    expect(feedback.closest('td')?.textContent).toContain('Winterjacke');
    expect(feedback.textContent).toContain('app.order.items.feedback');
    expect(feedback.querySelector('p')?.textContent).toBe(
      'Please review <b>the wish</b>.\nPlease specify the size.',
    );
    expect(feedback.querySelector('b')).toBeNull();
  });

  it('shows the original text separately from the editable current version', () => {
    const original = fixture.nativeElement.querySelector(
      '[aria-labelledby="original-order-text-heading"]',
    ) as HTMLElement;
    const current = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;

    expect(original.textContent).toContain('app.order.publicText.originalLabel');
    expect(original.querySelector('p')?.textContent).toBe('Meine ursprüngliche Situation');
    expect(original.querySelector('textarea, input')).toBeNull();
    expect(current.value).toBe('Meine Situation');
    expect(current.readOnly).toBe(false);
    expect(current.closest('mat-form-field')?.textContent).toContain(
      'app.order.publicText.currentLabel',
    );
  });

  it('keeps the original text unchanged when the current version is edited', async () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    const current = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    current.value = 'Meine neu geprüfte Situation';
    current.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dispatch).toHaveBeenCalledWith(
      OrderActions.formChanged({ changes: { text: 'Meine neu geprüfte Situation' } }),
    );
    expect(component.order()?.originalText).toBe('Meine ursprüngliche Situation');
    expect(
      fixture.nativeElement.querySelector('[aria-labelledby="original-order-text-heading"] p')
        ?.textContent,
    ).toBe('Meine ursprüngliche Situation');
  });

  it('renders original text as text, not HTML', () => {
    store.overrideSelector(selectOrder, {
      ...component.order()!,
      originalText: '<b>Original text</b>\nSecond line',
    });
    store.refreshState();
    fixture.detectChanges();
    const original = fixture.nativeElement.querySelector(
      '[aria-labelledby="original-order-text-heading"] p',
    ) as HTMLElement;

    expect(original.textContent).toBe('<b>Original text</b>\nSecond line');
    expect(original.querySelector('b')).toBeNull();
    expect(original.classList.contains('gl-text--multiline')).toBe(true);
  });

  it('keeps the current version read-only for submitted orders', () => {
    store.overrideSelector(selectOrder, { ...component.order()!, status: 'released' });
    store.refreshState();
    fixture.detectChanges();
    const current = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;

    expect(current.readOnly).toBe(true);
    expect(current.value).toBe('Meine Situation');
    expect(
      fixture.nativeElement.querySelector('[aria-labelledby="original-order-text-heading"] p')
        ?.textContent,
    ).toBe('Meine ursprüngliche Situation');
  });

  it('does not show an empty original text section for legacy orders', () => {
    store.overrideSelector(selectOrder, { ...component.order()!, originalText: null });
    store.refreshState();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[aria-labelledby="original-order-text-heading"]'),
    ).toBeNull();
  });

  it.each(['draft', 'submit'] as const)(
    'rejects a %s containing a wish without a description',
    (mode) => {
      const dispatch = vi.spyOn(store, 'dispatch');

      component.save(mode);

      expect(dispatch).toHaveBeenCalledWith(
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.order.notifications.errorTitle',
          messageKey: 'app.order.errors.items.description.required',
          preserveOnRoutes: ['/bestellung'],
        }),
      );
    },
  );

  it('requires the password when no order exists after loading', () => {
    store.setState({
      order: {
        status: 'loaded',
        order: null,
        year: 2026,
        fairgateStatus: null,
        fairgateUserExists: false,
        childrenCount: 0,
        adultsCount: 1,
        form: {
          password: '',
          passwordConfirmation: '',
          adultsCount: 1,
          childrenCount: 0,
          text: 'Meine Situation',
          items: [],
        },
        errorCode: null,
        saveStatus: 'initial',
        saveErrorCode: null,
      },
    });
    fixture.detectChanges();

    expect(component.firstAccess()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[aria-labelledby="original-order-text-heading"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('input[type="password"]')).toHaveLength(2);
    expect(component.orderForm().valid()).toBe(false);
    const dispatch = vi.spyOn(store, 'dispatch');
    component.saveDraft();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: OrderActions.draftSaveClicked.type }),
    );
  });

  it('saves the complete form as a draft without opening the submission dialog', () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    const dialog = TestBed.inject(MatDialog);
    const validForm = {
      ...component.storeForm(),
      items: component.storeForm().items.map((item) => ({ ...item, description: 'A warm coat' })),
    };
    store.overrideSelector(selectOrderForm, validForm);
    store.refreshState();
    component.formModel.set(validForm);
    fixture.detectChanges();

    component.saveDraft();

    expect(dispatch).toHaveBeenCalledWith(
      OrderActions.draftSaveClicked({ form: component.storeForm() }),
    );
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it.each(['draft', 'submit'] as const)('rejects a %s without situation text or wishes', (mode) => {
    component.formModel.update((value) => ({ ...value, text: '', items: [] }));
    fixture.detectChanges();
    const dispatch = vi.spyOn(store, 'dispatch');

    component.save(mode);

    expect(component.orderForm().valid()).toBe(false);
    expect(component.orderForm().touched()).toBe(true);
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: OrderActions.draftSaveClicked.type }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: OrderActions.save.type }),
    );
    expect(TestBed.inject(MatDialog).open).not.toHaveBeenCalled();
  });
});
