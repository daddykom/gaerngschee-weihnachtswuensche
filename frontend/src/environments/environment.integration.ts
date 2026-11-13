import { provideStoreDevtools } from '@ngrx/store-devtools';

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8082',
};

export const storeDevtoolsProviders = [provideStoreDevtools()];
