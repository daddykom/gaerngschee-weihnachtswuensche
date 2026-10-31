import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { FulfillerOrdersService } from '../../../../shared/services/fulfiller-orders.service';

@Component({
  selector: 'app-reservation-confirmation',
  imports: [TranslatePipe],
  templateUrl: './reservation-confirmation.component.html',
  styleUrl: './reservation-confirmation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationConfirmationComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(FulfillerOrdersService);
  readonly loading = signal(true);
  readonly success = signal(false);
  readonly error = signal(false);
  readonly handover = signal<{
    date: string | string[] | null;
    time: string | string[] | null;
    location: string | string[] | null;
  } | null>(null);

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }

    this.service.confirmReservation(token).subscribe({
      next: ({ handover }) => {
        this.handover.set(handover);
        this.success.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
