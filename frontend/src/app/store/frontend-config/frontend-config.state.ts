import { FrontendConfig, PublicFrontendConfig } from '../../shared/models/frontend-config.model';

export type PublicConfigStatus = 'initial' | 'loading' | 'loaded' | 'error';
export type ConfigRequestStatus = 'initial' | 'loading' | 'success' | 'error';
export type FrontendConfigForm = Record<string, string | string[]>;

export interface FrontendConfigState {
  configs: FrontendConfig[];
  form: FrontendConfigForm;
  publicConfigs: PublicFrontendConfig[];
  loadStatus: ConfigRequestStatus;
  saveStatus: ConfigRequestStatus;
  errorCode: string | null;
  publicStatus: PublicConfigStatus;
  publicErrorCode: string | null;
}

export const initialState: FrontendConfigState = {
  configs: [],
  form: {},
  publicConfigs: [],
  loadStatus: 'initial',
  saveStatus: 'initial',
  errorCode: null,
  publicStatus: 'initial',
  publicErrorCode: null,
};
