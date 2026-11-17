import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { StatisticsViewComponent } from './statistics-view.component';

describe('StatisticsViewComponent', () => {
  it('renders all seven metrics including zeros in a semantic definition list', async () => {
    TestBed.configureTestingModule({
      imports: [StatisticsViewComponent],
      providers: [provideTranslateService()],
    });
    const fixture = TestBed.createComponent(StatisticsViewComponent);
    fixture.componentRef.setInput('statistics', {
      year: 2042,
      orderCount: 10,
      wishCount: 20,
      availableCount: 8,
      pendingConfirmationCount: 0,
      reservedCount: 3,
      receivedCount: 4,
      completedCount: 5,
    });
    await fixture.whenStable();
    expect(
      Array.from(fixture.nativeElement.querySelectorAll('dd'), (element) =>
        (element as HTMLElement).textContent?.trim(),
      ),
    ).toEqual(['10', '20', '8', '0', '3', '4', '5']);
    expect(fixture.nativeElement.querySelectorAll('dt')).toHaveLength(7);
    expect(fixture.nativeElement.querySelector('dl')).toBeTruthy();
  });
});
