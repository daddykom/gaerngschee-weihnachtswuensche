import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, required } from '@angular/forms/signals';
import { provideTranslateService } from '@ngx-translate/core';
import { GiftReceiptViewComponent } from './gift-receipt-view.component';

describe('GiftReceiptViewComponent', () => {
  let component: GiftReceiptViewComponent;
  let fixture: ComponentFixture<GiftReceiptViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GiftReceiptViewComponent],
      providers: [provideTranslateService()],
    }).compileComponents();

    fixture = TestBed.createComponent(GiftReceiptViewComponent);
    component = fixture.componentInstance;
    const searchForm = TestBed.runInInjectionContext(() =>
      form(signal({ giftNumber: '' }), (schema) => required(schema.giftNumber)),
    );
    fixture.componentRef.setInput('searchForm', searchForm);
    fixture.componentRef.setInput('lookup', { status: 'initial' });
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows no validation errors until submission and then focuses the invalid field', async () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const scroll = vi.fn();
    input.scrollIntoView = scroll;
    expect(component.searchForm().giftNumber().touched()).toBe(false);
    const emitted = vi.spyOn(component.searchSubmitted, 'emit');
    component.submit(new Event('submit'));
    await fixture.whenStable();
    expect(component.searchForm().giftNumber().touched()).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(scroll).toHaveBeenCalled();
    expect(emitted).not.toHaveBeenCalled();
  });

  it('emits a valid search without modifying data', () => {
    component.searchForm().giftNumber().value.set('12-3');
    const emitted = vi.spyOn(component.searchSubmitted, 'emit');
    component.submit(new Event('submit'));
    expect(emitted).toHaveBeenCalledOnce();
  });
});
