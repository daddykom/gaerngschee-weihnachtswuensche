import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, EMPTY, take } from 'rxjs';
import { AuthService } from '../../../../shared/services/auth.service';
import { AuthActions } from '../../../../store/auth/auth.actions';
import { selectAuthRegistrationLoginLoading } from '../../../../store/auth/auth.feature';

@Component({
  selector: 'app-client-login',
  imports: [MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './client-login.html',
  styleUrl: './client-login.scss',
})
export class ClientLoginComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(Store);

  readonly loading = this.store.selectSignal(selectAuthRegistrationLoginLoading);

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token === null || token === '') {
      this.store.dispatch(
        AuthActions.registrationLoginFailure({ errorCode: 'INVALID_REGISTRATION_TOKEN' }),
      );
      void this.router.navigateByUrl('/start');
      return;
    }

    this.store.dispatch(AuthActions.registrationLogin({ token }));
    this.auth
      .registrationLogin(token)
      .pipe(
        take(1),
        catchError((error: HttpErrorResponse) => {
          this.store.dispatch(
            AuthActions.registrationLoginFailure({
              errorCode:
                typeof error.error?.error?.code === 'string'
                  ? error.error.error.code
                  : 'REGISTRATION_LOGIN_FAILED',
            }),
          );
          void this.router.navigateByUrl('/start');
          return EMPTY;
        }),
      )
      .subscribe((response) => {
        this.store.dispatch(
          AuthActions.registrationLoginSuccess({
            userId: response.user.id,
            email: response.user.email,
            group: response.group,
            fairgateStatus: response.fairgateStatus,
            fairgateUserExists: response.fairgateUserExists,
            childrenCount: response.childrenCount,
            adultsCount: response.adultsCount,
            salutation: response.salutation,
            firstAccess: response.firstAccess,
          }),
        );
        void this.router.navigateByUrl('/bestellung');
      });
  }
}
