import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthActions } from '../../../../store/auth/auth.actions';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent, RouterTestingModule],
      providers: [
        provideTranslateService(),
        provideMockStore({
          initialState: {
            auth: { group: null },
            frontendConfig: {
              publicConfigs: [
                { variableName: 'campaign_year', value: '2026' },
                { variableName: 'campaign_start_date', value: '2000-01-01' },
                { variableName: 'campaign_end_date', value: '2999-01-01' },
                { variableName: 'fulfiller_start_date', value: '2000-01-01' },
                { variableName: 'fulfiller_end_date', value: '2999-01-01' },
                { variableName: 'fulfiller_availability_status', value: 'open' },
              ],
            },
          },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
  });

  it('reads the campaign year from public configuration', () => {
    const component = fixture.componentInstance;

    expect(component.campaignYear()).toBe('2026');
  });

  it('opens fulfiller access within the configured date range', () => {
    expect(fixture.componentInstance.fulfillerStatus()).toBe('open');
  });

  it('shows the ended status when the backend reports an exhausted capacity', () => {
    const store = TestBed.inject(MockStore);
    store.setState({
      frontendConfig: {
        publicConfigs: [
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'campaign_start_date', value: '2000-01-01' },
          { variableName: 'campaign_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_start_date', value: '2000-01-01' },
          { variableName: 'fulfiller_end_date', value: '2999-01-01' },
          { variableName: 'fulfiller_availability_status', value: 'ended' },
        ],
      },
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.fulfillerStatus()).toBe('ended');
  });

  it('does not start the campaign before the configured start date', () => {
    const store = TestBed.inject(MockStore);
    store.setState({
      frontendConfig: {
        publicConfigs: [
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'campaign_start_date', value: '2999-01-01' },
          { variableName: 'campaign_end_date', value: '2999-12-31' },
        ],
      },
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.campaignStatus()).toBe('not_started');
  });

  it('dispatches logout for an authenticated user', () => {
    const store = TestBed.inject(MockStore);
    store.setState({
      auth: { group: 'admin' },
      frontendConfig: {
        publicConfigs: [
          { variableName: 'campaign_year', value: '2026' },
          { variableName: 'campaign_start_date', value: '2000-01-01' },
          { variableName: 'campaign_end_date', value: '2999-01-01' },
        ],
      },
    });
    const dispatch = vi.spyOn(store, 'dispatch');
    fixture.detectChanges();

    fixture.componentInstance.logout();

    expect(dispatch).toHaveBeenCalledWith(AuthActions.logoutRequested());
  });
});
