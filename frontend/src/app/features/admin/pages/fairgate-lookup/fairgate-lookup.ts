import { JsonPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { FairgateLookupActions } from '../../../../store/fairgate-lookup/fairgate-lookup.actions';
import {
  selectFairgateLookupLoading,
  selectFairgateLookupResult,
} from '../../../../store/fairgate-lookup/fairgate-lookup.feature';

@Component({
  selector: 'app-fairgate-lookup',
  imports: [JsonPipe, TranslatePipe],
  templateUrl: './fairgate-lookup.html',
  styleUrl: './fairgate-lookup.scss',
})
export class FairgateLookup {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);

  readonly email = this.route.snapshot.queryParamMap.get('email')?.trim().toLowerCase() ?? '';
  readonly membership = this.route.snapshot.queryParamMap.get('membership')?.trim() ?? '';
  readonly result = this.store.selectSignal(selectFairgateLookupResult);
  readonly loading = this.store.selectSignal(selectFairgateLookupLoading);

  constructor() {
    if (this.email !== '') {
      this.store.dispatch(
        FairgateLookupActions.lookup({
          email: this.email,
          ...(this.membership === '' ? {} : { membership: this.membership }),
        }),
      );
    }
  }
}
