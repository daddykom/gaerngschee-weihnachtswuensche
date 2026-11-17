import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminStatistics } from '../../../../../shared/models/admin-statistics.model';

@Component({
  selector: 'app-statistics-view',
  imports: [TranslatePipe],
  templateUrl: './statistics-view.component.html',
  styleUrl: './statistics-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsViewComponent {
  readonly statistics = input.required<AdminStatistics>();
}
