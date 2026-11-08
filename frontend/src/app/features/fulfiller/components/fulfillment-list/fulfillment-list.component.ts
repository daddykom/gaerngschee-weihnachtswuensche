import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import {
  FulfillerCategory,
  FulfillerOrder,
  FulfillerWish,
} from '../../../../shared/models/fulfiller-order.model';
import { FulfillerOrdersLoadStatus } from '../../../../store/fulfiller-orders/fulfiller-orders.state';

@Component({
  selector: 'app-fulfillment-list',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './fulfillment-list.component.html',
  styleUrl: './fulfillment-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FulfillmentListComponent {
  readonly orders = input<FulfillerOrder[]>([]);
  readonly search = input('');
  readonly category = input<FulfillerCategory | ''>('');
  readonly loadStatus = input<FulfillerOrdersLoadStatus>('initial');
  readonly searchChanged = output<string>();
  readonly categoryChanged = output<FulfillerCategory | ''>();
  readonly reserve = output<FulfillerWish>();

  readonly categories: FulfillerCategory[] = ['gift', 'voucher'];
}
