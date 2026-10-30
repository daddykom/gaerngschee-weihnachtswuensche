import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { appRoutes } from './app.routes';
import { authSessionInterceptor } from './shared/interceptors/auth-session.interceptor';
import { authTokenInterceptor } from './shared/interceptors/auth-token.interceptor';
import { eventInterceptor } from './shared/interceptors/event.interceptor';
import { authEffects } from './store/auth/auth.effects';
import { authFeature } from './store/auth/auth.feature';
import { sessionEffects } from './store/auth/session.effects';
import { eventsFeature } from './store/events/events.feature';
import { frontendConfigEffects } from './store/frontend-config/frontend-config.effects';
import { frontendConfigFeature } from './store/frontend-config/frontend-config.feature';
import { navigationEffects } from './store/navigation/navigation.effects';
import { notificationEffects } from './store/notification/notification.effects';
import { notificationFeature } from './store/notification/notification.feature';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withXhr(),
      withInterceptors([authTokenInterceptor, authSessionInterceptor, eventInterceptor]),
    ),
    provideRouter(appRoutes),
    provideStore(),
    provideState(authFeature),
    provideState(notificationFeature),
    provideState(frontendConfigFeature),
    provideState(eventsFeature),
    provideEffects(
      authEffects,
      frontendConfigEffects,
      navigationEffects,
      notificationEffects,
      sessionEffects,
    ),
    provideStoreDevtools(),
    provideAnimations(),
    provideTranslateService({
      fallbackLang: 'de',
      lang: 'de',
      loader: provideTranslateHttpLoader({
        prefix: './i18n/',
        suffix: '.json',
      }),
    }), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ],
};
