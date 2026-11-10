import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { NotificationActions } from '../../../../store/notification/notification.actions';
import { OrderActions } from '../../../../store/order/order.actions';
import { selectOrderForm } from '../../../../store/order/order.feature';
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
