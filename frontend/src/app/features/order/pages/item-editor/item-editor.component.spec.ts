import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSelect } from '@angular/material/select';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Order } from '../../../../shared/models/order.model';
import { OrderActions } from '../../../../store/order/order.actions';
import { selectOrder } from '../../../../store/order/order.feature';
import { ItemEditorComponent } from './item-editor.component';

describe('ItemEditorComponent', () => {
  let component: ItemEditorComponent;
  let fixture: ComponentFixture<ItemEditorComponent>;
  let store: MockStore;

  const item = {
    id: 'item-1',
    category: 'gift' as const,
    personType: 'adult' as const,
    personIndex: 1,
    title: 'Winterjacke',
    description: 'Eine warme Jacke',
    giftLink: '',
    personalMessage: 'Das wäre schön.',
  };

  const order: Order = {
    id: 'order-1',
    userId: 'user-1',
    year: 2026,
    status: 'changes_requested',
    adultsCount: 1,
    childrenCount: 0,
    originalText: 'Family text',
    currentText: 'Family text',
    adminNotes: null,
    fairgateStatus: 'valid',
    confirmationEmailSentAt: null,
    fairgateReminderEmailSentAt: null,
    createdAt: null,
    updatedAt: null,
    items: [
      {
        id: item.id,
        orderId: 'order-1',
        category: 'gift',
        personType: 'adult',
        personIndex: 1,
        originalTitle: '<b>Original title</b>',
        currentTitle: item.title,
        originalDescription: 'Original wish text\nSecond line',
        currentDescription: item.description,
        giftLink: null,
        originalReason: null,
        currentReason: null,
        personalMessage: item.personalMessage,
        status: 'rejected',
        adminNotes: 'Please check <b>the size</b>.\nPlease review the text.',
        fulfillerEmail: null,
        reservedAt: null,
        dueAt: null,
        receivedAt: null,
        createdAt: null,
        updatedAt: null,
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemEditorComponent],
      providers: [
        provideTranslateService(),
        provideMockStore({
          initialState: {
            order: {
              status: 'loaded',
              order,
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
                items: [item],
              },
              errorCode: null,
              saveStatus: 'initial',
              saveErrorCode: null,
            },
            auth: { firstAccess: false },
          },
        }),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'item-1' },
              routeConfig: { path: 'wunsch/:itemId' },
            },
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(ItemEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => store.resetSelectors());

  it('shows original title and description as text alongside the editable versions', () => {
    const originalTitle = fixture.nativeElement.querySelector(
      '[aria-labelledby="original-wish-title-heading"]',
    ) as HTMLElement;
    const originalDescription = fixture.nativeElement.querySelector(
      '[aria-labelledby="original-wish-description-heading"]',
    ) as HTMLElement;
    expect(originalTitle.querySelector('p')?.textContent).toBe(order.items[0].originalTitle);
    expect(originalTitle.querySelector('b, input, textarea')).toBeNull();
    expect(originalDescription.querySelector('p')?.textContent).toBe(
      order.items[0].originalDescription,
    );
    expect(originalDescription.querySelector('input, textarea')).toBeNull();
    const title = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const description = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(title.value).toBe(item.title);
    expect(title.readOnly).toBe(false);
    expect(description.value).toBe(item.description);
    expect(description.readOnly).toBe(false);
    expect(title.closest('mat-form-field')?.textContent).toContain('app.order.items.currentTitle');
    expect(description.closest('mat-form-field')?.textContent).toContain(
      'app.order.items.currentDescription',
    );
  });

  it('shows the wish feedback as multiline text rather than HTML', () => {
    const feedback = fixture.nativeElement.querySelector('app-info-box') as HTMLElement;
    expect(feedback.textContent).toContain('app.order.items.feedback');
    expect(feedback.querySelector('p')?.textContent).toBe(order.items[0].adminNotes);
    expect(feedback.querySelector('b')).toBeNull();
    expect(feedback.querySelector('p')?.classList.contains('gl-text--multiline')).toBe(true);
  });

  it('edits only the current title and description, leaving originals and feedback unchanged', () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    component.formModel.update((value) => ({
      ...value,
      title: 'Requester title',
      description: 'Requester description',
    }));
    component.save();

    expect(dispatch).toHaveBeenCalledWith(
      OrderActions.itemFormChanged({
        itemId: item.id,
        changes: { title: 'Requester title', description: 'Requester description' },
      }),
    );
    expect(component.originalItem()).toBe(order.items[0]);
    expect(component.feedback()).toBe(order.items[0].adminNotes);
  });

  it('does not show empty original sections or feedback for an unsaved wish', () => {
    store.overrideSelector(selectOrder, { ...order, items: [] });
    store.refreshState();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[aria-labelledby="original-wish-title-heading"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-labelledby="original-wish-description-heading"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('app-info-box')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('input').closest('mat-form-field').textContent,
    ).toContain('app.order.items.wishTitle');
  });

  it('does not show old wish feedback for a submitted order', () => {
    store.overrideSelector(selectOrder, { ...order, status: 'released' });
    store.refreshState();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-info-box')).toBeNull();
  });

  it('requires a non-empty wish title and description', () => {
    component.formModel.update((value) => ({ ...value, title: '  ', description: '  ' }));

    expect(component.itemForm().valid()).toBe(false);
  });

  it('dispatches the description when saving a valid wish', () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    component.formModel.update((value) => ({ ...value, description: 'Ausführliche Beschreibung' }));
    component.save();

    expect(dispatch).toHaveBeenCalledWith(
      OrderActions.itemFormChanged({
        itemId: 'item-1',
        changes: { description: 'Ausführliche Beschreibung' },
      }),
    );
  });

  it('shows the stored person assignment in the select', () => {
    const personSelect = fixture.debugElement.query(By.directive(MatSelect))
      .componentInstance as MatSelect;

    expect(personSelect.value).toBe('adult:1');
  });
});
