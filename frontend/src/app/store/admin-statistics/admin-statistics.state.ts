import { AdminStatistics } from '../../shared/models/admin-statistics.model';

export type AdminStatisticsRequest =
  | { status: 'initial' }
  | { status: 'loading' }
  | { status: 'loaded'; statistics: AdminStatistics }
  | { status: 'error'; errorCode: string };

export interface AdminStatisticsState {
  request: AdminStatisticsRequest;
}

export const initialState: AdminStatisticsState = { request: { status: 'initial' } };
