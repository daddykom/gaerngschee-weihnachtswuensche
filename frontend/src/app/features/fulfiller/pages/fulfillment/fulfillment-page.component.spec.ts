import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { FulfillerOrdersActions } from '../../../../store/fulfiller-orders/fulfiller-orders.actions';
import { FulfillmentPageComponent } from './fulfillment-page.component';

describe('FulfillmentPageComponent', () => {
  let component: FulfillmentPageComponent;
  let fixture: ComponentFixture<FulfillmentPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FulfillmentPageComponent],
      providers: [
        provideTranslateService(),
        provideMockStore({
          initialState: {
            fulfillerOrders: {
              orders: [],
              search: '',
              category: '',
              loadStatus: 'loaded',
              errorCode: null,
            },
          },
        }),
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FulfillmentPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('passes failed image events to the store', () => {
    const dispatch = vi.spyOn(TestBed.inject(MockStore), 'dispatch');
    const event = { itemId: 'item-1', imagePath: '/image-1' };
    component.imageFailed(event);
    expect(dispatch).toHaveBeenCalledWith(FulfillerOrdersActions.imageLoadFailed(event));
  });
});
