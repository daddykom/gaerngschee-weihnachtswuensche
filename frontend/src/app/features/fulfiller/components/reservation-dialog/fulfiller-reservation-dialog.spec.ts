import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { initialState as frontendConfigState } from '../../../../store/frontend-config/frontend-config.state';
import { initialState as fulfillerOrdersState } from '../../../../store/fulfiller-orders/fulfiller-orders.state';
import { FulfillerReservationDialog } from './fulfiller-reservation-dialog';

describe('FulfillerReservationDialog', () => {
  let component: FulfillerReservationDialog;
  let fixture: ComponentFixture<FulfillerReservationDialog>;
  let store: MockStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FulfillerReservationDialog],
      providers: [
        provideMockStore({
          initialState: {
            frontendConfig: frontendConfigState,
            fulfillerOrders: fulfillerOrdersState,
          },
        }),
        provideTranslateService(),
        provideRouter([]),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            id: 'item-1',
            wishNumber: '12-1',
            currentDescription: 'Bauklötze',
            currentReason: null,
            fulfillmentStatus: 'available',
            reservedAt: null,
            reservationExpiresAt: null,
          },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FulfillerReservationDialog);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows reservation errors inside the dialog', async () => {
    store.setState({
      frontendConfig: frontendConfigState,
      fulfillerOrders: {
        ...fulfillerOrdersState,
        reservationStatus: 'error',
        reservationErrorCode: 'RATE_LIMITED',
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });
});
