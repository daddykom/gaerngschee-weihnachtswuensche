import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { InfoBoxComponent } from '../../../../shared/components/info-box/info-box';

@Component({
  selector: 'app-order-confirmation',
  imports: [InfoBoxComponent, TranslatePipe],
  templateUrl: './order-confirmation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderConfirmationComponent {
  private readonly route = inject(ActivatedRoute);
  readonly definitive = this.route.snapshot.queryParamMap.get('status') === 'definitive';
}
