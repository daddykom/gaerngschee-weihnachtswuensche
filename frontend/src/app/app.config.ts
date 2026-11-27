import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { storeDevtoolsProviders } from '../environments/environment';
import { appRoutes } from './app.routes';
import { appUpdateInterceptor } from './shared/interceptors/app-update.interceptor';
import { authSessionInterceptor } from './shared/interceptors/auth-session.interceptor';
import { authTokenInterceptor } from './shared/interceptors/auth-token.interceptor';
import { eventInterceptor } from './shared/interceptors/event.interceptor';
import { appUpdateEffects } from './store/app-update/app-update.effects';
import { appUpdateFeature } from './store/app-update/app-update.feature';
import { authEffects } from './store/auth/auth.effects';
import { authFeature } from './store/auth/auth.feature';
import { sessionEffects } from './store/auth/session.effects';
import { eventsFeature } from './store/events/events.feature';
import { frontendConfigEffects } from './store/frontend-config/frontend-config.effects';
import { frontendConfigFeature } from './store/frontend-config/frontend-config.feature';
import { imageTransfersEffects } from './store/image-transfers/image-transfers.effects';
import { imageTransfersFeature } from './store/image-transfers/image-transfers.feature';
import { navigationEffects } from './store/navigation/navigation.effects';
import { notificationEffects } from './store/notification/notification.effects';
import { notificationFeature } from './store/notification/notification.feature';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withXhr(),
      withInterceptors([
        authTokenInterceptor,
        authSessionInterceptor,
        eventInterceptor,
        appUpdateInterceptor,
      ]),
    ),
    provideRouter(appRoutes),
    provideStore(),
    provideState(appUpdateFeature),
    provideState(authFeature),
    provideState(notificationFeature),
    provideState(frontendConfigFeature),
    provideState(eventsFeature),
    provideState(imageTransfersFeature),
    provideEffects(
      appUpdateEffects,
      authEffects,
      frontendConfigEffects,
      navigationEffects,
      notificationEffects,
      sessionEffects,
      imageTransfersEffects,
    ),
    ...storeDevtoolsProviders,
    provideTranslateService({
      fallbackLang: 'de',
      lang: 'de',
      loader: provideTranslateHttpLoader({
        prefix: './i18n/',
        suffix: '.json',
      }),
    }),
  ],
};
