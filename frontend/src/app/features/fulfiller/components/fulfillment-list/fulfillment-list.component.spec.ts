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
    expect(fixture.nativeElement.querySelector('a').textContent.trim()).toBe(
      'app.fulfiller.wishDetails.giftLink',
    );
    expect(fixture.nativeElement.textContent).not.toContain('app.order.items.');
    expect(fixture.nativeElement.textContent).not.toContain('Private');
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
      '/images/wish-gift.jpg',
    );
  });

  it('selects a stored wish image and reports failure without retrying a failed fallback', async () => {
    const wish = {
      id: 'item-1',
      itemNumber: 1,
      wishNumber: '12-1',
      category: 'gift' as const,
      title: 'Wish',
      currentDescription: 'Description',
      fulfillmentStatus: 'available' as const,
      reservedAt: null,
      reservationExpiresAt: null,
      imagePath: '/public/fulfiller/wishes/item-1/images/image-1',
    };
    fixture.componentRef.setInput('imageBaseUrl', 'http://localhost:8083');
    fixture.componentRef.setInput('orders', [
      { id: 'order-1', year: 2026, orderNumber: 12, currentText: null, items: [wish] },
    ]);
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('http://localhost:8083' + wish.imagePath);
    expect(image.getAttribute('loading')).toBe('lazy');
    const emit = vi.spyOn(component.imageFailed, 'emit');
    image.dispatchEvent(new Event('error'));
    expect(emit).toHaveBeenCalledExactlyOnceWith({ itemId: wish.id, imagePath: wish.imagePath });
    component.onImageError({ ...wish, imagePath: null });
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
