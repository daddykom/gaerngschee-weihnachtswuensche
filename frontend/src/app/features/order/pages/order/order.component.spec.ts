import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { NotificationActions } from '../../../../store/notification/notification.actions';
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

  it('rejects an order containing a wish without a description', () => {
    const dispatch = vi.spyOn(store, 'dispatch');

    component.save();

    expect(dispatch).toHaveBeenCalledWith(
      NotificationActions.show({
        variant: 'error',
        titleKey: 'app.order.notifications.errorTitle',
        messageKey: 'app.order.errors.items.description.required',
        preserveOnRoutes: ['/bestellung'],
      }),
    );
  });

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
  });
});
