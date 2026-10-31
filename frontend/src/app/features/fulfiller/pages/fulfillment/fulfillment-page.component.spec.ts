import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
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
              reserveStatus: 'initial',
              errorCode: null,
              reserveErrorCode: null,
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
});
