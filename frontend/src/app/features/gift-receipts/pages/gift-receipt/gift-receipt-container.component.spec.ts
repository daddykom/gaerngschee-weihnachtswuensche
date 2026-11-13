import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { GiftReceiptsActions } from '../../../../store/gift-receipts/gift-receipts.actions';
import { initialState } from '../../../../store/gift-receipts/gift-receipts.state';
import { GiftReceiptContainerComponent } from './gift-receipt-container.component';

describe('GiftReceiptContainerComponent', () => {
  let component: GiftReceiptContainerComponent;
  let fixture: ComponentFixture<GiftReceiptContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GiftReceiptContainerComponent],
      providers: [
        provideTranslateService(),
        provideMockStore({ initialState: { giftReceipts: initialState } }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GiftReceiptContainerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('dispatches only the changed form field and submits the trimmed number', async () => {
    const dispatch = vi.spyOn(TestBed.inject(MockStore), 'dispatch');
    component.formModel.set({ giftNumber: ' 12-3 ' });
    await fixture.whenStable();
    expect(dispatch).toHaveBeenCalledWith(
      GiftReceiptsActions.formChanged({ changes: { giftNumber: ' 12-3 ' } }),
    );
    component.search();
    expect(dispatch).toHaveBeenCalledWith(
      GiftReceiptsActions.searchSubmitted({ giftNumber: '12-3' }),
    );
  });

  it.each(['', '   ', '0-1', '12', '12-0', '12.2-3', '2147483648-1', '1-2147483648'])(
    'does not submit invalid number %s',
    (giftNumber) => {
      component.formModel.set({ giftNumber });
      const dispatch = vi.spyOn(TestBed.inject(MockStore), 'dispatch');
      component.search();
      expect(component.searchForm().valid()).toBe(false);
      expect(dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: GiftReceiptsActions.searchSubmitted.type }),
      );
    },
  );
});
