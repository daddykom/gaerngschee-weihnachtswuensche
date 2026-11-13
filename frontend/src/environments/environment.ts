import { provideStoreDevtools } from '@ngrx/store-devtools';

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8083',
};

export const storeDevtoolsProviders = [provideStoreDevtools()];
