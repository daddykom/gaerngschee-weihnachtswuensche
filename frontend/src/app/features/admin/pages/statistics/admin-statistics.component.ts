import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminStatisticsActions } from '../../../../store/admin-statistics/admin-statistics.actions';
import {
  selectAdminStatistics,
  selectAdminStatisticsRequest,
} from '../../../../store/admin-statistics/admin-statistics.feature';
import { StatisticsViewComponent } from './statistics-view/statistics-view.component';

@Component({
  selector: 'app-admin-statistics',
  imports: [MatButtonModule, TranslatePipe, StatisticsViewComponent],
  templateUrl: './admin-statistics.component.html',
  styleUrl: './admin-statistics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStatisticsComponent {
  private readonly store = inject(Store);
  readonly request = this.store.selectSignal(selectAdminStatisticsRequest);
  readonly statistics = this.store.selectSignal(selectAdminStatistics);

  retry(): void {
    this.store.dispatch(AdminStatisticsActions.retryClicked());
  }
}
