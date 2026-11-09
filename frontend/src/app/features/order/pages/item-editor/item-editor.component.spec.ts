import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { OrderActions } from '../../../../store/order/order.actions';
import { ItemEditorComponent } from './item-editor.component';

describe('ItemEditorComponent', () => {
  let component: ItemEditorComponent;
  let fixture: ComponentFixture<ItemEditorComponent>;
  let store: MockStore;

  const item = {
    id: 'item-1',
    category: 'gift' as const,
    personType: 'adult' as const,
    personIndex: 1,
    title: 'Winterjacke',
    description: 'Eine warme Jacke',
    giftLink: '',
    personalMessage: 'Das wäre schön.',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemEditorComponent],
      providers: [
        provideTranslateService(),
        provideMockStore({
          initialState: {
            order: {
              status: 'loaded',
              order: { id: 'order-1', status: 'draft' },
              year: 2026,
              fairgateStatus: null,
              fairgateUserExists: false,
              childrenCount: 0,
              adultsCount: 1,
              form: {
                password: '',
                passwordConfirmation: '',
                adultsCount: 1,
                childrenCount: 0,
                text: 'Meine Situation',
                items: [item],
              },
              errorCode: null,
              saveStatus: 'initial',
              saveErrorCode: null,
            },
            auth: { firstAccess: false },
          },
        }),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'item-1' },
              routeConfig: { path: 'wunsch/:itemId' },
            },
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(ItemEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('requires a non-empty wish title and description', () => {
    component.formModel.update((value) => ({ ...value, title: '  ', description: '  ' }));

    expect(component.itemForm().valid()).toBe(false);
  });

  it('dispatches the description when saving a valid wish', () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    component.formModel.update((value) => ({ ...value, description: 'Ausführliche Beschreibung' }));
    component.save();

    expect(dispatch).toHaveBeenCalledWith(
      OrderActions.itemFormChanged({
        itemId: 'item-1',
        changes: { description: 'Ausführliche Beschreibung' },
      }),
    );
  });
});
