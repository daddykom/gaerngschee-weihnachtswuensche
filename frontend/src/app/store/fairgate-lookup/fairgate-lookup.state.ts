import { FairgateTestResult } from '../../shared/services/fairgate-test.service';

export interface FairgateLookupState {
  result: FairgateTestResult | null;
  status: 'initial' | 'loading' | 'loaded' | 'error';
  errorCode: string | null;
}

export const initialState: FairgateLookupState = {
  result: null,
  status: 'initial',
  errorCode: null,
};
