import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-order-confirmation',
  imports: [MatButtonModule, RouterLink, TranslatePipe],
  templateUrl: './order-confirmation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderConfirmationComponent {}
