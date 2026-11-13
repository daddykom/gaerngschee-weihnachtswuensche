import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { FulfillmentListComponent } from './fulfillment-list.component';

describe('FulfillmentListComponent', () => {
  let component: FulfillmentListComponent;
  let fixture: ComponentFixture<FulfillmentListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FulfillmentListComponent],
      providers: [provideTranslateService()],
    }).compileComponents();

    fixture = TestBed.createComponent(FulfillmentListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the edited title, description and link but never private legacy content', async () => {
    fixture.componentRef.setInput('orders', [
      {
        id: 'order-1',
        year: 2026,
        orderNumber: 12,
        currentText: null,
        items: [
          {
            id: 'item-1',
            itemNumber: 1,
            wishNumber: '12-1',
            category: 'gift',
            title: 'Edited title',
            currentDescription: 'Edited description',
            giftLink: 'https://example.com/gift',
            fulfillmentStatus: 'available',
            reservedAt: null,
            reservationExpiresAt: null,
            originalTitle: 'Private original title',
            originalDescription: 'Private original description',
            currentReason: 'Private legacy message',
            personalMessage: 'Private team message',
          },
        ],
      },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('h3').textContent).toContain('Edited title');
    expect(fixture.nativeElement.textContent).toContain('Edited description');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe(
      'https://example.com/gift',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Private');
  });
});
