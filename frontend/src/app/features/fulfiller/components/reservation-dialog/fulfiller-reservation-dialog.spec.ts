import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { initialState as frontendConfigState } from '../../../../store/frontend-config/frontend-config.state';
import { initialState as fulfillerOrdersState } from '../../../../store/fulfiller-orders/fulfiller-orders.state';
import { FulfillerReservationDialog } from './fulfiller-reservation-dialog';

describe('FulfillerReservationDialog', () => {
  let component: FulfillerReservationDialog;
  let fixture: ComponentFixture<FulfillerReservationDialog>;

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
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
