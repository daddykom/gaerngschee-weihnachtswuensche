import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthActions } from '../../../../store/auth/auth.actions';
import { selectAuthGroup } from '../../../../store/auth/auth.feature';
import { selectFrontendPublicConfigs } from '../../../../store/frontend-config/frontend-config.feature';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatButtonModule, RouterLink, TranslatePipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly store = inject(Store);

  readonly publicConfigs = this.store.selectSignal(selectFrontendPublicConfigs);
  readonly authGroup = this.store.selectSignal(selectAuthGroup);
  readonly campaignYear = computed(() => this.configValue('campaign_year'));
  readonly campaignStartDate = computed(() => this.configValue('campaign_start_date'));
  readonly campaignEndDate = computed(() => this.configValue('campaign_end_date'));
  readonly campaignStatus = computed(() => {
    const startDate = this.campaignStartDate();
    const endDate = this.campaignEndDate();
    if (
      startDate === null ||
      endDate === null ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      return 'unavailable';
    }

    const currentDate = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Europe/Zurich',
    }).format(new Date());

    if (currentDate < startDate) {
      return 'not_started';
    }
    if (currentDate > endDate) {
      return 'ended';
    }

    return 'open';
  });
  readonly formattedCampaignStartDate = computed(() => {
    const value = this.campaignStartDate();
    if (value === null) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12));

    return Number.isNaN(date.getTime())
      ? null
      : new Intl.DateTimeFormat('de-CH', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'Europe/Zurich',
        }).format(date);
  });
  readonly donationUrl = computed(() => {
    const value = this.configValue('donation_url');
    if (value === null) {
      return null;
    }

    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  });

  logout(): void {
    this.store.dispatch(AuthActions.logoutRequested());
  }

  private configValue(variableName: string): string | null {
    const value = this.publicConfigs().find(
      (config) => config.variableName === variableName,
    )?.value;
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  }
}
