import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { FairgateTestActions } from '../../../../store/fairgate-test/fairgate-test.actions';
import { FairgateTestComponent } from './fairgate-test.component';

describe('FairgateTestComponent', () => {
  let component: FairgateTestComponent;
  let fixture: ComponentFixture<FairgateTestComponent>;
  let store: MockStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FairgateTestComponent],
      providers: [
        provideTranslateService(),
        provideMockStore({
          initialState: {
            fairgateTest: {
              result: null,
              loading: false,
              errorCode: null,
            },
          },
        }),
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(FairgateTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the test button without a result initially', () => {
    expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.fairgate-test-result')).toBeNull();
  });

  it('dispatches the Fairgate test action', () => {
    const dispatch = vi.spyOn(store, 'dispatch');

    component.runTest();

    expect(dispatch).toHaveBeenCalledWith(FairgateTestActions.test());
  });

  it('renders the JSON result from the store', () => {
    store.setState({
      fairgateTest: {
        result: {
          email: 'isabelle.joss@gaerngschee.ch',
          fairgate: { success: true, data: { contacts: [] } },
        },
        loading: false,
        errorCode: null,
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.fairgate-test-result').textContent).toContain(
      'success',
    );
    expect(fixture.nativeElement.querySelector('.fairgate-test-result').textContent).toContain(
      'contacts',
    );
  });

  it('renders the loading state and disables the test button', () => {
    store.setState({ fairgateTest: { result: null, loading: true, errorCode: null } });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('app.admin.fairgateTest.loading');
  });

  it('can render an empty and false result payload', () => {
    store.setState({
      fairgateTest: {
        result: { email: '', fairgate: { success: false, data: null } },
        loading: false,
        errorCode: null,
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.fairgate-test-result').textContent).toContain(
      'false',
    );
  });
});
