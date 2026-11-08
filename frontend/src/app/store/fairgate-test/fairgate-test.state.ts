import { FairgateTestResult } from '../../shared/services/fairgate-test.service';

export interface FairgateTestState {
  result: FairgateTestResult | null;
  status: 'initial' | 'loading' | 'loaded' | 'error';
  errorCode: string | null;
}

export const initialState: FairgateTestState = {
  result: null,
  status: 'initial',
  errorCode: null,
};
