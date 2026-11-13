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
            frontendConfig: {
              ...frontendConfigState,
              publicConfigs: [
                { variableName: 'fulfiller_handover_date', value: '17.–19. Dezember 2026' },
              ],
            },
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
            title: 'Edited title',
            currentDescription: 'Bauklötze',
            giftLink: 'https://example.com/gift',
            personalMessage: 'Private team message',
            currentReason: 'Private legacy message',
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

  it('shows the public wish details without private messages', () => {
    const details = fixture.nativeElement.querySelector('.reservation-dialog__details');
    expect(details.textContent).toContain('Edited title');
    expect(details.textContent).toContain('Bauklötze');
    expect(details.querySelector('a').getAttribute('href')).toBe('https://example.com/gift');
    expect(fixture.nativeElement.textContent).not.toContain('Private');
    expect(fixture.nativeElement.textContent).toContain('17.–19. Dezember 2026');
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
