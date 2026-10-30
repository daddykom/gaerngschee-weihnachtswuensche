import { FrontendConfig, PublicFrontendConfig } from '../../shared/models/frontend-config.model';

export type PublicConfigStatus = 'initial' | 'loading' | 'loaded' | 'error';
export type ConfigRequestStatus = 'initial' | 'loading' | 'success' | 'error';

export interface FrontendConfigState {
  configs: FrontendConfig[];
  publicConfigs: PublicFrontendConfig[];
  loadStatus: ConfigRequestStatus;
  saveStatus: ConfigRequestStatus;
  errorCode: string | null;
  publicStatus: PublicConfigStatus;
  publicErrorCode: string | null;
}

export const initialState: FrontendConfigState = {
  configs: [],
  publicConfigs: [],
  loadStatus: 'initial',
  saveStatus: 'initial',
  errorCode: null,
  publicStatus: 'initial',
  publicErrorCode: null,
};
